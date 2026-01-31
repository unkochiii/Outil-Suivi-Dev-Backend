const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Official = require("../../../models/Official");
const { isAuthenticated } = require("../../../middlewares/auth");
const path = require("path");
const fs = require("fs");

// Validation d'ID
const validateObjectId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, error: "ID invalide" });
  }
  next();
};

// GET - Tous les documents accessibles (paginé)
router.get("/officials", isAuthenticated, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));

    const filter =
      req.user.role === "admin"
        ? {}
        : {
            $or: [{ owner: req.user._id }, { assignedTo: req.user._id }],
          };

    if (req.query.documentName) {
      filter.documentName = {
        $regex: req.query.documentName.trim(),
        $options: "i",
      };
    }

    const [total, officials] = await Promise.all([
      Official.countDocuments(filter),
      Official.find(filter)
        .populate("owner", "projectName email") // ✅ Utilise 'projectName' pas 'name'
        .populate("assignedTo", "projectName email")
        .sort({ "pdf.uploadedAt": -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.json({
      success: true,
      data: officials,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Erreur liste documents:", error);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

// GET - Un document spécifique
router.get(
  "/officials/:id",
  validateObjectId,
  isAuthenticated,
  async (req, res) => {
    try {
      const official = await Official.findById(req.params.id)
        .populate("owner", "projectName email")
        .populate("assignedTo", "projectName email");

      if (!official) {
        return res
          .status(404)
          .json({ success: false, error: "Document non trouvé" });
      }

      // Vérification d'accès
      const isOwner = official.owner._id.toString() === req.user._id.toString();
      const isAssigned =
        official.assignedTo?._id?.toString() === req.user._id.toString();
      const isAdmin = req.user.role === "admin";

      if (!isOwner && !isAssigned && !isAdmin) {
        return res.status(403).json({ success: false, error: "Accès refusé" });
      }

      res.json({ success: true, data: official });
    } catch (error) {
      console.error("Erreur récupération document:", error);
      res.status(500).json({ success: false, error: "Erreur serveur" });
    }
  },
);

// 🔽 **AJOUTER CETTE ROUTE EN BAS DU FICHIER**
router.get(
  "/officials/:id/pdf",
  validateObjectId,
  isAuthenticated,
  async (req, res) => {
    try {
      console.log("📥 Demande de téléchargement PDF pour ID:", req.params.id);

      const official = await Official.findById(req.params.id)
        .populate("owner", "projectName email")
        .populate("assignedTo", "projectName email");

      if (!official) {
        console.log("❌ Document non trouvé");
        return res.status(404).json({ error: "Document non trouvé" });
      }

      // Vérification d'accès
      const isOwner = official.owner._id.toString() === req.user._id.toString();
      const isAssigned =
        official.assignedTo?._id?.toString() === req.user._id.toString();
      const isAdmin = req.user.role === "admin";

      if (!isOwner && !isAssigned && !isAdmin) {
        console.log("🔒 Accès refusé pour l'utilisateur:", req.user._id);
        return res.status(403).json({ error: "Accès refusé" });
      }

      // Vérifier si le fichier existe
      if (!official.pdf?.url) {
        console.log("❌ URL PDF manquante dans le document");
        return res.status(404).json({ error: "Fichier PDF non trouvé" });
      }

      // Enlever le préfixe file:// si présent
      const filePath = official.pdf.url.replace("file://", "");
      console.log("📁 Chemin du fichier:", filePath);

      // Vérifier que le fichier existe réellement
      if (!fs.existsSync(filePath)) {
        console.log("❌ Fichier non trouvé sur le disque:", filePath);
        return res
          .status(404)
          .json({ error: "Le fichier n'existe pas sur le serveur" });
      }

      // Envoyer le fichier
      const filename = official.documentName || "document.pdf";
      console.log("✅ Envoi du fichier:", filename);

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.sendFile(filePath, (err) => {
        if (err) {
          console.error("💥 Erreur lors de l'envoi du fichier:", err);
          if (!res.headersSent) {
            res
              .status(500)
              .json({ error: "Erreur lors de la lecture du fichier" });
          }
        }
      });
    } catch (error) {
      console.error("💥 Erreur téléchargement PDF:", error);
      if (!res.headersSent) {
        res
          .status(500)
          .json({ error: "Erreur serveur lors du téléchargement" });
      }
    }
  },
);

// GET - Documents assignés à l'utilisateur
router.get("/officials/my/assigned", isAuthenticated, async (req, res) => {
  try {
    const officials = await Official.find({ assignedTo: req.user._id })
      .populate("owner", "projectName email")
      .populate("assignedTo", "projectName email")
      .sort({ "pdf.uploadedAt": -1 });

    res.json({
      success: true,
      data: officials,
      count: officials.length,
    });
  } catch (error) {
    console.error("Erreur documents assignés:", error);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

module.exports = router;
