const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const Account = require("../../../models/Account");
const { isAuthenticated } = require("../../../middlewares/auth");

// NOTE: Ajoutez rate-limiting sur cette route
// const rateLimit = require("express-rate-limit");
// const loginLimiter = rateLimit({ windowMs: 15*60*1000, max: 5 });

// ═══════════════════════════════════════════════════════
// CONNEXION
// POST /login
// ═══════════════════════════════════════════════════════
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email et mot de passe requis",
      });
    }

    // Chercher le compte (exclure hash/salt/token par sécurité)
    const account = await Account.findOne({ email }).select(
      "+hash +salt +token",
    );

    if (!account) {
      return res.status(401).json({
        success: false,
        error: "Email ou mot de passe incorrect",
      });
    }

    // Vérifier si le compte a un mot de passe défini
    if (!account.hash || !account.salt) {
      return res.status(401).json({
        success: false,
        error: "Compte non activé ou mot de passe non défini",
      });
    }

    // Vérifier le mot de passe
    const hash = crypto
      .pbkdf2Sync(password, account.salt, 1000, 64, "sha512")
      .toString("hex");

    if (hash !== account.hash) {
      // Petit délai pour prévenir les attaques par timing
      await new Promise((resolve) => setTimeout(resolve, 100));
      return res.status(401).json({
        success: false,
        error: "Email ou mot de passe incorrect",
      });
    }

    // Générer le token JWT
    const token = jwt.sign(
      {
        id: account._id,
        email: account.email,
        role: account.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    // Sauvegarder le token dans le compte (optionnel mais utile pour déconnexion)
    account.token = token;
    await account.save();

    res.json({
      success: true,
      message: "Connexion réussie",
      token,
      user: {
        id: account._id,
        email: account.email,
        projectName: account.projectName,
        role: account.role,
        dueDate: account.dueDate,
      },
    });
  } catch (error) {
    console.error("Erreur POST /login:", error);
    res.status(500).json({ success: false, error: "Erreur serveur interne" });
  }
});

// ═══════════════════════════════════════════════════════
// VOIR MON PROFIL
// GET /me
// ═══════════════════════════════════════════════════════
router.get("/me", isAuthenticated, async (req, res) => {
  try {
    // Récupérer les données fraîches depuis la DB
    const account = await Account.findById(req.user._id).select(
      "-hash -salt -token",
    );

    if (!account) {
      return res.status(404).json({
        success: false,
        error: "Compte non trouvé",
      });
    }

    res.json({
      success: true,
      user: {
        id: account._id,
        email: account.email,
        projectName: account.projectName,
        role: account.role,
        createdAt: account.createdAt,
        dueDate: account.dueDate,
      },
    });
  } catch (error) {
    console.error("Erreur GET /me:", error);
    res.status(500).json({ success: false, error: "Erreur serveur interne" });
  }
});

// ═══════════════════════════════════════════════════════
// DÉCONNEXION
// POST /logout
// ═══════════════════════════════════════════════════════
router.post("/logout", isAuthenticated, async (req, res) => {
  try {
    // Supprimer le token de la base de données
    await Account.findByIdAndUpdate(req.user._id, {
      token: null,
    });

    res.json({
      success: true,
      message: "Déconnexion réussie",
    });
  } catch (error) {
    console.error("Erreur POST /logout:", error);
    res.status(500).json({ success: false, error: "Erreur serveur interne" });
  }
});

module.exports = router;
