const express = require("express");
const router = express.Router();
const ToDo = require("../../../models/ToDo");
const { isAuthenticated } = require("../../../middlewares/auth");

// Constantes de validation
const VALID_STATUSES = ["pending", "resolved"];
const VALID_PRIORITIES = ["urgent", "important", "secondaire"];
const MAX_LIMIT = 50;

// Récupérer les ToDos assignés à l'utilisateur connecté
router.get("/ToDo/my-toDo", isAuthenticated, async (req, res) => {
  try {
    // Vérification de l'authentification
    if (!req.user?._id) {
      return res.status(401).json({ error: "Utilisateur non authentifié" });
    }

    // Validation et parsing des paramètres
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(req.query.limit, 10) || 10),
    );

    const { status, priority } = req.query;
    const filter = { assignedTo: req.user._id };

    // Filtrage par statut (optionnel)
    if (status && VALID_STATUSES.includes(status)) {
      filter.status = status;
    }

    // Filtrage par priorité (optionnel)
    if (priority && VALID_PRIORITIES.includes(priority)) {
      filter.priority = priority;
    }

    const skip = (page - 1) * limit;

    const [todos, total] = await Promise.all([
      ToDo.find(filter)
        .populate("owner", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ToDo.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: todos,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
      },
    });
  } catch (error) {
    console.error("Erreur GET /my-toDo:", error);
    res
      .status(500)
      .json({ error: "Erreur serveur lors de la récupération des tâches" });
  }
});

// Marquer un ToDo comme résolu
router.patch("/ToDo/:id/validate", isAuthenticated, async (req, res) => {
  try {
    // Vérification de l'authentification
    if (!req.user?._id) {
      return res.status(401).json({ error: "Utilisateur non authentifié" });
    }

    const todo = await ToDo.findById(req.params.id);

    if (!todo) {
      return res.status(404).json({ error: "ToDo non trouvé" });
    }

    // Vérifier que le ToDo est assigné à cet utilisateur
    if (todo.assignedTo?.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: "Vous ne pouvez valider que les ToDo qui vous sont assignés",
      });
    }

    // Vérifier que le status est bien "pending"
    if (todo.status !== "pending") {
      return res.status(400).json({
        error: `Cette tâche est déjà résolue ou a un statut ${todo.status}`,
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
    console.error("Erreur PATCH /validate:", error);
    res
      .status(500)
      .json({ error: "Erreur serveur lors de la validation de la tâche" });
  }
});

module.exports = router;
