const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt"); // sha256 사용할 예정이라 사용안해도 됨 임시로 적용.
const dotenv = require("dotenv");
const { validationResult } = require("express-validator");

dotenv.config();

// 계좌 번호 생성 함수 (33??-??-??????) 형식
async function generateAccountNumber(connection) {
  let account_number;
  let isUnique = false;

  while (!isUnique) {
    const part1 = `33${Math.floor(10 + Math.random() * 90)}`;
    const part2 = Math.floor(10 + Math.random() * 90);
    const part3 = Math.floor(100000 + Math.random() * 900000);
    account_number = `${part1}-${part2}-${part3}`;

    const [existingAccount] = await connection
      .promise()
      .query("SELECT 1 FROM Account WHERE account_number = ?", [
        account_number,
      ]);
    if (existingAccount.length === 0) {
      isUnique = true;
    }
  }

  return account_number;
}

// POST: 새 계좌 생성 (입력정보 유효성 검사 처리 필요)
router.post("/open", async (req, res) => {
  const client_pk = req.session.client.client_pk;
  const { account_name, account_type, account_pw, day_transfer_limit } =
    req.body;
  const account_balance = 0;
  const account_reg_date = new Date();
  let account_number;

  const mysqldb = req.app.get("mysqldb");
  try {
    mysqldb.connect();

    // 계좌 번호 생성
    account_number = await generateAccountNumber(mysqldb);
    // 계좌 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(account_pw, 10);

    // 새 계좌 데이터 삽입
    const [result] = await mysqldb
      .promise()
      .query(
        "INSERT INTO Account (client_pk, account_number, account_name, account_type, account_balance, account_pw, account_reg_date, day_transfer_limit, account_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          client_pk,
          account_number,
          account_name,
          account_type,
          account_balance,
          hashedPassword,
          account_reg_date,
          day_transfer_limit,
          "active",
        ]
      );

    // 모임통장인 경우 처리
    if (account_type === "모임통장") {
      await mysqldb
        .promise()
        .query("INSERT INTO `Group` (account_pk, group_name) VALUES (?, ?)", [
          result.insertId,
          account_name,
        ]);

      // GroupAccountMember 테이블에 소유자 추가
      await mysqldb
        .promise()
        .query(
          "INSERT INTO GroupAccountMember (group_pk, account_pk, client_pk, member_role) VALUES ((SELECT group_pk FROM `Group` WHERE account_pk = ?), ?, ?, ?)",
          [result.insertId, result.insertId, client_pk, "owner"]
        );
    }

    res.status(201).json({ message: "계좌 생성 완료" });
  } catch (error) {
    console.error("계좌 생성 오류:", error);
    res.status(500).json({ error: "내부 서버 오류" });
  }
});

// GET: 로그인된 사용자의 계좌 목록
router.get("/", async (req, res) => {
  const mysqldb = req.app.get("mysqldb");
  const client_pk = req.session.client.client_pk;
  const client_name = req.session.client.client_name;

  // let connection;
  try {
    // 연결 풀에서 연결 가져오기
    mysqldb.connect();

    // 계좌 메타데이터 조회
    const [accountInfo] = await mysqldb
      .promise()
      .query(
        "SELECT account_pk, account_name, account_balance, account_number FROM Account WHERE client_pk = ?",
        [client_pk]
      );

    res.json({ client: client_name, accounts: accountInfo });
  } catch (error) {
    console.error("계좌 조회 오류:", error);
    res.status(500).json({ error: "내부 서버 오류" });
  } finally {
    // if (connection) {
    //   // 연결 반환
    //   await connection.release();
    // }
  }
});

// 로그인된 사용자의 특정 계좌 정보 조회
router.get(
  "/:accountId",
  [param("accountId").isInt().withMessage("유효하지 않은 계좌 ID입니다")],
  async (req, res) => {
    const { accountId } = req.params;
    const client_pk = req.session.user.client_pk;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const connection = await mysql.createConnection(dbConfig);
      const [rows] = await connection.execute(
        "SELECT account_name, account_balance, account_number FROM Account WHERE account_pk = ? AND client_pk = ?",
        [accountId, client_pk]
      );
      // 조회 목록: 계좌 별칭, 잔액 , 계좌 번호
      await connection.end();

      if (rows.length === 0) {
        return res.status(404).json({ error: "계좌를 찾을 수 없습니다" });
      }
      res.json({ account: rows[0] });
    } catch (error) {
      console.error("계좌 조회 오류:", error);
      res.status(500).json({ error: "내부 서버 오류" });
    }
  }
);

module.exports = router;
