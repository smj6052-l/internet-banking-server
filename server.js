const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv").config();
const signupRouter = require("./routes/signup");
const loginRouter = require("./routes/login");
const setupDB = require("./db_setup");
const cors = require("cors");
const session = require("express-session");
const multer = require("multer");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8000;

// 파일 업로드 설정
const storage = multer.memoryStorage(); // 메모리 저장소 사용
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB 이하로 제한
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only .png, .jpeg, .jpg format allowed!"));
    }
  },
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 파일 업로드 미들웨어 설정
app.use(upload.single("client_photo"));

// DB 초기화 완료 후 서버 가동
setupDB()
  .then(({ mysqldb }) => {
    app.set("mysqldb", mysqldb);

    app.use("/signup", signupRouter);
    app.use("/login", loginRouter);

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to setup database connection:", err);
  });
