const dotenv = require("dotenv").config();
const mysql = require("mysql2");
const { v4: uuidv4 } = require("uuid");

let mysqldb, saltDB;

const setup = async () => {
  if (mysqldb && saltDB) {
    return { mysqldb, saltDB };
  }

  try {
    mysqldb = mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DB,
    });
    saltDB = mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_SALT_DB,
    });

    mysqldb.connect();
    saltDB.connect();
    console.log("DB 접속 성공");
    return { mysqldb, saltDB };
  } catch (err) {
    console.log("DB 접속 실패");
    throw err;
  }
};

module.exports = setup;
