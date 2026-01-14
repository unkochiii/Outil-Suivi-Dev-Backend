const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Report = require("../../../models/Repport");
const Account = require("../../../models/Account");
const { isAuthenticated, isAdmin } = require("../../../middlewares/auth");

const validateObjectId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, error: "ID invalide" });
  }
  next();
};

router.use(isAuthenticated, isAdmin);

// GET - Admin voit tous les reports (paginé)
router.get("/admin/rapport", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));

    const [total, reports] = await Promise.all([
      Report.countDocuments(),
      Report.find()
        .populate("owner", "projectName email role") // ✅ CORRECT
        .populate("assignedTo", "projectName email role")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.json({
      success: true,
      data: reports,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Erreur admin rapports:", error);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

module.exports = router;
