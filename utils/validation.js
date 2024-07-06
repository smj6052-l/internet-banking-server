// 중복 사용자 ID 체크
async function checkId(mysqldb, client_id) {
  try {
    const [rows] = await mysqldb
      .promise()
      .query("SELECT * FROM Client WHERE client_id = ?", [client_id]);
    return rows.length === 0;
  } catch (error) {
    throw new Error("Database error");
  }
}

// 이메일 인증 코드 확인
function verifyEmailCode(sessionVerificationCode, verificationCode) {
  if (verificationCode === sessionVerificationCode) {
    return true;
  }
  return false;
}

module.exports = {
  checkId,
  verifyEmailCode,
};
