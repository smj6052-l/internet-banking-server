import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import signupRouter from "./routes/signup.js";
import loginRouter from "./routes/login.js";
import accountRouter from "./routes/account.js";
import invitationRouter from "./routes/invitation.js";
import transactionRouter from "./routes/transaction.js";
import groupaccountRouter from "./routes/group-account.js";
import profileRouter from "./routes/profile.js";
import setupDB from "./db_setup.js";
import session from "express-session";
import authMiddleware from "./middlewares/auth.js";

import path from "path";
import cors from "cors";

// https 설정
import https from "https";
import fs from "fs";

dotenv.config();

// SSL 인증서와 키 파일 읽기
const options = {
  key: fs.readFileSync("server.key"),
  cert: fs.readFileSync("server.cert"),
};

const app = express();
const PORT = process.env.PORT || 8000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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
    app.use("/signup", signupRouter); // destroySession middleware 적용
    app.use("/login", loginRouter); // destroySession middleware 적용
    app.use("/account", authMiddleware, accountRouter); // authMiddleware 적용
    app.use("/invitation", authMiddleware, invitationRouter); // authMiddleware 적용
    app.use("/group-account", authMiddleware, groupaccountRouter); // authMiddleware 적용
    app.use("/transaction", authMiddleware, transactionRouter); // authMiddleware 적용
    app.use("/profile", authMiddleware, profileRouter); // authMiddleware 적용
    https.createServer(options, app).listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to setup database connection:", err);
  });
