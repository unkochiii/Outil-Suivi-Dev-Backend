const express = require("express");
const router = express.Router();
const Report = require("../../../models/ToDo");
const { isAuthenticated } = require("../../../middlewares/auth");

//  ToDos assignés à l'utilisateur connecté
router.get("/ToDo/my-toDo", isAuthenticated, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, priority } = req.query;

    const filter = { assignedTo: req.user._id };

    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [todos, total] = await Promise.all([
      ToDo.find(filter)
        .populate("owner", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      ToDo.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: todos,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Marquer un ToDo comme résolu
router.patch("/ToDo/:id/validate", isAuthenticated, async (req, res) => {
  try {
    const todo = await ToDo.findById(req.params.id);

    if (!todo) {
      return res.status(404).json({ error: "ToDo non trouvé" });
    }

    // Vérifier que le ToDo est assigné à cet utilisateur
    if (todo.assignedTo?.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: "Vous ne pouvez valider que les ToDo qui vous sont assignées",
      });
    }

    // Vérifier que le status est bien "pending"
    if (todo.status !== "pending") {
      return res.status(400).json({
        error: "Cette tâche est déjà résolue",
      });
    }

    todo.status = "resolved";
    await todo.save();

    await todo.populate([
      { path: "owner", select: "name email" },
      { path: "assignedTo", select: "name email" },
    ]);

    res.status(200).json({
      success: true,
      message: "ToDo validé avec succès",
      data: todo,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
