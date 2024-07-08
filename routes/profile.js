const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB 이하로 제한
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only .png, .jpeg, .jpg format allowed!"));
    }
  },
});

router.post("/upload", upload.single("client_photo"), async (req, res) => {
  try {
    const client_id = req.session.client_id; // 클라이언트 ID를 요청 본문에서 가져옴
    const photo = req.file.buffer; // 업로드된 파일의 버퍼

    // 데이터베이스 연결
    const mysqldb = req.app.get("mysqldb");

    // 클라이언트 사진 업데이트
    const query = "UPDATE Client SET client_photo = ? WHERE client_id = ?";
    mysqldb.query(query, [photo, client_id], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Database error" });
      }
      res.status(200).json({ message: "File uploaded successfully" });
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/:client_id", async (req, res) => {
  try {
    const client_id = req.params.client_id;

    // 데이터베이스 연결
    const mysqldb = req.app.get("mysqldb");

    // 클라이언트 사진 조회
    const query = "SELECT client_photo FROM Client WHERE client_id = ?";
    mysqldb.query(query, [client_id], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Database error" });
      }

      if (result.length === 0 || !result[0].client_photo) {
        return res.status(404).json({ message: "Photo not found" });
      }

      res.setHeader("Content-Type", "image/jpeg");
      res.send(result[0].client_photo);
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
