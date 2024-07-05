const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv").config();
const signupRouter = require("./routes/signup");
const loginRouter = require("./routes/login");
const setupDB = require("./db_setup"); // 실제 DB 사용 시 주석 처리 후 사용
// const { initializeDatabase } = require("./models"); // 데이터베이스 초기화 함수 가져오기
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

// CORS 설정 - 다른 도메인에서의 요청을 허용
const corsOptions = {
  origin: `http://localhost:5713`, // 클라이언트 포트 설정
  credentials: true, // 세션을 사용할 경우 true로 설정
};
app.use(cors(corsOptions));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// 세션 설정
app.use(
  session({
    secret: process.env.SESSION_SECRET_KEY, // 원하는 시크릿 키로 변경하세요
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // HTTPS를 사용하는 경우 true로 설정
  })
);

// 파일 업로드 미들웨어 설정
app.use(upload.single("client_photo"));

// // Test용 DB 사용 시
// app.use("/signup", signupRouter);

// initializeDatabase()
//   .then(() => {
//     // 서버 시작
//     app.listen(PORT, () => {
//       console.log(`Server is running on port ${PORT}`);
//     });
//   })
//   .catch((err) => {
//     console.error("Failed to initialize database:", err);
//   });

// 실제 DB 사용 시
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
