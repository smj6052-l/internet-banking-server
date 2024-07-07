const express = require("express");
const router = express.Router({ mergeParams: true });
const bcrypt = require("bcrypt");

// 계좌 인증 및 비밀번호 확인 함수
const validateAccount = (
  accountNumber,
  transactionPassword,
  connection,
  callback
) => {
  connection.query(
    "SELECT account_pk, client_pk, account_balance, account_name, account_password FROM Account WHERE account_number = ?",
    [accountNumber],
    (error, results) => {
      if (error) return callback(error);
      const account = results[0];
      if (!account) return callback(new Error("Account not found"));

      bcrypt.compare(
        transactionPassword,
        account.account_password,
        (err, match) => {
          if (err) return callback(err);
          if (!match)
            return callback(new Error("Invalid transaction password"));
          callback(null, account);
        }
      );
    }
  );
};

// 송금 처리
router.post("/transfer", (req, res) => {
  const {
    transaction_origin,
    transaction_destination,
    transaction_amount,
    transaction_origin_memo,
    transaction_destination_memo,
    transaction_password,
  } = req.body;

  const { mysqldb } = req.app.get("mysqldb");

  if (
    !transaction_origin ||
    !transaction_destination ||
    !transaction_amount ||
    !transaction_password
  ) {
    return res.status(400).send({ error: "Invalid input" });
  }

  mysqldb.beginTransaction((err) => {
    if (err) return res.status(500).send({ error: err.message });

    validateAccount(
      transaction_origin,
      transaction_password,
      mysqldb,
      (error, originAccount) => {
        if (error) {
          return mysqldb.rollback(() => {
            res.status(500).send({ error: error.message });
          });
        }

        validateAccount(
          transaction_destination,
          transaction_password,
          mysqldb,
          (error, destinationAccount) => {
            if (error) {
              return mysqldb.rollback(() => {
                res.status(500).send({ error: error.message });
              });
            }

            const updateOriginBalanceQuery =
              "UPDATE Account SET account_balance = account_balance - ? WHERE account_pk = ?";
            mysqldb.query(
              updateOriginBalanceQuery,
              [transaction_amount, originAccount.account_pk],
              (error) => {
                if (error) {
                  return mysqldb.rollback(() => {
                    res.status(500).send({ error: error.message });
                  });
                }

                const updateDestinationBalanceQuery =
                  "UPDATE Account SET account_balance = account_balance + ? WHERE account_pk = ?";
                mysqldb.query(
                  updateDestinationBalanceQuery,
                  [transaction_amount, destinationAccount.account_pk],
                  (error) => {
                    if (error) {
                      return mysqldb.rollback(() => {
                        res.status(500).send({ error: error.message });
                      });
                    }

                    const insertOriginTransactionQuery = `
              INSERT INTO TransactionHistory (transaction_name, transaction_type, transaction_amount, transaction_balance, transaction_origin, transaction_destination, transaction_memo)
              VALUES (?, ?, ?, ?, ?, ?, ?)`;
                    mysqldb.query(
                      insertOriginTransactionQuery,
                      [
                        `To ${destinationAccount.account_name}`,
                        "Debit",
                        transaction_amount,
                        originAccount.account_balance - transaction_amount,
                        originAccount.account_pk,
                        destinationAccount.account_pk,
                        transaction_origin_memo,
                      ],
                      (error) => {
                        if (error) {
                          return mysqldb.rollback(() => {
                            res.status(500).send({ error: error.message });
                          });
                        }

                        const insertDestinationTransactionQuery = `
                INSERT INTO TransactionHistory (transaction_name, transaction_type, transaction_amount, transaction_balance, transaction_origin, transaction_destination, transaction_memo)
                VALUES (?, ?, ?, ?, ?, ?, ?)`;
                        mysqldb.query(
                          insertDestinationTransactionQuery,
                          [
                            `From ${originAccount.account_name}`,
                            "Credit",
                            transaction_amount,
                            destinationAccount.account_balance +
                              transaction_amount,
                            originAccount.account_pk,
                            destinationAccount.account_pk,
                            transaction_destination_memo,
                          ],
                          (error) => {
                            if (error) {
                              return mysqldb.rollback(() => {
                                res.status(500).send({ error: error.message });
                              });
                            }

                            mysqldb.commit((err) => {
                              if (err) {
                                return mysqldb.rollback(() => {
                                  res.status(500).send({ error: err.message });
                                });
                              }
                              res
                                .status(200)
                                .send({ message: "Transfer successful" });
                            });
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  });
});

// 계좌 내 거래 (가져오기)
router.post("/import", (req, res) => {
  const {
    transaction_origin,
    transaction_destination,
    transaction_amount,
    transaction_origin_memo,
    transaction_destination_memo,
    transaction_password,
  } = req.body;

  const { mysqldb } = req.app.get("mysqldb");

  if (
    !transaction_origin ||
    !transaction_destination ||
    !transaction_amount ||
    !transaction_password
  ) {
    return res.status(400).send({ error: "Invalid input" });
  }

  mysqldb.beginTransaction((err) => {
    if (err) return res.status(500).send({ error: err.message });

    validateAccount(
      transaction_origin,
      transaction_password,
      mysqldb,
      (error, originAccount) => {
        if (error) {
          return mysqldb.rollback(() => {
            res.status(500).send({ error: error.message });
          });
        }

        validateAccount(
          transaction_destination,
          transaction_password,
          mysqldb,
          (error, destinationAccount) => {
            if (error) {
              return mysqldb.rollback(() => {
                res.status(500).send({ error: error.message });
              });
            }

            const updateOriginBalanceQuery =
              "UPDATE Account SET account_balance = account_balance - ? WHERE account_pk = ?";
            mysqldb.query(
              updateOriginBalanceQuery,
              [transaction_amount, originAccount.account_pk],
              (error) => {
                if (error) {
                  return mysqldb.rollback(() => {
                    res.status(500).send({ error: error.message });
                  });
                }

                const updateDestinationBalanceQuery =
                  "UPDATE Account SET account_balance = account_balance + ? WHERE account_pk = ?";
                mysqldb.query(
                  updateDestinationBalanceQuery,
                  [transaction_amount, destinationAccount.account_pk],
                  (error) => {
                    if (error) {
                      return mysqldb.rollback(() => {
                        res.status(500).send({ error: error.message });
                      });
                    }

                    const insertOriginTransactionQuery = `
              INSERT INTO TransactionHistory (transaction_name, transaction_type, transaction_amount, transaction_balance, transaction_origin, transaction_destination, transaction_memo)
              VALUES (?, ?, ?, ?, ?, ?, ?)`;
                    mysqldb.query(
                      insertOriginTransactionQuery,
                      [
                        `To ${destinationAccount.account_name}`,
                        "Debit",
                        transaction_amount,
                        originAccount.account_balance - transaction_amount,
                        originAccount.account_pk,
                        destinationAccount.account_pk,
                        transaction_origin_memo,
                      ],
                      (error) => {
                        if (error) {
                          return mysqldb.rollback(() => {
                            res.status(500).send({ error: error.message });
                          });
                        }

                        const insertDestinationTransactionQuery = `
                INSERT INTO TransactionHistory (transaction_name, transaction_type, transaction_amount, transaction_balance, transaction_origin, transaction_destination, transaction_memo)
                VALUES (?, ?, ?, ?, ?, ?, ?)`;
                        mysqldb.query(
                          insertDestinationTransactionQuery,
                          [
                            `From ${originAccount.account_name}`,
                            "Credit",
                            transaction_amount,
                            destinationAccount.account_balance +
                              transaction_amount,
                            originAccount.account_pk,
                            destinationAccount.account_pk,
                            transaction_destination_memo,
                          ],
                          (error) => {
                            if (error) {
                              return mysqldb.rollback(() => {
                                res.status(500).send({ error: error.message });
                              });
                            }

                            mysqldb.commit((err) => {
                              if (err) {
                                return mysqldb.rollback(() => {
                                  res.status(500).send({ error: err.message });
                                });
                              }
                              res
                                .status(200)
                                .send({ message: "Import successful" });
                            });
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  });
});

// 메모 확인
router.post("/:transactionId/memo", (req, res) => {
  const { id, transactionId } = req.params;
  const { mysqldb } = req.app.get("mysqldb");

  mysqldb.query(
    "SELECT transaction_memo FROM TransactionHistory WHERE transaction_pk = ? AND (transaction_origin = ? OR transaction_destination = ?)",
    [transactionId, id, id],
    (err, results) => {
      if (err) return res.status(500).send({ error: err.message });
      const memo = results[0];
      res.status(200).send(memo);
    }
  );
});

// 메모 추가
router.post("/:transactionId/memo/enter", (req, res) => {
  const { id, transactionId } = req.params;
  const { memo } = req.body;
  const { mysqldb } = req.app.get("mysqldb");

  mysqldb.query(
    "UPDATE TransactionHistory SET transaction_memo = ? WHERE transaction_pk = ? AND (transaction_origin = ? OR transaction_destination = ?)",
    [memo, transactionId, id, id],
    (err) => {
      if (err) return res.status(500).send({ error: err.message });
      res.status(200).send({ message: "Memo added successfully" });
    }
  );
});

// 메모 삭제
router.post("/:transactionId/memo/delete", (req, res) => {
  const { accountId, transactionId } = req.params;
  const { mysqldb } = req.app.get("mysqldb");

  mysqldb.query(
    "UPDATE TransactionHistory SET transaction_memo = NULL WHERE transaction_pk = ? AND (transaction_origin = ? OR transaction_destination = ?)",
    [transactionId, id, id],
    (err) => {
      if (err) return res.status(500).send({ error: err.message });
      res.status(200).send({ message: "Memo deleted successfully" });
    }
  );
});

// 메모 업데이트
router.post("/:transactionId/memo/update", (req, res) => {
  const { id, transactionId } = req.params;
  const { memo } = req.body;
  const { mysqldb } = req.app.get("mysqldb");

  mysqldb.query(
    "UPDATE TransactionHistory SET transaction_memo = ? WHERE transaction_pk = ? AND (transaction_origin = ? OR transaction_destination = ?)",
    [memo, transactionId, id, id],
    (err) => {
      if (err) return res.status(500).send({ error: err.message });
      res.status(200).send({ message: "Memo updated successfully" });
    }
  );
});

module.exports = router;
