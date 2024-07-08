const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv").config();
const signupRouter = require("./routes/signup");
const loginRouter = require("./routes/login");
const accountRouter = require("./routes/account");
const invitationRouter = require("./routes/invitation");
const transactionRouter = require("./routes/transaction");
const setupDB = require("./db_setup");
const session = require("express-session");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const uuid = require("uuid");
// https 설정
const https = require("https");
const fs = require("fs");
// SSL 인증서와 키 파일 읽기
const options = {
  key: fs.readFileSync("server.key"),
  cert: fs.readFileSync("server.cert"),
};

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

app.use(
  session({
    secret: process.env.SESSION_SECRET_KEY,
    resave: false,
    saveUninitialized: false,
    cookie: {
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "None",
      maxAge: 5400000,
      secure: true,
    },
  })
);
const corsOptions = {
  origin: "https://localhost:5173",
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true,
};
app.use(cors(corsOptions));

// DB 초기화 완료 후 서버 가동
setupDB()
  .then(({ mysqldb, saltDB }) => {
    app.set("mysqldb", mysqldb);
    app.set("saltDB", saltDB);
    app.use("/signup", signupRouter);
    app.use("/login", loginRouter);
    app.use("/account", accountRouter);
    app.use("/invitation", invitationRouter);
    app.use("/account/:id/transactions", transactionRouter);
    https.createServer(options, app).listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to setup database connection:", err);
  });
