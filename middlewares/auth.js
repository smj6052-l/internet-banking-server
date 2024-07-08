const authMiddleware = (req, res, next) => {
  if (req.session && req.session.client) {
    next();
  } else {
    res.status(401).json({ message: "로그인이 필요합니다." });
  }
};

module.exports = authMiddleware;
