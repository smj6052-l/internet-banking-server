// 로그인 세션 확인
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  } else {
    return res.status(401).json({ error: "로그인 해주세요" });
  }
}

module.exports = { isAuthenticated };
