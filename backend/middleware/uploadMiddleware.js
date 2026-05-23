const multer = require('multer');
const fs = require('fs');
const path = require('path');

const uploadDir = path.join(__dirname, '../../uploads');

const ensureUploadDir = () => {
  fs.mkdirSync(uploadDir, { recursive: true });
};

const safeOriginalName = (name = '') => {
  const ext = path.extname(name).toLowerCase();
  const base = path
    .basename(name, ext)
    .replace(/[^a-z0-9_-]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  return `${base || 'stock'}${ext || '.jpg'}`;
};

// Storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    try {
      ensureUploadDir();
      cb(null, uploadDir);
    } catch (error) {
      cb(new Error('Image upload folder is not writable. Check server uploads permissions.'));
    }
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${safeOriginalName(file.originalname)}`);
  }
});

// File filter (only vegetable images: jpg, jpeg, png)
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (allowedTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file format. Please upload jpg, jpeg, or png.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 2 // 2MB limit
  },
  fileFilter: fileFilter
});

module.exports = upload;
