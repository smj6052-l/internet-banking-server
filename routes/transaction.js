const express = require("express");
const router = express.Router({ mergeParams: true });
const bcrypt = require("bcrypt");

// 계좌 인증 및 비밀번호 확인 함수
const validateAccount = (account_number, account_pw, connection) => {
  return new Promise((resolve, reject) => {
    connection.query(
      "SELECT account_pk, client_pk, account_balance, account_name, account_pw FROM Account WHERE account_number = ?",
      [account_number],
      (error, results) => {
        if (error) return reject(error);
        const account = results[0];
        if (!account) return reject(new Error("계좌를 찾을 수 없습니다."));
        resolve(account);
        if (account_pw) {
          // 계좌 등록 구현 전 까지 일단 주석 처리
          //   bcrypt.compare(account_pw, account.account_pw, (err, match) => {
          //     if (err) return reject(err);
          //     if (!match) return reject(new Error("잘못된 거래 비밀번호입니다."));
          //   });
          resolve(account);
        } else {
          resolve(account);
        }
      }
    );
  });
};

// 계좌 번호로 계좌 조회
const getAccountByNumber = (account_number, connection) => {
  return new Promise((resolve, reject) => {
    connection.query(
      "SELECT account_pk, account_balance, account_name FROM Account WHERE account_number = ?",
      [account_number],
      (error, results) => {
        if (error) return reject(error);
        const account = results[0];
        if (!account) return reject(new Error("계좌를 찾을 수 없습니다."));
        resolve(account);
      }
    );
  });
};

// 송금 처리
router.post("/transfer", async (req, res) => {
  const {
    transaction_origin,
    transaction_destination,
    transaction_amount,
    transaction_origin_memo,
    transaction_destination_memo,
    account_pw,
  } = req.body;
  const mysqldb = req.app.get("mysqldb");

  if (!mysqldb) {
    return res.status(500).json({ error: "데이터베이스 연결 실패" });
  }
  if (
    !transaction_origin ||
    !transaction_destination ||
    !transaction_amount ||
    !account_pw
  ) {
    return res.status(400).json({ error: "유효하지 않은 입력입니다." });
  }

  try {
    // 원본 계좌와 목적지 계좌 정보 가져오기
    const originAccount = await validateAccount(
      transaction_origin,
      account_pw,
      mysqldb
    );

    if (originAccount.account_balance < transaction_amount) {
      return res.status(400).json({ error: "잔액이 부족합니다." });
    }

    // 트랜잭션 시작
    await mysqldb.promise().beginTransaction();

    // 원본 계좌 잔액 업데이트
    const updateOriginBalanceQuery =
      "UPDATE Account SET account_balance = account_balance - ? WHERE account_pk = ?";
    await mysqldb
      .promise()
      .query(updateOriginBalanceQuery, [
        transaction_amount,
        originAccount.account_pk,
      ]);

    const destinationAccount = await getAccountByNumber(
      transaction_destination,
      mysqldb
    );
    if (!destinationAccount) {
      return res.status(400).json({ error: "목적지 계좌를 찾을 수 없습니다." });
    }
    // 목적지 계좌 잔액 업데이트
    const updateDestinationBalanceQuery =
      "UPDATE Account SET account_balance = account_balance + ? WHERE account_pk = ?";
    await mysqldb
      .promise()
      .query(updateDestinationBalanceQuery, [
        transaction_amount,
        destinationAccount.account_pk,
      ]);
    const originNewBalance =
      parseInt(originAccount.account_balance) - transaction_amount;
    const destinationNewBalance =
      parseInt(destinationAccount.account_balance) + transaction_amount;
    // 트랜잭션 기록 추가 - 원본 계좌
    const insertOriginTransactionQuery = `
        INSERT INTO TransactionHistory (transaction_name, transaction_type, transaction_amount, transaction_balance, transaction_origin, transaction_destination, transaction_memo)
        VALUES (?, ?, ?, ?, ?, ?, ?)`;
    await mysqldb
      .promise()
      .query(insertOriginTransactionQuery, [
        `To ${destinationAccount.account_name}`,
        "Transfer",
        -transaction_amount,
        originNewBalance,
        originAccount.account_pk,
        destinationAccount.account_pk,
        transaction_origin_memo,
      ]);

    // 트랜잭션 기록 추가 - 목적지 계좌
    const insertDestinationTransactionQuery = `
        INSERT INTO TransactionHistory (transaction_name, transaction_type, transaction_amount, transaction_balance, transaction_origin, transaction_destination, transaction_memo)
        VALUES (?, ?, ?, ?, ?, ?, ?)`;
    await mysqldb
      .promise()
      .query(insertDestinationTransactionQuery, [
        `From ${originAccount.account_name}`,
        "Transfer",
        transaction_amount,
        destinationNewBalance,
        originAccount.account_pk,
        destinationAccount.account_pk,
        transaction_destination_memo,
      ]);

    // 트랜잭션 커밋
    await mysqldb.promise().commit();
    res.status(200).json({
      message: "이체가 성공적으로 완료되었습니다.",
    });
  } catch (error) {
    // 트랜잭션 롤백
    await mysqldb.promise().rollback();
    console.error("Transaction failed: ", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 계좌 내 거래 (가져오기)
router.post("/import", async (req, res) => {
  const {
    transaction_origin,
    transaction_destination,
    transaction_amount,
    transaction_origin_memo,
    transaction_destination_memo,
  } = req.body;

  const mysqldb = req.app.get("mysqldb");

  if (!transaction_origin || !transaction_destination || !transaction_amount) {
    return res.status(400).json({ error: "유효하지 않은 입력입니다." });
  }

  if (transaction_origin === transaction_destination) {
    return res.status(400).json({ error: "같은 계좌로 송금할 수 없습니다." });
  }

  const amount = parseInt(transaction_amount, 10);

  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: "유효한 금액을 입력해주세요." });
  }

  try {
    const originAccount = await getAccountByNumber(transaction_origin, mysqldb);
    const destinationAccount = await getAccountByNumber(
      transaction_destination,
      mysqldb
    );

    if (!originAccount || !destinationAccount) {
      return res.status(400).json({ error: "계좌를 찾을 수 없습니다." });
    }

    if (originAccount.account_balance < amount) {
      return res.status(400).json({ error: "잔액이 부족합니다." });
    }

    await mysqldb.promise().beginTransaction();

    const updateOriginBalanceQuery =
      "UPDATE Account SET account_balance = account_balance - ? WHERE account_pk = ?";
    await mysqldb
      .promise()
      .query(updateOriginBalanceQuery, [amount, originAccount.account_pk]);

    const updateDestinationBalanceQuery =
      "UPDATE Account SET account_balance = account_balance + ? WHERE account_pk = ?";
    await mysqldb
      .promise()
      .query(updateDestinationBalanceQuery, [
        amount,
        destinationAccount.account_pk,
      ]);

    const originNewBalance = parseInt(originAccount.account_balance) - amount;
    const destinationNewBalance =
      parseInt(destinationAccount.account_balance) + amount;

    const insertOriginTransactionQuery = `
        INSERT INTO TransactionHistory (transaction_name, transaction_type, transaction_amount, transaction_balance, transaction_origin, transaction_destination, transaction_memo)
        VALUES (?, ?, ?, ?, ?, ?, ?)`;
    await mysqldb
      .promise()
      .query(insertOriginTransactionQuery, [
        `To ${destinationAccount.account_name}`,
        "Import",
        -amount,
        originNewBalance,
        originAccount.account_pk,
        destinationAccount.account_pk,
        transaction_origin_memo,
      ]);

    const insertDestinationTransactionQuery = `
        INSERT INTO TransactionHistory (transaction_name, transaction_type, transaction_amount, transaction_balance, transaction_origin, transaction_destination, transaction_memo)
        VALUES (?, ?, ?, ?, ?, ?, ?)`;
    await mysqldb
      .promise()
      .query(insertDestinationTransactionQuery, [
        `From ${originAccount.account_name}`,
        "Import",
        amount,
        destinationNewBalance,
        originAccount.account_pk,
        destinationAccount.account_pk,
        transaction_destination_memo,
      ]);

    await mysqldb.promise().commit();
    res.status(200).json({
      message: "가져오기가 성공적으로 완료되었습니다.",
    });
  } catch (error) {
    await mysqldb.promise().rollback();
    console.error("Transaction failed: ", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 입출금 거래 내역 상세 확인
router.get("/:transactionId", async (req, res) => {
  const { id, transactionId } = req.params;
  const mysqldb = req.app.get("mysqldb");

  try {
    const [results] = await mysqldb
      .promise()
      .query(
        "SELECT * FROM TransactionHistory WHERE transaction_pk = ? AND (transaction_origin = ? OR transaction_destination = ?)",
        [transactionId, id, id]
      );

    if (results.length === 0) {
      return res.status(404).json({ error: "거래를 찾을 수 없습니다." });
    }

    res.status(200).json(results[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 입출금 내역 확인
router.get("/", async (req, res) => {
  const { id } = req.params;
  console.log(id);
  const mysqldb = req.app.get("mysqldb");

  try {
    const [results] = await mysqldb
      .promise()
      .query(
        "SELECT * FROM TransactionHistory WHERE transaction_origin = ? OR transaction_destination = ? ORDER BY transaction_date DESC",
        [id, id]
      );

    res.status(200).json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/search", async (req, res) => {
  const { id } = req.params; // 계좌 ID
  const {
    title,
    period,
    type,
    startDate: bodyStartDate,
    endDate: bodyEndDate,
    sortOrder,
  } = req.body; // 검색어, 기간, 거래 유형, 시작 날짜, 종료 날짜, 정렬 순서
  const mysqldb = req.app.get("mysqldb");

  // 유효성 검사
  if (!id) {
    return res.status(400).json({ error: "Account ID is required" });
  }

  let query = `
        SELECT * FROM TransactionHistory 
        WHERE (transaction_origin = ? OR transaction_destination = ?)
      `;
  const params = [id, id];

  if (title) {
    query += " AND transaction_name LIKE ?";
    params.push(`%${title}%`);
  }

  let currentDate = new Date();
  let startDate = null;
  let endDate = null;

  switch (period) {
    case "1_month":
      startDate = new Date(currentDate.setMonth(currentDate.getMonth() - 1))
        .toISOString()
        .split("T")[0];
      break;
    case "3_months":
      startDate = new Date(currentDate.setMonth(currentDate.getMonth() - 3))
        .toISOString()
        .split("T")[0];
      break;
    case "last_month":
      startDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - 1,
        1
      )
        .toISOString()
        .split("T")[0];
      endDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0)
        .toISOString()
        .split("T")[0];
      break;
    case "custom":
      startDate = bodyStartDate;
      endDate = bodyEndDate;
      break;
    default:
      break;
  }

  if (startDate && endDate) {
    query += " AND transaction_date BETWEEN ? AND ?";
    params.push(startDate, endDate);
  } else if (startDate) {
    query += " AND transaction_date >= ?";
    params.push(startDate);
  }

  if (type && type !== "all") {
    query += " AND transaction_type = ?";
    params.push(type);
  }

  switch (sortOrder) {
    case "latest":
      query += " ORDER BY transaction_date DESC";
      break;
    case "past":
      query += " ORDER BY transaction_date ASC";
      break;
    default:
      break;
  }

  if (!title && !period && !type) {
    query += " LIMIT 50";
  }

  try {
    const [results] = await mysqldb.promise().query(query, params);
    res.status(200).json(results);
  } catch (err) {
    console.error("Database query error: ", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 메모 확인
router.post("/:transactionId/memo", async (req, res) => {
  const { id, transactionId } = req.params;
  const mysqldb = req.app.get("mysqldb");

  try {
    const [results] = await mysqldb
      .promise()
      .query(
        "SELECT transaction_memo FROM TransactionHistory WHERE transaction_pk = ? AND (transaction_origin = ? OR transaction_destination = ?)",
        [transactionId, id, id]
      );

    res.status(200).json(results[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 메모 추가
router.post("/:transactionId/memo/enter", async (req, res) => {
  const { id, transactionId } = req.params;
  const { transaction_memo } = req.body;
  const mysqldb = req.app.get("mysqldb");

  try {
    // 기존 메모가 있는지 확인
    const [existingMemo] = await mysqldb
      .promise()
      .query(
        "SELECT transaction_memo FROM TransactionHistory WHERE transaction_pk = ? AND (transaction_origin = ? OR transaction_destination = ?)",
        [transactionId, id, id]
      );

    if (existingMemo.length > 0 && existingMemo[0].transaction_memo) {
      return res.status(400).json({ error: "메모가 이미 존재합니다." });
    }

    // 메모 추가
    await mysqldb
      .promise()
      .query(
        "UPDATE TransactionHistory SET transaction_memo = ? WHERE transaction_pk = ? AND (transaction_origin = ? OR transaction_destination = ?)",
        [transaction_memo, transactionId, id, id]
      );

    res.status(200).json({ message: "메모가 성공적으로 추가되었습니다." });
  } catch (err) {
    console.error("Database query error: ", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 메모 삭제
router.post("/:transactionId/memo/delete", async (req, res) => {
  const { id, transactionId } = req.params;
  const mysqldb = req.app.get("mysqldb");

  try {
    await mysqldb
      .promise()
      .query(
        "UPDATE TransactionHistory SET transaction_memo = NULL WHERE transaction_pk = ? AND (transaction_origin = ? OR transaction_destination = ?)",
        [transactionId, id, id]
      );

    res.status(200).json({ message: "메모가 성공적으로 삭제되었습니다." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 메모 업데이트
router.post("/:transactionId/memo/update", async (req, res) => {
  const { id, transactionId } = req.params;
  const { transaction_memo } = req.body;
  const mysqldb = req.app.get("mysqldb");

  try {
    await mysqldb
      .promise()
      .query(
        "UPDATE TransactionHistory SET transaction_memo = ? WHERE transaction_pk = ? AND (transaction_origin = ? OR transaction_destination = ?)",
        [transaction_memo, transactionId, id, id]
      );

    res.status(200).json({ message: "메모가 성공적으로 업데이트되었습니다." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
