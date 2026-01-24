const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const mongoose = require("mongoose");
const Account = require("../../../models/Account");
const { isAuthenticated, isAdmin } = require("../../../middlewares/auth");
const { sendPassword } = require("../../../services/mailer");

// Middleware de validation d'ID MongoDB
const validateObjectId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: "ID de compte invalide" });
  }
  next();
};

// Toutes les routes nécessitent auth + admin
router.use(isAuthenticated, isAdmin);

// ═══════════════════════════════════════════════════════
// Générer un mot de passe sécurisé (32 caractères alphanumériques)
// ═══════════════════════════════════════════════════════
const generateSecurePassword = () => {
  return crypto.randomBytes(16).toString("base64url");
};

// ═══════════════════════════════════════════════════════
// VOIR TOUS LES COMPTES
// GET /admin/accounts
// ═══════════════════════════════════════════════════════
router.get("/admin/accounts", async (req, res) => {
  try {
    const accounts = await Account.find()
      .select("projectName email role createdAt")
      .sort({ projectName: 1 }) // Tri par nom de projet alphabétique
      .lean(); // Optimisation : retourne des objets JS simples

    // MAPPER les données pour correspondre à l'attente du frontend
    const mappedAccounts = accounts.map((account) => ({
      _id: account._id,
      username: account.projectName || "Sans nom", // 🔥 Mapping critique
      email: account.email,
      role: account.role,
      createdAt: account.createdAt,
    }));

    res.json({
      success: true,
      count: mappedAccounts.length,
      accounts: mappedAccounts,
    });
  } catch (error) {
    console.error("❌ Erreur GET /admin/accounts:", error);
    res.status(500).json({ success: false, error: "Erreur serveur interne" });
  }
});

// ═══════════════════════════════════════════════════════
// VOIR UN COMPTE
// GET /admin/accounts/:id
// ═══════════════════════════════════════════════════════
router.get("/admin/accounts/:id", validateObjectId, async (req, res) => {
  try {
    const account = await Account.findById(req.params.id).select(
      "-hash -salt -token",
    );

    if (!account) {
      return res
        .status(404)
        .json({ success: false, error: "Compte non trouvé" });
    }

    // MAPPER aussi pour le détail d'un compte
    const mappedAccount = {
      _id: account._id,
      username: account.projectName || "Sans nom", // 🔥 Mapping ici aussi
      email: account.email,
      role: account.role,
      dueDate: account.dueDate,
      createdAt: account.createdAt,
    };

    res.json({ success: true, account: mappedAccount });
  } catch (error) {
    console.error(`❌ Erreur GET /admin/accounts/${req.params.id}:`, error);
    res.status(500).json({ success: false, error: "Erreur serveur interne" });
  }
});

// ═══════════════════════════════════════════════════════
// CRÉER UN COMPTE
// POST /admin/accounts
// ═══════════════════════════════════════════════════════
router.post("/admin/accounts", async (req, res) => {
  try {
    const { projectName, email, role, dueDate } = req.body;

    // Validation renforcée
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({
        success: false,
        error: "Email invalide",
      });
    }

    // Vérifier si l'email existe déjà
    const existingAccount = await Account.findOne({
      email: email.toLowerCase().trim(),
    });
    if (existingAccount) {
      return res.status(409).json({
        success: false,
        error: "Cet email est déjà utilisé",
      });
    }

    // Générer mot de passe sécurisé
    const password = generateSecurePassword();

    // Créer salt et hash
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto
      .pbkdf2Sync(password, salt, 1000, 64, "sha512")
      .toString("hex");

    // Créer le compte
    const newAccount = new Account({
      projectName: projectName?.trim() || "Mon Projet",
      email: email.toLowerCase().trim(),
      salt,
      hash,
      role: role || "user",
      dueDate,
    });

    await newAccount.save();

    // Envoyer le mot de passe par email
    try {
      await sendPassword(newAccount.email, password, newAccount.projectName);
    } catch (emailError) {
      console.error("❌ Erreur envoi email:", emailError);
      // Ne pas échouer la création si l'email ne part pas
    }

    // RETOURNER avec le mapping username
    res.status(201).json({
      success: true,
      message: "Compte créé ! Mot de passe envoyé par email.",
      account: {
        id: newAccount._id,
        username: newAccount.projectName, // 🔥 Mapping pour le frontend
        email: newAccount.email,
        role: newAccount.role,
        createdAt: newAccount.createdAt,
      },
    });
  } catch (error) {
    console.error("❌ Erreur POST /admin/accounts:", error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: "Cet email est déjà utilisé",
      });
    }
    res.status(500).json({ success: false, error: "Erreur serveur interne" });
  }
});

// ... le reste du code reste identique ...

module.exports = router;
