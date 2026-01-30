const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Task = require("../../../models/Task"); // ✅ CORRECT
const { isAuthenticated } = require("../../../middlewares/auth");

const validateObjectId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, error: "ID invalide" });
  }
  next();
};

// GET - Tâches assignées
router.get("/task/my/assigned", isAuthenticated, async (req, res) => {
  try {
    const tasks = await Task.find({ assignedTo: req.user._id })
      .populate("owner", "projectName email")
      .populate("assignedTo", "projectName email")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: tasks, count: tasks.length });
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

// GET - Une tâche spécifique
router.get("/task/:id", validateObjectId, isAuthenticated, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate("owner", "projectName email")
      .populate("assignedTo", "projectName email");

    if (!task) {
      return res
        .status(404)
        .json({ success: false, error: "Tâche non trouvée" });
    }

    const isOwner = task.owner._id.toString() === req.user._id.toString();
    const isAssigned =
      task.assignedTo?._id?.toString() === req.user._id.toString();

    if (!isOwner && !isAssigned) {
      return res.status(403).json({ success: false, error: "Accès refusé" });
    }

    res.json({ success: true, data: task });
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

module.exports = router;
