const jwt = require("jsonwebtoken");
const Account = require("../models/Account");

// Vérifie si l'utilisateur est connecté
const isAuthenticated = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Token manquant" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const account = await Account.findById(decoded.id);

    if (!account) {
      return res.status(401).json({ error: "Compte non trouvé" });
    }

    req.user = account;
    next();
  } catch (error) {
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
