const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const cloudinary = require("../../../config/cloudinary");
const Report = require("../../../models/Repport");
const Account = require("../../../models/Account");
const { isAuthenticated } = require("../../../middlewares/auth");
const upload = require("../../../middlewares/upload");

const validateObjectId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, error: "ID invalide" });
  }
  next();
};

// POST - Créer un report (utilisateur connecté)
router.post(
  "/report",
  isAuthenticated,
  upload.array("images", 2),
  async (req, res) => {
    try {
      const { reportTitle, place, content, priority, assignedTo } = req.body;

      // Validation
      if (!reportTitle?.trim() || !place?.trim() || !content?.trim()) {
        return res.status(400).json({
          success: false,
          error: "reportTitle, place et content sont requis",
        });
      }

      // Vérifier existence de assignedTo si fourni
      if (assignedTo) {
        const assigneeExists = await Account.findById(assignedTo);
        if (!assigneeExists) {
          return res
            .status(404)
            .json({ success: false, error: "Compte assigné non trouvé" });
        }
      }

      // Upload images
      const images = req.files?.length
        ? await Promise.all(
            req.files.map(async (file) => {
              const result = await cloudinary.uploader.upload(file.path, {
                folder: "reports",
              });
              return { url: result.secure_url, public_id: result.public_id };
            }),
          )
        : [];

      const report = await Report.create({
        reportTitle: reportTitle.trim(),
        place: place.trim(),
        content: content.trim(),
        priority: priority || "secondaire",
        owner: req.user._id, // ✅ CORRECT
        assignedTo: assignedTo || null,
        images,
      });

      res
        .status(201)
        .json({ success: true, data: report, message: "Report créé" });
    } catch (error) {
      console.error("Erreur création report:", error);
      res.status(500).json({ success: false, error: "Erreur serveur" });
    }
  },
);

// GET - Tous les reports accessibles (paginé)
router.get("/report/rapport", isAuthenticated, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));

    const filter =
      req.user.role === "admin"
        ? {}
        : {
            $or: [{ owner: req.user._id }, { assignedTo: req.user._id }],
          };

    if (req.query.reportTitle) {
      filter.reportTitle = {
        $regex: req.query.reportTitle.trim(),
        $options: "i",
      };
    }

    const [total, reports] = await Promise.all([
      Report.countDocuments(filter),
      Report.find(filter)
        .populate("owner", "projectName email role")
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
    console.error("Erreur liste rapports:", error);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

// GET - Un report spécifique
router.get(
  "/report/:id",
  isAuthenticated,
  validateObjectId,
  async (req, res) => {
    try {
      const report = await Report.findById(req.params.id)
        .populate("owner", "projectName email role")
        .populate("assignedTo", "projectName email role");

      if (!report) {
        return res
          .status(404)
          .json({ success: false, error: "Report non trouvé" });
      }

      const isOwner = report.owner._id.toString() === req.user._id.toString();
      const isAssigned =
        report.assignedTo?._id?.toString() === req.user._id.toString();

      if (!isOwner && !isAssigned) {
        return res.status(403).json({ success: false, error: "Accès refusé" });
      }

      res.json({ success: true, data: report });
    } catch (error) {
      console.error("Erreur récupération report:", error);
      res.status(500).json({ success: false, error: "Erreur serveur" });
    }
  },
);

module.exports = router;
