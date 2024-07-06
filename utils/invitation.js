// utils/invitation.js
const { v4: uuidv4 } = require('uuid');

// 초대장 생성 함수
async function createInvitation(mysqldb, inviterId, inviteeEmail) {
  const inviteKey = uuidv4();
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + 7); // 7일 후 만료

  try {
    await mysqldb.promise().query(
      'INSERT INTO Invitations (inviter_id, invitee_email, invite_key, is_used, expiration_date) VALUES (?, ?, ?, ?, ?)',
      [inviterId, inviteeEmail, inviteKey, false, expirationDate]
    );
    return inviteKey;
  } catch (error) {
    console.error('초대장 생성 오류:', error);
    throw new Error('Database error');
  }
}

// 초대장 확인 함수
async function verifyInvitation(mysqldb, inviteKey) {
  try {
    const [invitations] = await mysqldb.promise().query(
      'SELECT * FROM Invitations WHERE invite_key = ? AND is_used = false AND expiration_date > NOW()',
      [inviteKey]
    );
    return invitations.length > 0 ? invitations[0] : null;
  } catch (error) {
    console.error('초대장 확인 오류:', error);
    throw new Error('Database error');
  }
}

// 초대장 사용 처리 함수
async function useInvitation(mysqldb, invitationId) {
  try {
    await mysqldb.promise().query(
      'UPDATE Invitations SET is_used = true WHERE id = ?',
      [invitationId]
    );
  } catch (error) {
    console.error('초대장 사용 처리 오류:', error);
    throw new Error('Database error');
  }
}

module.exports = {
  createInvitation,
  verifyInvitation,
  useInvitation,
};