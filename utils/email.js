const nodemailer = require("nodemailer");

async function sendEmail(to, subject, text) {
  const transporter = nodemailer.createTransport({
    host: "smtp.naver.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.NAVER_EMAIL, // 네이버 이메일 주소
      pass: process.env.NAVER_EMAIL_PASSWORD, // 네이버 이메일 비밀번호
    },
  });

  const mailOptions = {
    from: process.env.NAVER_EMAIL,
    to: to,
    subject: subject,
    text: text,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully");
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}

module.exports = { sendEmail };
