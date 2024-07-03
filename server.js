const express = require("express");
const setup = require("./db_setup");

const app = express();

app.listen(process.env.WEB_PORT, async () => {
  await setup();
  console.log("8080 서버가 준비되었습니다");
});
