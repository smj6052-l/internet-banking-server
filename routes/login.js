const express = require("express");
const sha256 = require("sha256");
const router = express.Router();

router.post("/login", async (req, res) => {
  const { client_id, password } = req.body;
  const mysqldb = req.app.get("mysqldb");

  try {
    // 클라이언트 정보 조회
    const [rows] = await mysqldb
      .promise()
      .query("SELECT * FROM Client WHERE client_id = ?", [client_id]);

    if (rows.length === 0) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const client = rows[0];

    // 계정이 잠금 상태인지 확인
    if (
      client.client_lock_until &&
      new Date(client.client_lock_until) > new Date()
    ) {
      const lockTimeRemaining = Math.ceil(
        (new Date(client.client_lock_until) - new Date()) / 1000 / 60
      );
      return res
        .status(403)
        .json({
          message: `Account is locked. Try again in ${lockTimeRemaining} minutes.`,
        });
    }

    // 비밀번호 확인
    if (client.client_pw !== sha256(password)) {
      // 로그인 시도 횟수 증가
      const loginAttempts = client.client_login_attempts + 1;
      let lockUntil = null;

      if (loginAttempts >= 5) {
        // 시도 횟수가 5회 이상이면 계정을 5분 동안 잠금
        lockUntil = new Date(Date.now() + 5 * 60 * 1000); // 5분 후
      }

      await mysqldb
        .promise()
        .query(
          "UPDATE Client SET client_login_attempts = ?, client_lock_until = ? WHERE client_id = ?",
          [loginAttempts, lockUntil, client_id]
        );

      return res.status(400).json({ message: "Invalid credentials" });
    }

    // 로그인 성공, 로그인 시도 횟수 초기화
    await mysqldb
      .promise()
      .query(
        "UPDATE Client SET client_login_attempts = 0, client_lock_until = NULL WHERE client_id = ?",
        [client_id]
      );

    // 세션 생성 또는 토큰 발급 등 로그인 처리
    req.session.client_id = client.client_id; // 예시로 세션에 사용자 ID 저장
    return res.status(200).json({ message: "Login successful" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

module.exports = router;
