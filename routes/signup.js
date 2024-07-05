const express = require("express");
const sha256 = require("sha256");
const { sendEmail } = require("../utils/email");
const {
  checkId,
  checkPhone,
  checkResi,
  verifyEmailCode,
} = require("../utils/validation");
const router = express.Router();
const axios = require("axios");

// 비밀번호 해싱 함수
const hashPassword = (password) => {
  return sha256(password);
};

// 중복 사용자 ID 체크
router.post("/check-id", async (req, res) => {
  const { client_id } = req.body;
  const mysqldb = req.app.get("mysqldb");

  try {
    const isAvailable = await checkId(mysqldb, client_id);
    if (!isAvailable) {
      return res.status(400).json({ message: "User ID already exists" });
    }
    return res.status(200).json({ message: "User ID is available" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// 중복 전화번호 체크
router.post("/check-phone", async (req, res) => {
  const { client_phone } = req.body;
  const mysqldb = req.app.get("mysqldb");

  try {
    const isAvailable = await checkPhone(mysqldb, client_phone);
    if (!isAvailable) {
      return res.status(400).json({ message: "Phone number already exists" });
    }
    return res.status(200).json({ message: "Phone number is available" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// 중복 주민등록번호 체크
router.post("/check-resi", async (req, res) => {
  const { client_resi } = req.body;
  const mysqldb = req.app.get("mysqldb");

  try {
    const isAvailable = await checkResi(mysqldb, client_resi);
    if (!isAvailable) {
      return res
        .status(400)
        .json({ message: "Resident registration number already exists" });
    }
    return res
      .status(200)
      .json({ message: "Resident registration number is available" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// 이메일 인증 코드 발송
router.post("/send-verification-code", async (req, res) => {
  const { client_email } = req.body;
  const verificationCode = Math.floor(
    100000 + Math.random() * 900000
  ).toString();
  const subject = "Email Verification Code";
  const text = `Your verification code is ${verificationCode}`;

  try {
    await sendEmail(client_email, subject, text);
    req.session.verificationCode = verificationCode;
    return res.status(200).json({ message: "Verification code sent" });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to send verification code",
      error: error.message,
    });
  }
});

// 이메일 인증 코드 확인
router.post("/verify-email-code", (req, res) => {
  const { verificationCode } = req.body;
  const sessionVerificationCode = req.session.verificationCode;

  if (verifyEmailCode(sessionVerificationCode, verificationCode)) {
    req.session.verificationCode = null; // 인증 코드 사용 후 무효화
    return res.status(200).json({ message: "Email verified successfully" });
  } else {
    return res.status(400).json({ message: "Invalid verification code" });
  }
});

// 캡챠 인증 결과 확인
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
        message: "Captcha verification failed",
        error: data["error-codes"],
      });
    }

    req.session.captchaVerified = true; // 캡챠 인증 성공 표시
    return res.status(200).json({ message: "Captcha verified successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Captcha verification error", error: error.message });
  }
});

// 회원가입 처리
router.post("/", async (req, res) => {
  const {
    client_id,
    client_name,
    password,
    password_confirmation,
    client_email,
    client_phone,
    client_address,
    client_resi,
  } = req.body;

  // 비밀번호 확인
  if (password !== password_confirmation) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  // 이메일 인증 확인
  if (req.session.verificationCode) {
    return res.status(400).json({ message: "Email not verified" });
  }

  // 캡챠 인증 확인
  if (!req.session.captchaVerified) {
    return res.status(400).json({ message: "Captcha not verified" });
  }

  // 비밀번호 해시
  const hashedPassword = hashPassword(password);

  // 프로필 사진 처리
  let client_photo = null;
  if (req.file) {
    client_photo = req.file.buffer; // 파일을 BLOB으로 저장
  }

  const mysqldb = req.app.get("mysqldb");

  try {
    // 새로운 사용자 정보 삽입
    await mysqldb.promise().query(
      `INSERT INTO Client (client_id, client_name, client_pw, client_email, client_phone, client_address, client_resi, client_photo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        client_id,
        client_name,
        hashedPassword,
        client_email,
        client_phone,
        client_address,
        client_resi,
        client_photo,
      ]
    );

    // 캡챠 인증 상태 초기화
    req.session.captchaVerified = false;

    return res.status(200).json({ message: "User registered successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

module.exports = router;
