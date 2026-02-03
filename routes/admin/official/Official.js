const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Official = require("../../../models/Official");
const { isAuthenticated, isAdmin } = require("../../../middlewares/auth"); // ✅ Utilisez les mêmes noms

// Validation d'ID
const validateObjectId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, error: "ID invalide" });
  }
  next();
};

router.use(isAuthenticated, isAdmin);

// GET all officials
router.get("/admin/officials", async (req, res) => {
  try {
    const officials = await Official.find()
      .populate("owner", "projectName email")
      .populate("assignedTo", "projectName email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: officials,
    });
  } catch (error) {
    console.error("Erreur récupération documents:", error);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

// POST - Créer un document officiel
router.post("/admin/officials", async (req, res) => {
  try {
    const { documentName, pdf, owner, assignedTo } = req.body; // ✅ owner au lieu de Account

    // Validation
    if (!documentName?.trim() || !pdf?.url || !owner) {
      return res.status(400).json({
        success: false,
        error: "Les champs documentName, pdf.url et owner sont requis",
      });
    }

    // Vérifier que le owner existe
    const Account = require("../../../models/Account");
    const ownerExists = await Account.findById(owner);
    if (!ownerExists) {
      return res
        .status(404)
        .json({ success: false, error: "Owner non trouvé" });
    }

    // Vérifier que assignedTo existe si fourni
    if (assignedTo) {
      const assigneeExists = await Account.findById(assignedTo);
      if (!assigneeExists) {
        return res
          .status(404)
          .json({ success: false, error: "AssignedTo non trouvé" });
      }
    }

    const newOfficial = new Official({
      documentName: documentName.trim(),
      pdf: {
        url: pdf.url.trim(),
        fileName: pdf.fileName || null,
      },
      owner,
      assignedTo: assignedTo || null,
    });

    await newOfficial.save();

    res.status(201).json({
      success: true,
      message: "Document créé avec succès",
      data: newOfficial,
    });
  } catch (error) {
    console.error("Erreur création document:", error);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

// PUT - Modifier un document
router.put("/admin/officials/:id", validateObjectId, async (req, res) => {
  try {
    const { documentName, pdf, owner, assignedTo } = req.body;

    const official = await Official.findById(req.params.id);
    if (!official) {
      return res
        .status(404)
        .json({ success: false, error: "Document non trouvé" });
    }

    // Vérifier existence du nouveau owner
    if (owner && owner !== official.owner.toString()) {
      const Account = require("../../../models/Account");
      const ownerExists = await Account.findById(owner);
      if (!ownerExists) {
        return res
          .status(404)
          .json({ success: false, error: "Owner non trouvé" });
      }
      official.owner = owner;
    }

    // Vérifier existence du nouveau assignedTo
    if (
      assignedTo !== undefined &&
      assignedTo !== official.assignedTo?.toString()
    ) {
      if (assignedTo === null) {
        official.assignedTo = null;
      } else {
        const Account = require("../../../models/Account");
        const assigneeExists = await Account.findById(assignedTo);
        if (!assigneeExists) {
          return res
            .status(404)
            .json({ success: false, error: "AssignedTo non trouvé" });
        }
        official.assignedTo = assignedTo;
      }
    }

    if (documentName) official.documentName = documentName.trim();
    if (pdf?.url) official.pdf.url = pdf.url.trim();
    if (pdf?.fileName !== undefined) official.pdf.fileName = pdf.fileName;

    await official.save();

    res.json({
      success: true,
      message: "Document modifié avec succès",
      data: official,
    });
  } catch (error) {
    console.error("Erreur modification document:", error);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

// DELETE - Supprimer un document
router.delete("/admin/officials/:id", validateObjectId, async (req, res) => {
  try {
    const official = await Official.findByIdAndDelete(req.params.id);
    if (!official) {
      return res
        .status(404)
        .json({ success: false, error: "Document non trouvé" });
    }

    res.json({ success: true, message: "Document supprimé avec succès" });
  } catch (error) {
    console.error("Erreur suppression document:", error);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

module.exports = router;
