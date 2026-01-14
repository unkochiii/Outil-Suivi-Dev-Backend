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

// GET - Toutes les tâches accessibles
router.get("/task", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));

    const filter =
      req.user.role === "admin"
        ? {}
        : { $or: [{ owner: req.user._id }, { assignedTo: req.user._id }] };

    if (req.query.taskName) {
      filter.taskName = { $regex: req.query.taskName.trim(), $options: "i" };
    }
    if (req.query.Done !== undefined) {
      filter.Done = req.query.Done === "true";
    }

    const [total, tasks] = await Promise.all([
      Task.countDocuments(filter),
      Task.find(filter)
        .populate("owner", "projectName email") // ✅ CORRECT
        .populate("assignedTo", "projectName email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.json({
      success: true,
      data: tasks,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

// GET - Une tâche spécifique
router.get("/task/:id", validateObjectId, async (req, res) => {
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
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAssigned && !isAdmin) {
      return res.status(403).json({ success: false, error: "Accès refusé" });
    }

    res.json({ success: true, data: task });
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

// GET - Tâches assignées
router.get("/task/my/assigned", async (req, res) => {
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

module.exports = router;
