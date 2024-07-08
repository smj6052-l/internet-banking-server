const sha256 = require("sha256");

function isAuthenticated(req, res, next) {
  if (req.session && req.session.client) {
    const mysqldb = req.app.get("mysqldb");
    const saltDB = req.app.get("saltDB");

    const client_id = req.session.client.client_id;

    saltDB
      .promise()
      .query("SELECT Ssalt FROM SessionSalt WHERE client_id = ?", [client_id])
      .then(([rows]) => {
        if (rows.length === 0) {
          return res
            .status(401)
            .json({ error: "세션 소금을 찾을 수 없습니다." });
        }
        const Ssalt = rows[0].Ssalt;

        const decryptedUser = decrypt(req.session.client, key, iv);
        if (sha256(decryptedUser + Ssalt) === req.session.decryptedUser) {
          req.session.userDecrypted = decryptedUser;
          return next();
        } else {
          return res.status(401).json({ error: "유효하지 않은 세션입니다." });
        }
      })
      .catch((error) => {
        console.error("세션 소금 가져오기 오류:", error);
        return res.status(500).json({ error: "내부 서버 오류" });
      });
  } else {
    return res.status(401).json({ error: "로그인해주세요." });
  }
}

module.exports = { isAuthenticated };
