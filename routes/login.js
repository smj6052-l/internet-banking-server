const express = require("express");
const sha256 = require("sha256");
const axios = require("axios");
const crypto = require("crypto");
const router = express.Router();

router.post("/verify-captcha", async (req, res) => {
  const { token } = req.body;
  const recaptchaSecret = process.env.reCAPTCHA_SECRET_KEY;

  try {
    const response = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify?secret=${recaptchaSecret}&response=${token}`
    );
    const data = response.data;

    if (!data.success) {
      return res.status(400).json({
        message: "캡챠 인증에 실패하였습니다.",
        error: data["error-codes"],
      });
    }

    req.session.captchaVerified = true; // 캡챠 인증 성공 표시
    return res
      .clearCookie("connect.sid")
      .status(200)
      .json({ message: "캡챠 인증에 성공하였습니다." });
  } catch (error) {
    return res.clearCookie("connect.sid").status(500).json({
      message: "캡챠 인증 오류가 발생하였습니다.",
      error: error.message,
    });
  }
});

router.post("/", async (req, res) => {
  const { client_id, client_pw } = req.body;
  const mysqldb = req.app.get("mysqldb");
  const saltDB = req.app.get("saltDB");

  if (!req.session.captchaVerified) {
    return res
      .status(400)
      .json({ message: "캡챠 인증이 완료되지 않았습니다." });
  }

  try {
    // Get client data based on client_id
    const [clientRows] = await mysqldb
      .promise()
      .query("SELECT * FROM Client WHERE client_id = ?", [client_id]);

    if (clientRows.length === 0) {
      return res.status(400).json({ message: "로그인 실패" });
    }

    const client = clientRows[0];

    if (client.client_locked) {
      return res.status(403).json({
        message: "계정이 잠겨 있습니다. 가까운 영업점을 방문하세요.",
      });
    }

    // Get password salt
    const [saltRows] = await saltDB
      .promise()
      .query("SELECT * FROM ClientPwSalt WHERE client_id = ?", [client_id]);

    if (saltRows.length === 0) {
      return res
        .status(500)
        .json({ message: "내부 서버 오류: 솔트 정보 없음" });
    }

    const salt = saltRows[0].pwSalt;
    const hashedPw = sha256(client_pw + salt);

    if (client.client_pw !== hashedPw) {
      const loginAttempts = client.client_login_attempts + 1;
      let locked = false;

      if (loginAttempts >= 5) {
        locked = true;
      }

      await mysqldb
        .promise()
        .query(
          "UPDATE Client SET client_login_attempts = ?, client_locked = ? WHERE client_id = ?",
          [loginAttempts, locked, client_id]
        );

      if (locked) {
        return res.status(403).json({
          message: "5회 이상 로그인 실패. 가까운 영업점을 방문하세요.",
        });
      } else {
        return res.status(400).json({ message: "로그인 실패" });
      }
    }

    // Reset login attempts upon successful login
    await mysqldb
      .promise()
      .query(
        "UPDATE Client SET client_login_attempts = 0, client_locked = false WHERE client_id = ?",
        [client_id]
      );

    const [saltRowsSession] = await saltDB
      .promise()
      .query("SELECT * FROM SessionSalt WHERE client_id = ?", [client_id]);

    if (saltRowsSession.length === 0) {
      return res
        .status(500)
        .json({ message: "내부 서버 오류: 세션 솔트 정보 없음" });
    }

    const Ssalt = saltRowsSession[0].Ssalt;

    req.session.client = {
      client_pk: client.client_pk,
      client_id: sha256(client.client_id + Ssalt),
      client_pw: sha256(client.client_pw + Ssalt),
      client_name: client.client_name,
    };

    delete req.session.captchaVerified;

    return res
      .clearCookie("_GRECAPTCHA")
      .status(200)
      .json({ message: "로그인 성공" });
  } catch (error) {
    req.session.destroy();
    delete req.session.captchaVerified;

    return res
      .clearCookie("connect")
      .status(500)
      .json({ message: "내부 서버 오류", error: error.message });
  }
});

// 로그아웃 처리
router.post("/logout", (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "로그아웃 실패" });
      }
      res.clearCookie("connect.sid");
      return res.status(200).json({ message: "로그아웃 성공" });
    });
  } else {
    return res.status(400).json({ message: "로그인 상태가 아닙니다." });
  }
});

module.exports = router;
