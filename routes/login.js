const express = require("express");
const sha256 = require("sha256");
const axios = require("axios");
const router = express.Router();

router.post("/verify-captcha", async (req, res) => {
  // 캡챠 인증 경로 수정
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
    return res.status(200).json({ message: "캡챠 인증에 성공하였습니다." });
  } catch (error) {
    return res.status(500).json({
      message: "캡챠 인증 오류가 발생하였습니다.",
      error: error.message,
    });
  }
});

router.post("/", async (req, res) => {
  // 로그인 경로 수정
  const { client_id, client_pw } = req.body;
  const mysqldb = req.app.get("mysqldb");

  // 캡챠 인증 확인
  if (!req.session.captchaVerified) {
    return res
      .status(400)
      .json({ message: "캡챠 인증이 완료되지 않았습니다." });
  }

  try {
    // 클라이언트 정보 조회
    const [rows] = await mysqldb
      .promise()
      .query("SELECT * FROM Client WHERE client_id = ?", [client_id]);

    if (rows.length === 0) {
      return res.status(400).json({ message: "로그인 실패" });
    }

    const client = rows[0];

    // 계정이 잠금 상태인지 확인
    if (client.client_locked) {
      return res.status(403).json({
        message: "계정이 잠겨 있습니다. 가까운 영업점을 방문하세요.",
      });
    }

    // 비밀번호 확인
    if (client.client_pw !== sha256(client_pw)) {
      // 로그인 시도 횟수 증가
      const loginAttempts = client.client_login_attempts + 1;
      let locked = false;

      if (loginAttempts >= 5) {
        // 시도 횟수가 5회 이상이면 계정을 잠금
        locked = true;
      }

      await mysqldb
        .promise()
        .query(
          "UPDATE Client SET client_login_attempts = ?, client_locked = ? WHERE client_id = ?",
          [loginAttempts, locked, client_id]
        );

      // 계정이 잠긴 경우 영업점 방문 메시지 반환
      if (locked) {
        return res.status(403).json({
          message: "5회 이상 로그인 실패. 가까운 영업점을 방문하세요.",
        });
      } else {
        return res.status(400).json({ message: "로그인 실패" });
      }
    }

    // 로그인 성공, 로그인 시도 횟수 초기화
    await mysqldb
      .promise()
      .query(
        "UPDATE Client SET client_login_attempts = 0, client_locked = false WHERE client_id = ?",
        [client_id]
      );

    // 세션 생성 또는 토큰 발급 등 로그인 처리
    req.session.client_id = client.client_id; // 예시로 세션에 사용자 ID 저장
    return res.status(200).json({ message: "로그인 성공" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "내부 서버 오류", error: error.message });
  } finally {
    // 로그인 성공여부와 상관없이 불필요한 세션 삭제
    // 로그인 실패시
    if (req.session && !req.session.client_id) {
      req.session.destroy();
    } else {
      // 로그인 성공시
      delete req.session.captchaVerified;
    }
  }
});

module.exports = router;
