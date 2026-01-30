const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Vérification au démarrage
if (!process.env.CLOUDINARY_CLOUD_NAME) {
  console.error("❌ CLOUDINARY_CLOUD_NAME manquant dans .env");
}
if (!process.env.CLOUDINARY_API_KEY) {
  console.error("❌ CLOUDINARY_API_KEY manquant dans .env");
}
if (!process.env.CLOUDINARY_API_SECRET) {
  console.error("❌ CLOUDINARY_API_SECRET manquant dans .env");
}

console.log(
  "☁️ Cloudinary:",
  process.env.CLOUDINARY_CLOUD_NAME ? "OK" : "NON CONFIGURÉ",
);

module.exports = cloudinary;
