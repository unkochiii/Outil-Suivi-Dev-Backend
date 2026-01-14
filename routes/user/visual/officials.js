const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Official = require("../../../models/Official");
const { isAuthenticated } = require("../../../middlewares/auth");

// Validation d'ID
const validateObjectId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, error: "ID invalide" });
  }
  next();
};

// GET - Tous les documents accessibles (paginé)
router.get("/officials", async (req, res) => {
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
router.get("/officials/:id", validateObjectId, async (req, res) => {
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
});

// GET - Documents assignés à l'utilisateur
router.get("/officials/my/assigned", async (req, res) => {
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
