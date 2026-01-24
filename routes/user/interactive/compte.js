const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const Account = require("../../../models/Account");
const { isAuthenticated } = require("../../../middlewares/auth");

// NOTE: Ajoutez rate-limiting sur cette route
// const rateLimit = require("express-rate-limit");
// const loginLimiter = rateLimit({ windowMs: 15*60*1000, max: 5 });

router.post("/login", async (req, res) => {
  try {
    console.log("=== LOGIN ATTEMPT ===");
    console.log("Body reçu:", req.body);

    const { email, password } = req.body;

    if (!email || !password) {
      console.log("❌ Email ou password manquant");
      return res.status(400).json({
        success: false,
        error: "Email et mot de passe requis",
      });
    }

    console.log("Email recherché:", email);

    const account = await Account.findOne({ email }).select(
      "+hash +salt +token",
    );

    console.log("Compte trouvé:", account ? "OUI" : "NON");

    if (!account) {
      console.log("❌ Compte non trouvé");
      return res.status(401).json({
        success: false,
        error: "Email ou mot de passe incorrect",
      });
    }

    if (!account.hash || !account.salt) {
      console.log("❌ Hash ou salt manquant");
      return res.status(401).json({
        success: false,
        error: "Compte non activé ou mot de passe non défini",
      });
    }

    const hash = crypto
      .pbkdf2Sync(password, account.salt, 1000, 64, "sha512")
      .toString("hex");

    console.log("Hash match:", hash === account.hash);

    if (hash !== account.hash) {
      console.log("❌ Mot de passe incorrect");
      await new Promise((resolve) => setTimeout(resolve, 100));
      return res.status(401).json({
        success: false,
        error: "Email ou mot de passe incorrect",
      });
    }

    const token = jwt.sign(
      {
        id: account._id,
        email: account.email,
        role: account.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    account.token = token;
    await account.save();

    console.log("✅ Login réussi pour:", email);

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
    console.error("❌ Erreur POST /login:", error);
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
router.post("/logout", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    // Si pas de token, considérer comme déjà déconnecté
    if (!token) {
      return res.json({
        success: true,
        message: "Déjà déconnecté",
      });
    }

    // Essayer de décoder le token (même s'il est expiré)
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      // Token invalide ou expiré - c'est OK, on déconnecte quand même
      // Essayer de décoder sans vérifier l'expiration
      try {
        decoded = jwt.decode(token);
      } catch {
        // Token complètement invalide
        return res.json({
          success: true,
          message: "Déconnexion réussie (token invalide)",
        });
      }
    }

    // Si on a un ID, supprimer le token en base
    if (decoded?.id) {
      await Account.findByIdAndUpdate(decoded.id, {
        token: null,
      });
    }

    res.json({
      success: true,
      message: "Déconnexion réussie",
    });
  } catch (error) {
    console.error("Erreur POST /logout:", error);
    // Même en cas d'erreur serveur, on considère la déconnexion réussie côté client
    res.json({
      success: true,
      message: "Déconnexion réussie (erreur serveur ignorée)",
    });
  }
});

module.exports = router;
