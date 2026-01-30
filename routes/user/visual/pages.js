const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Page = require("../../../models/Page"); // ✅ CORRECT
const Account = require("../../../models/Account");
const { isAuthenticated } = require("../../../middlewares/auth");

const validateObjectId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, error: "ID invalide" });
  }
  next();
};

// GET - Toutes les pages accessibles
router.get("/page", isAuthenticated, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));

    const filter =
      req.user.role === "admin"
        ? {}
        : {
            $or: [{ owner: req.user._id }, { assignedTo: req.user._id }],
          };

    if (req.query.pageName) {
      filter.pageName = { $regex: req.query.pageName.trim(), $options: "i" };
    }

    const [total, pages] = await Promise.all([
      Page.countDocuments(filter),
      Page.find(filter)
        .populate("owner", "projectName email") // ✅ CORRECT
        .populate("assignedTo", "projectName email")
        .sort({ createdAt: -1 }) // ✅ CORRECT
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.json({
      success: true,
      data: pages,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

// GET - Une page spécifique
router.get("/page/:id", validateObjectId, isAuthenticated, async (req, res) => {
  try {
    const page = await Page.findById(req.params.id)
      .populate("owner", "projectName email")
      .populate("assignedTo", "projectName email");

    if (!page) {
      return res
        .status(404)
        .json({ success: false, error: "Page non trouvée" });
    }

    const isOwner = page.owner._id.toString() === req.user._id.toString();
    const isAssigned =
      page.assignedTo?._id?.toString() === req.user._id.toString();

    if (!isOwner && !isAssigned) {
      return res.status(403).json({ success: false, error: "Accès refusé" });
    }

    res.json({ success: true, data: page });
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

// GET - Pages assignées à l'utilisateur
router.get("/page/my/assigned", isAuthenticated, async (req, res) => {
  try {
    const pages = await Page.find({ assignedTo: req.user._id })
      .populate("owner", "projectName email")
      .populate("assignedTo", "projectName email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: pages,
      count: pages.length,
    });
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

module.exports = router;
