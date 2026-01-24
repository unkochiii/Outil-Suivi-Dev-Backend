const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Account = require("../models/Account");

// Correction du middleware
const isAuthenticated = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Token manquant" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔍 DEBUG: Log du token décodé
    console.log("🔍 TOKEN DEBUG:", decoded);

    // Vérification que decoded.id existe
    if (!decoded.id) {
      return res.status(401).json({ error: "Token invalide: ID manquant" });
    }

    const account = await Account.findById(decoded.id);

    if (!account) {
      return res.status(401).json({ error: "Compte non trouvé" });
    }

    // Garantir que req.user._id est un ObjectId valide
    req.user = {
      ...account.toObject(),
      _id: new mongoose.Types.ObjectId(account._id), // Forcer ObjectId
    };

    // 🔍 DEBUG: Log de l'utilisateur authentifié
    console.log("🔍 AUTH DEBUG - req.user._id:", req.user._id);
    console.log("🔍 AUTH DEBUG - req.user.role:", req.user.role);

    next();
  } catch (error) {
    console.error("❌ Erreur auth:", error);
    return res.status(401).json({ error: "Token invalide" });
  }
};

// Vérifie si l'utilisateur est admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Accès réservé aux admins" });
  }
  next();
};

module.exports = { isAuthenticated, isAdmin };
