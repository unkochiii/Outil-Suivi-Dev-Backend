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

// NOTE: Ajoutez rate-limiting sur ces routes (ex: express-rate-limit)
// const rateLimit = require("express-rate-limit");
// const adminLimiter = rateLimit({ windowMs: 15*60*1000, max: 100 });

// Toutes les routes nécessitent auth + admin
router.use(isAuthenticated, isAdmin);

// ═══════════════════════════════════════════════════════
// Générer un mot de passe sécurisé (32 caractères alphanumériques)
// ═══════════════════════════════════════════════════════
const generateSecurePassword = () => {
  return crypto.randomBytes(16).toString("base64url"); // URL-safe
};

// ═══════════════════════════════════════════════════════
// VOIR TOUS LES COMPTES
// GET /admin/accounts
// ═══════════════════════════════════════════════════════
router.get("/admin/accounts", async (req, res) => {
  try {
    const accounts = await Account.find()
      .select("-hash -salt -token")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: accounts.length,
      accounts,
    });
  } catch (error) {
    console.error("Erreur GET /admin/accounts:", error);
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
      "-hash -salt -token"
    );

    if (!account) {
      return res
        .status(404)
        .json({ success: false, error: "Compte non trouvé" });
    }

    res.json({ success: true, account });
  } catch (error) {
    console.error(`Erreur GET /admin/accounts/${req.params.id}:`, error);
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

    // Validation
    if (!email || typeof email !== "string") {
      return res.status(400).json({
        success: false,
        error: "L'email est requis et doit être une chaîne valide",
      });
    }

    // Vérifier si l'email existe déjà
    const existingAccount = await Account.findOne({ email });
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
      await sendPassword(email, password, newAccount.projectName);
    } catch (emailError) {
      console.error("Erreur envoi email:", emailError);
      // Ne pas échouer la création si l'email ne part pas
    }

    res.status(201).json({
      success: true,
      message: "Compte créé ! Mot de passe envoyé par email.",
      account: {
        id: newAccount._id,
        projectName: newAccount.projectName,
        email: newAccount.email,
        role: newAccount.role,
        createdAt: newAccount.createdAt,
      },
    });
  } catch (error) {
    console.error("Erreur POST /admin/accounts:", error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: "Cet email est déjà utilisé",
      });
    }
    res.status(500).json({ success: false, error: "Erreur serveur interne" });
  }
});

// ═══════════════════════════════════════════════════════
// MODIFIER UN COMPTE
// PUT /admin/accounts/:id
// ═══════════════════════════════════════════════════════
router.put("/admin/accounts/:id", validateObjectId, async (req, res) => {
  try {
    const { projectName, email, role, dueDate } = req.body;

    const account = await Account.findById(req.params.id);
    if (!account) {
      return res
        .status(404)
        .json({ success: false, error: "Compte non trouvé" });
    }

    // Vérification de l'unicité de l'email si modifié
    if (email && email !== account.email) {
      const existingAccount = await Account.findOne({
        email: email.toLowerCase().trim(),
        _id: { $ne: req.params.id },
      });
      if (existingAccount) {
        return res.status(409).json({
          success: false,
          error: "Cet email est déjà utilisé par un autre compte",
        });
      }
      account.email = email.toLowerCase().trim();
    }

    if (projectName) account.projectName = projectName.trim();
    if (role) account.role = role;
    if (dueDate !== undefined) account.dueDate = dueDate;

    await account.save();

    res.json({
      success: true,
      message: "Compte modifié avec succès",
      account: {
        id: account._id,
        projectName: account.projectName,
        email: account.email,
        role: account.role,
      },
    });
  } catch (error) {
    console.error(`Erreur PUT /admin/accounts/${req.params.id}:`, error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: "Cet email est déjà utilisé",
      });
    }
    res.status(500).json({ success: false, error: "Erreur serveur interne" });
  }
});

// ═══════════════════════════════════════════════════════
// RÉGÉNÉRER ET RENVOYER UN MOT DE PASSE
// POST /admin/accounts/:id/reset-password
// ═══════════════════════════════════════════════════════
router.post(
  "/admin/accounts/:id/reset-password",
  validateObjectId,
  async (req, res) => {
    try {
      const account = await Account.findById(req.params.id);
      if (!account) {
        return res
          .status(404)
          .json({ success: false, error: "Compte non trouvé" });
      }

      // Générer nouveau mot de passe sécurisé
      const password = generateSecurePassword();

      // Nouveau salt et hash
      account.salt = crypto.randomBytes(16).toString("hex");
      account.hash = crypto
        .pbkdf2Sync(password, account.salt, 1000, 64, "sha512")
        .toString("hex");

      await account.save();

      // Envoyer par email
      try {
        await sendPassword(account.email, password, account.projectName);
      } catch (emailError) {
        console.error("Erreur envoi email:", emailError);
        return res.status(500).json({
          success: false,
          error: "Compte mis à jour mais l'email n'a pas pu être envoyé",
        });
      }

      res.json({
        success: true,
        message: "Nouveau mot de passe envoyé par email",
      });
    } catch (error) {
      console.error(
        `Erreur POST /admin/accounts/${req.params.id}/reset-password:`,
        error
      );
      res.status(500).json({ success: false, error: "Erreur serveur interne" });
    }
  }
);

// ═══════════════════════════════════════════════════════
// SUPPRIMER UN COMPTE
// DELETE /admin/accounts/:id
// ═══════════════════════════════════════════════════════
router.delete("/admin/accounts/:id", validateObjectId, async (req, res) => {
  try {
    // Vérifier si l'utilisateur essaie de se supprimer lui-même
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        error: "Vous ne pouvez pas supprimer votre propre compte",
      });
    }

    const account = await Account.findByIdAndDelete(req.params.id);
    if (!account) {
      return res
        .status(404)
        .json({ success: false, error: "Compte non trouvé" });
    }

    res.json({ success: true, message: "Compte supprimé avec succès" });
  } catch (error) {
    console.error(`Erreur DELETE /admin/accounts/${req.params.id}:`, error);
    res.status(500).json({ success: false, error: "Erreur serveur interne" });
  }
});

module.exports = router;
