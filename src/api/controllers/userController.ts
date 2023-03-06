import { Router, Request, Response, NextFunction } from 'express';
import { driver, auth } from "neo4j-driver";
import config from "../../config";
import debugError from '../../services/debug_error';


//! Solve Container.get(logger) issue
const db = driver(config.databaseURL, auth.basic(config.dbUser, config.dbPass),
  {/* encrypted: 'ENCRYPTION_OFF' */ },);

const session = db.session({ database: "neo4j" });


const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, ...params } = req.body;
    const existingUser = await session.run(`
      MATCH (u:User {id: $id})
      RETURN u
    `, { id });

    if (!existingUser.records.length) {
      console.log('Sorry, No such user exists!');
      return res.status(404).json({ status: 404, message: 'User not found' });
    }

    const setStatements = Object.entries(params).map(([key, value]) => `u.${key} = $${key}`);
    const setQuery = setStatements.join(', ');

    const updateQuery = `
      MATCH (u:User {id: $id})
      SET ${setQuery}
      RETURN u.name AS name, u.age AS age, u. photoURL as photoURL, u.latitude AS latitude, u.longitude AS longitude, u.gender AS gender
    `;

    const result = await session.run(updateQuery, { id, ...params });
    const resultList = result.records.map(record => ({
      name: record.get('name'),
      age: record.get('age'),
      gender:record.get('gender'),
      photoURL: record.get('photoURL'),
      latitude: record.get('latitude'),
      longitude: record.get('longitude')
    }));
    return res.status(200).json({ status: 200, data: resultList });
  } catch (e) {
    debugError(e.toString());
    return next(e);
  }
};



const getUserBySessionId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = `
      MATCH (n:User {id:"${req.body.id}"})
      RETURN n.id AS id, n.name AS name, n.email AS email, n.age AS age,
        n.gender AS gender, n.photoURL AS photoURL,
        n.latitude AS latitude, n.longitude AS longitude;
    `;
    const result = await session.run(query);
    const record = result.records[0];
    const data = {
      id: record.get('id'),
      name: record.get('name'),
      emailId: record.get('email'),
      age: record.get('age').toNumber(),
      gender: record.get('gender'),
      photoURL: record.get('photoURL'),
      latitude: record.get('latitude').toNumber(),
      longitude: record.get('longitude').toNumber()
    };
    return res.status(200).json({ status: 200, data });
  } catch (e) {
    debugError(e.toString());
    return next(e);
  }
};

const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = `
      MATCH (n:User)
      RETURN n.id AS id, n.name AS name, n.email AS emailId, n.age AS age,
        n.gender AS gender, n.photoURL AS photoURL,
        n.latitude AS latitude, n.longitude AS longitude;
    `;
    const result = await session.run(query);
    const resultList = result.records.map(record => ({
      id: record.get('id'),
      name: record.get('name'),
      emailId: record.get('emailId'),
      age: record.get('age').toNumber(),
      gender: record.get('gender'),
      photoURL: record.get('photoURL'),
      latitude: record.get('latitude').toNumber(),
      longitude: record.get('longitude').toNumber()
    }));
    return res.status(200).json({ status: 200, data: resultList });
  } catch (e) {
    debugError(e.toString());
    return next(e);
  }
};


const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = `
      MERGE (u:User {id:"${req.body.id}"})
      ON CREATE SET u.id="${req.body.id}",
                    u.name = "${req.body.username}",
                    u.emailId="${req.body.email}",
                    u.photoURL="${req.body.photoURL}",
                    u.gender = COALESCE("${req.body.gender}","Unknown"),
                    u.age = COALESCE(${req.body.age},20),
                    u.latitude=${req.body.latitude},
                    u.longitude=${req.body.longitude}
      RETURN u
    `;
    const result = await session.run(query);
    if (result.summary.counters.updates().nodesCreated === 0) {
      return res.status(409).json({ status: 409, data: "User already exists!" });
    } else {
      return res.status(200).json({ status: 200, data: "User Profile Created Successfully. Welcome to Enthem !" });
    }
  } catch (e) {
    debugError(e.toString());
    return next(e);
  }
};




const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = `
      MATCH (u:User {id: "${req.body.id}"})
      WITH u LIMIT 1
      OPTIONAL MATCH (u)-[r]-()
      DELETE u, r
      RETURN COUNT(u) as deleted
    `;
    const result = await session.run(query);
    const deleted = result.records[0].get("deleted").toNumber();
    if (deleted === 0) {
      return res.status(404).json({ status: 404, data: "User does not exist and cannot be deleted." });
    } else {
      return res.status(200).json({ status: 200, data: "User Profile Deleted Successfully !" });
    }
  } catch (e) {
    debugError(e.toString());
    return res.status(500).json({ status: 500, data: "Sorry, there was an error deleting the user." });
  }
};




const locRecommend = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = `
      MATCH (u:User)
      WHERE u.id = "${req.body.id}" 
      AND u.latitude IS NOT NULL AND u.longitude IS NOT NULL 
      MATCH (u2:User)
      WHERE u2.id <> u.id 
      AND u2.latitude IS NOT NULL AND u2.longitude IS NOT NULL 
      WITH u, u2,
          toFloat(u.latitude) * pi() / 180.0 AS lat1, 
          toFloat(u.longitude) * pi() / 180.0 AS lon1,
          toFloat(u2.latitude) * pi() / 180.0 AS lat2, 
          toFloat(u2.longitude) * pi() / 180.0 AS lon2,
          3959.0 AS r
      WITH u, u2, r * asin(sqrt(sin((lat2 - lat1) / 2)^2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2)^2)) * 2.0 AS distance
      WHERE distance <= ${req.body.radius}
      RETURN DISTINCT u2.name as name, u2.age as age, u2.latitude as latitude, u2.longitude as longitude, u2.photoURL as photoURL
    
    `;

    const result = await session.run(query);
    const resultList = result.records.map(record => ({
      // id:record.get(null),
      name: record.get('name'),
      age: record.get('age').toNumber(),
      photoURL: record.get('photoURL'),
      // skills:record.get(null),
      // interests:record.get(null),
      // compatible:record.get(null),
      latitude: record.get('latitude'),
      longitude: record.get('longitude')
    }));
    return res.status(200).json({ status: 200, data: resultList });
  } catch (e) {
    debugError(e.toString());
    return next(e);
  }
};


const recommendUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = `
      MATCH (u:User)-[:HAS_SKILL]->(s:Activity)<-[:HAS_SKILL]-(u2:User)
      WHERE u.id = "${req.body.id}"
      AND u.latitude IS NOT NULL AND u.longitude IS NOT NULL 
      AND u2.id <> u.id 
      AND u2.latitude IS NOT NULL AND u2.longitude IS NOT NULL 
      WITH u, u2, s, u.latitude * pi() / 180 AS lat1, u.longitude * pi() / 180 AS lon1,
          u2.latitude * pi() / 180 AS lat2, u2.longitude * pi() / 180 AS lon2,
          6371 * 2 AS r 
      WITH u, u2, s, lat1, lon1, lat2, lon2, r,
          sin((lat2 - lat1) / 2) AS a,
          sin((lon2 - lon1) / 2) AS b,
          cos(lat1) AS c,
          cos(lat2) AS d
      WITH u, u2, s, r * asin(sqrt(a^2 + c * d * b^2)) AS distance
      WHERE distance <=${req.body.radius}
      RETURN DISTINCT u2.name as name, u2.age as age, u2.latitude as latitude, u2.longitude as longitude, u2.photoURL as photoURL
    `;

    const result = await session.run(query);
    const resultList = result.records.map(record => ({
      name: record.get('name'),
      age: record.get('age').toNumber(),
      photoURL: record.get('photoURL'),
      latitude: record.get('latitude'),
      longitude: record.get('longitude')
    }));
    return res.status(200).json({ status: 200, data: resultList });
  } catch (e) {
    debugError(e.toString());
    return next(e);
  }
};

const createSkills = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const skills = req.body.skills.map(skill => `"${skill}"`).join(', ');
    const query = `
      WITH [${skills}] AS skillsList
      UNWIND skillsList AS skill
      MERGE (s:Activity {name:skill})
      WITH s
      MATCH (u:User {id:"${req.body.id}"})
      MERGE (u)-[:HAS_SKILL]->(s)
    `;

    const result = await session.run(query);
    return res.status(200).json({ status: 200, data:"Done creating skills" });
  } catch (e) {
    debugError(e.toString());
    return next(e);
  }
};

const createInterests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const interests = req.body.interests.map(interest => `"${interest}"`).join(', ');
    const query = `
      WITH [${interests}] AS interestsList
      UNWIND interestsList AS interest
      MERGE (s:Activity {name:interest})
      WITH s
      MATCH (u:User {id:"${req.body.id}"})
      MERGE (u)-[:HAS_INTEREST]->(s)
    `;

    const result = await session.run(query);
    return res.status(200).json({ status: 200, data: "Done creating Interests" });
  } catch (e) {
    debugError(e.toString());
    return next(e);
  }
};


module.exports = {
  updateUser,
  getUserBySessionId,
  getAllUsers,
  createUser,
  deleteUser,
  recommendUser,
  createSkills,
  createInterests,
  locRecommend,
};
