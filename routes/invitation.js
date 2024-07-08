const express = require("express");
const router = express.Router();
const mysql = require("mysql2/promise");
const { body, validationResult } = require("express-validator");
const { v4: uuidv4 } = require("uuid");
const { sendEmail } = require("../utils/email");
const { isAuthenticated } = require("../utils/is-authenticated");
// const dbConfig = require('../config/database');

// 모임통장 초대
router.post(
  "/invite",
  [
    body("group_pk").isInt().withMessage("유효하지 않은 그룹 ID입니다."),
    body("invitee_email")
      .isEmail()
      .withMessage("유효하지 않은 이메일 주소입니다."),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { group_pk, invitee_email } = req.body;
    const inviter_pk = req.session.user.client_pk; // 세션에서 초대자 ID 가져오기

    try {
      // const connection = await mysql.createConnection(dbConfig);
      const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DB,
      });

      // 초대자가 해당 그룹의 멤버인지 확인
      const [memberCheck] = await connection.execute(
        'SELECT * FROM GroupAccountMember WHERE group_pk = ? AND client_pk = ? AND invite_status = "accepted"',
        [group_pk, inviter_pk]
      );

      if (memberCheck.length === 0) {
        await connection.end();
        return res
          .status(403)
          .json({ error: "해당 모임통장에 대한 초대 권한이 없습니다." });
      }

      // 초대할 사용자의 client_pk 조회
      const [inviteeRows] = await connection.execute(
        "SELECT client_pk FROM Client WHERE client_email = ?",
        [invitee_email]
      );

      if (inviteeRows.length === 0) {
        await connection.end();
        return res
          .status(404)
          .json({ error: "초대할 사용자를 찾을 수 없습니다." });
      }

      const invitee_pk = inviteeRows[0].client_pk;

      // 해당 사용자가 이미 초대된 상태인지 확인
      const [existingInvite] = await connection.execute(
        'SELECT * FROM GroupAccountMember WHERE group_pk = ? AND client_pk = ? AND invite_status = "pending"',
        [group_pk, invitee_pk]
      );

      if (existingInvite.length > 0) {
        await connection.end();
        return res.status(400).json({ error: "이미 초대된 사용자입니다." });
      }

      // 초대 코드 생성
      const invite_code = uuidv4();
      const expiration_date = new Date();
      expiration_date.setDate(expiration_date.getDate() + 7); // 7일 후 만료

      // GroupAccountMember에 초대 정보 추가
      await connection.execute(
        "INSERT INTO GroupAccountMember (group_pk, account_pk, client_pk, member_role, invite_status, invite_code, invite_expiration) VALUES (?, (SELECT account_pk FROM `Group` WHERE group_pk = ?), ?, ?, ?, ?, ?)",
        [
          group_pk,
          group_pk,
          invitee_pk,
          "member",
          "pending",
          invite_code,
          expiration_date,
        ]
      );

      await connection.end();

      // 초대 이메일 발송
      const inviteUrl = `${process.env.APP_URL}/invitation/join/${invite_code}`;
      await sendEmail(
        invitee_email,
        "모임통장 초대",
        `모임통장에 초대되었습니다. 아래 버튼을 클릭하여 참여하세요:`,
        `<p>모임통장에 초대되었습니다.</p>
         <p><a href="${inviteUrl}" style="background-color: #4CAF50; border: none; color: white; padding: 15px 32px; text-align: center; text-decoration: none; display: inline-block; font-size: 16px; margin: 4px 2px; cursor: pointer;">모임통장 참여하기</a></p>
       `
      );

      res.json({ success: true, message: "초대가 성공적으로 발송되었습니다." });
    } catch (error) {
      console.error("모임통장 초대 오류:", error);
      res.status(500).json({ error: "내부 서버 오류" });
    }
  }
);

// 모임통장 초대 수락
router.get("/join/:invite_code", isAuthenticated, async (req, res) => {
  const { invite_code } = req.params;
  const client_pk = req.session.user.client_pk; // 세션에서 사용자 ID 가져오기

  try {
    // const connection = await mysql.createConnection(dbConfig);
    const connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DB,
    });

    // 초대 정보 확인
    const [invitations] = await connection.execute(
      'SELECT * FROM GroupAccountMember WHERE invite_code = ? AND invite_expiration > NOW() AND invite_status = "pending"',
      [invite_code]
    );

    if (invitations.length === 0) {
      await connection.end();
      return res
        .status(400)
        .json({ error: "유효하지 않거나 만료된 초대입니다." });
    }

    const invitation = invitations[0];

    // 초대된 사용자와 현재 로그인한 사용자가 일치하는지 확인
    if (invitation.client_pk !== client_pk) {
      await connection.end();
      return res
        .status(403)
        .json({ error: "초대된 사용자만 참여할 수 있습니다." });
    }

    // 초대 수락 처리
    await connection.execute(
      'UPDATE GroupAccountMember SET invite_status = "accepted", invite_code = NULL, invite_expiration = NULL WHERE member_pk = ?',
      [invitation.member_pk]
    );

    await connection.end();

    res.json({ success: true, message: "모임통장에 성공적으로 참여했습니다." });
  } catch (error) {
    console.error("모임통장 참여 오류:", error);
    res.status(500).json({ error: "내부 서버 오류" });
  }
});

module.exports = router;
