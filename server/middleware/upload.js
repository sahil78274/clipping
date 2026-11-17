// server/middleware/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Sanitize extension and create safe random name
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 10)}${ext}`;
    cb(null, safeName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExts = ['.mp4', '.mov', '.webm', '.mkv', '.avi'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported video format (${ext}). Allowed formats: MP4, MOV, WebM, MKV, AVI`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500 MB max
  }
});

module.exports = upload;
