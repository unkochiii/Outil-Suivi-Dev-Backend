const multer = require("multer");

// ✅ Memory storage - pas besoin de dossier, fonctionne partout
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Seules les images sont autorisées (jpeg, jpg, png, gif, webp)",
        ),
      );
    }
  },
});

module.exports = upload;
