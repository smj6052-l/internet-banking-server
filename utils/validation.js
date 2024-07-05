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

// 중복 전화번호 체크
async function checkPhone(mysqldb, client_phone) {
  try {
    const [rows] = await mysqldb
      .promise()
      .query("SELECT * FROM Client WHERE client_phone = ?", [client_phone]);
    return rows.length === 0;
  } catch (error) {
    throw new Error("Database error");
  }
}

// 중복 주민등록번호 체크
async function checkResi(mysqldb, client_resi) {
  try {
    const [rows] = await mysqldb
      .promise()
      .query("SELECT * FROM Client WHERE client_resi = ?", [client_resi]);
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
  checkPhone,
  checkResi,
  verifyEmailCode,
};
