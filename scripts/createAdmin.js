// scripts/createAdmin.js
require("dotenv").config();
const mongoose = require("mongoose");
const crypto = require("crypto");
const Account = require("../models/Account");

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connecté à MongoDB");

    const existingAdmin = await Account.findOne({ role: "admin" });
    if (existingAdmin) {
      console.log("⚠️ Un admin existe déjà :", existingAdmin.email);
      process.exit(0);
    }

    const password = "080205"; // ⚠️ À changer après !

    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto
      .pbkdf2Sync(password, salt, 1000, 64, "sha512")
      .toString("hex");

    const admin = new Account({
      projectName: "Admin",
      email: "anais.picaut@gmail.com", // ⚠️ Mets ton vrai email
      salt,
      hash,
      role: "admin",
      dueDate: "aucune je suis l'admin hehehe",
    });

    await admin.save();

    console.log("Admin créé !");
    console.log("Email:", admin.email);

    process.exit(0);
  } catch (error) {
    console.error("❌ Erreur:", error.message);
    process.exit(1);
  }
};

createAdmin();
