const dotenv = require("dotenv").config();
const mysql = require("mysql2");

let mysqldb;

const setup = async () => {
  // 이미 db 접속 정보가 존재하는 경우 해당 객체를 바로 반환
  if (mysqldb) {
    return { mysqldb };
  }

  try {
    mysqldb = mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DB,
    });
    mysqldb.connect();
    console.log("db 접속 성공");
    return { mysqldb };
  } catch (err) {
    console.log("db 접속 실패");
    throw err;
  }
};

module.exports = setup;
