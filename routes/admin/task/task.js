const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Task = require("../../../models/Task");
const Account = require("../../../models/Account");
const { isAuthenticated, isAdmin } = require("../../../middlewares/auth");

const validateObjectId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, error: "ID invalide" });
  }
  next();
};

router.use(isAuthenticated, isAdmin);

// POST
router.post("/admin/task", async (req, res) => {
  try {
    const {
      taskName,
      Duration,
      Description,
      Problem,
      Done,
      owner,
      assignedTo,
      dueDate,
      Site,
      Apk,
      Backend,
    } = req.body;

    if (
      !taskName?.trim() ||
      !Duration?.trim() ||
      !Description?.trim() ||
      !owner
    ) {
      return res.status(400).json({
        success: false,
        error: "taskName, Duration, Description et owner sont requis",
      });
    }

    // Vérifier existence du owner
    const ownerExists = await Account.findById(owner);
    if (!ownerExists) {
      return res
        .status(404)
        .json({ success: false, error: "Owner non trouvé" });
    }

    // Vérifier existence de assignedTo
    if (assignedTo) {
      const assigneeExists = await Account.findById(assignedTo);
      if (!assigneeExists) {
        return res
          .status(404)
          .json({ success: false, error: "AssignedTo non trouvé" });
      }
    }

    const newTask = new Task({
      taskName: taskName.trim(),
      Duration: Duration.trim(),
      Description: Description.trim(),
      Problem: Problem || null,
      Done: Done || false,
      dueDate: dueDate || null,
      owner,
      assignedTo: assignedTo || null,
      Site,
      Apk,
      Backend,
    });

    await newTask.save();
    res
      .status(201)
      .json({ success: true, message: "Tâche créée", data: newTask });
  } catch (error) {
    console.error("Erreur création tâche:", error);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

// PUT
router.put("/admin/task/:id", validateObjectId, async (req, res) => {
  try {
    const {
      taskName,
      Duration,
      Description,
      Problem,
      Done,
      owner,
      assignedTo,
      dueDate,
      Site,
      Apk,
      Backend,
    } = req.body;

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res
        .status(404)
        .json({ success: false, error: "Tâche non trouvée" });
    }

    // Vérifier owner si modifié
    if (owner && owner !== task.owner.toString()) {
      const ownerExists = await Account.findById(owner);
      if (!ownerExists) {
        return res
          .status(404)
          .json({ success: false, error: "Owner non trouvé" });
      }
      task.owner = owner;
    }

    // Vérifier assignedTo
    if (assignedTo !== undefined) {
      if (assignedTo === null) {
        task.assignedTo = null;
      } else if (assignedTo !== task.assignedTo?.toString()) {
        const assigneeExists = await Account.findById(assignedTo);
        if (!assigneeExists) {
          return res
            .status(404)
            .json({ success: false, error: "AssignedTo non trouvé" });
        }
        task.assignedTo = assignedTo;
      }
    }

    if (taskName) task.taskName = taskName.trim();
    if (Duration) task.Duration = Duration.trim();
    if (Description) task.Description = Description.trim();
    if (Problem !== undefined) task.Problem = Problem;
    if (dueDate !== undefined) task.dueDate = dueDate || null;
    if (Done !== undefined) task.Done = Done;

    // Mise à jour des versions avec timestamps
    const updateVersion = (current, updated) => {
      if (!updated) return;
      Object.keys(updated).forEach((key) => {
        if (updated[key] !== undefined) {
          current[key] = updated[key];
          current[`${key === "url" ? "updatedAt" : "updatedAt"}`] = new Date(); // Simplifié
        }
      });
    };

    if (Site?.dev) updateVersion(task.Site.dev, Site.dev);
    if (Site?.official) updateVersion(task.Site.official, Site.official);
    if (Apk?.dev) updateVersion(task.Apk.dev, Apk.dev);
    if (Apk?.official) updateVersion(task.Apk.official, Apk.official);
    if (Backend?.dev) updateVersion(task.Backend.dev, Backend.dev);
    if (Backend?.official)
      updateVersion(task.Backend.official, Backend.official);

    await task.save();
    res.json({ success: true, message: "Tâche mise à jour", data: task });
  } catch (error) {
    console.error("Erreur mise à jour:", error);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

// PUT progression
router.put(
  "/admin/task/:id/progression",
  validateObjectId,
  async (req, res) => {
    try {
      const { percentage } = req.body;
      if (percentage === undefined || percentage < 0 || percentage > 100) {
        return res.status(400).json({
          success: false,
          error: "Percentage requis (0-100)",
        });
      }

      const task = await Task.findById(req.params.id);
      if (!task) {
        return res
          .status(404)
          .json({ success: false, error: "Tâche non trouvée" });
      }

      task.Progression.push({ percentage });
      await task.save();

      res.json({
        success: true,
        message: "Progression mise à jour",
        data: task,
      });
    } catch (error) {
      console.error("Erreur progression:", error);
      res.status(500).json({ success: false, error: "Erreur serveur" });
    }
  },
);

// DELETE
router.delete("/admin/task/:id", validateObjectId, async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      return res
        .status(404)
        .json({ success: false, error: "Tâche non trouvée" });
    }

    res.json({ success: true, message: "Tâche supprimée" });
  } catch (error) {
    console.error("Erreur suppression:", error);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

module.exports = router;
