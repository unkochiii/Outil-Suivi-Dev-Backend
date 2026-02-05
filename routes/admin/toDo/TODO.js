const express = require("express");
const router = express.Router();
const ToDo = require("../../../models/ToDo");
const { isAuthenticated, isAdmin } = require("../../../middlewares/auth");

//  Tous les ToDos (Admin)
router.get("/admin/ToDo", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, priority } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [todos, total] = await Promise.all([
      ToDo.find(filter)
        .populate("owner", "name email")
        .populate("assignedTo", "name email")
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

//  Créer un ToDo (Admin)
router.post("/admin/ToDo/", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { ToDoTitle, content, assignedTo, priority, status } = req.body;

    const todo = await ToDo.create({
      ToDoTitle,
      content,
      owner: req.user._id,
      assignedTo: assignedTo || null,
      priority: priority || "secondaire",
      status: status || "pending",
    });

    await todo.populate([
      { path: "owner", select: "name email" },
      { path: "assignedTo", select: "name email" },
    ]);

    res.status(201).json({
      success: true,
      message: "ToDo créé",
      data: todo,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ error: messages.join(", ") });
    }
    res.status(500).json({ error: error.message });
  }
});

//  Modifier un ToDo (Admin)
router.put("/admin/ToDo/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { ToDoTitle, content, assignedTo, priority, status } = req.body;

    const todo = await ToDo.findByIdAndUpdate(
      req.params.id,
      {
        ...(ToDoTitle && { ToDoTitle }),
        ...(content && { content }),
        ...(assignedTo !== undefined && { assignedTo }),
        ...(priority && { priority }),
        ...(status && { status }),
      },
      { new: true, runValidators: true },
    ).populate([
      { path: "owner", select: "name email" },
      { path: "assignedTo", select: "name email" },
    ]);

    if (!todo) {
      return res.status(404).json({ error: "ToDo non trouvé" });
    }

    res.status(200).json({
      success: true,
      message: "ToDo modifié",
      data: todo,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ error: messages.join(", ") });
    }
    res.status(500).json({ error: error.message });
  }
});

//  Supprimer un ToDo (Admin)
router.delete("/admin/ToDo/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const todo = await ToDo.findByIdAndDelete(req.params.id);

    if (!todo) {
      return res.status(404).json({ error: "ToDo non trouvé" });
    }

    res.status(200).json({
      success: true,
      message: "ToDo supprimé",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
