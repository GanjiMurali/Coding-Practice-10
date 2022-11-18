const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error:${e.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

//Middleware function
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//1) POST API user Register
app.post("/register", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  const getSqlQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(getSqlQuery);
  if (dbUser === undefined) {
    if (password.length < 5) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const userRegisterQuery = `INSERT INTO user (username, name, password, gender, location) VALUES ( '${username}', '${name}', '${hashedPassword}', '${gender}', '${location}');`;
      const dbResponse = await db.run(userRegisterQuery);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//2) POST Login User
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserDetailsQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(getUserDetailsQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordCorrect = await bcrypt.compare(password, dbUser.password);
    if (true === isPasswordCorrect) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//2) GET States Details
app.get("/states/", authenticateToken, async (request, response) => {
  let { username } = request;
  const selectUserQuery = `SELECT * FROM state;`;
  const userDetails = await db.all(selectUserQuery);
  response.send(userDetails);
});

//3) GET Details With Id
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const selectQuery = `SELECT * FROM state WHERE state_id = ${stateId};`;
  const userDetails = await db.get(selectQuery);
  response.send(userDetails);
});

//4) POST District Details
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const selectQuery = `INSERT INTO 
  district (district_name ,state_id ,cases ,cured ,active ,deaths)
  VALUES ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`;
  const dbResponse = await db.run(selectQuery);
  response.send("District Successfully Added");
});

//5) GET District Details With Id
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `SELECT * FROM district WHERE district_id = ${districtId};`;
    const dbResponse = await db.get(getDistrictQuery);

    const convertColumnNameSnakeCaseToPascalCase = (dbObject) => {
      return {
        districtId: dbObject.district_id,
        districtName: dbObject.district_name,
        stateId: dbObject.state_id,
        cases: dbObject.cases,
        cured: dbObject.cured,
        active: dbObject.active,
        deaths: dbObject.deaths,
      };
    };

    let newObject = convertColumnNameSnakeCaseToPascalCase(dbResponse);

    response.send(newObject);
  }
);

//6) DELETE District Details With ID
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const selectQuery = `DELETE FROM district WHERE district_id = ${districtId};`;
    const userDetails = await db.run(selectQuery);
    response.send("District Removed");
  }
);

//7) PUT Update District Details With Id
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateQuery = `UPDATE district SET 
                                district_name = '${districtName}',
                                state_id = ${stateId},
                                cases = ${cases},
                                cured = ${cured},
                                active = ${active},
                                deaths = ${deaths} 
                           WHERE  district_id = ${districtId};`;
    const dbResponse = await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

//8) GET Stats Details
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getDistrictQuery = `SELECT * FROM 
                                    state JOIN district 
                                    ON state.state_id = district.state_id WHERE district.state_id = ${stateId};`;
    const dbResponse = await db.get(getDistrictQuery);

    const convertColumnNameSnakeCaseToPascalCase = (dbObject) => {
      return {
        totalCases: dbObject.cases,
        totalCured: dbObject.cured,
        totalActive: dbObject.active,
        totalDeaths: dbObject.deaths,
      };
    };

    let newObject = convertColumnNameSnakeCaseToPascalCase(dbResponse);

    response.send(newObject);
  }
);

module.exports = app;
