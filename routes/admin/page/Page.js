const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Page = require("../../../models/Page");
const Account = require("../../../models/Account");
const { isAuthenticated, isAdmin } = require("../../../middlewares/auth");
const cloudinary = require("../../../config/cloudinary");
const upload = require("../../../middlewares/upload");

const validateObjectId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, error: "ID invalide" });
  }
  next();
};

router.use(isAuthenticated, isAdmin);

const generateSuccessResponse = (data, message = "Succès") => ({
  success: true,
  message,
  data,
});

// POST
router.post("/admin/page", upload.array("images", 5), async (req, res) => {
  try {
    const { pageName, Description, owner, assignedTo } = req.body;

    if (!pageName?.trim() || !Description?.trim() || !owner) {
      return res.status(400).json({
        success: false,
        error: "pageName, Description et owner sont requis",
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

    const images = req.files?.length
      ? await Promise.all(
          req.files.map(async (file) => {
            const result = await cloudinary.uploader.upload(file.path);
            return { url: result.secure_url, public_id: result.public_id };
          })
        )
      : [];

    if (images.length > 5) {
      return res
        .status(400)
        .json({ success: false, error: "Maximum 5 images" });
    }

    const newPage = new Page({
      pageName: pageName.trim(),
      Description: Description.trim(),
      owner,
      assignedTo: assignedTo || null,
      images,
    });

    await newPage.save();
    res.status(201).json(generateSuccessResponse(newPage, "Page créée"));
  } catch (error) {
    console.error("Erreur création:", error);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

// PUT
router.put(
  "/admin/page/:id",
  validateObjectId,
  upload.array("images", 5),
  async (req, res) => {
    try {
      const { pageName, Description, owner, assignedTo, imagesToDelete } =
        req.body;

      const page = await Page.findById(req.params.id);
      if (!page) {
        return res
          .status(404)
          .json({ success: false, error: "Page non trouvée" });
      }

      // Supprimer images
      if (Array.isArray(imagesToDelete)) {
        await Promise.all(
          imagesToDelete.map((id) => cloudinary.uploader.destroy(id))
        );
        page.images = page.images.filter(
          (img) => !imagesToDelete.includes(img.public_id)
        );
      }

      // Ajouter nouvelles images
      if (req.files?.length) {
        if (page.images.length + req.files.length > 5) {
          return res.status(400).json({
            success: false,
            error: `Limite atteinte. Vous pouvez ajouter ${
              5 - page.images.length
            } images maximum`,
          });
        }

        const newImages = await Promise.all(
          req.files.map(async (file) => {
            const result = await cloudinary.uploader.upload(file.path);
            return { url: result.secure_url, public_id: result.public_id };
          })
        );
        page.images.push(...newImages);
      }

      // Mettre à jour autres champs
      if (pageName) page.pageName = pageName.trim();
      if (Description) page.Description = Description.trim();
      if (owner && owner !== page.owner.toString()) {
        const ownerExists = await Account.findById(owner);
        if (!ownerExists) {
          return res
            .status(404)
            .json({ success: false, error: "Owner non trouvé" });
        }
        page.owner = owner;
      }
      if (assignedTo !== undefined) {
        if (assignedTo === null) {
          page.assignedTo = null;
        } else if (assignedTo !== page.assignedTo?.toString()) {
          const assigneeExists = await Account.findById(assignedTo);
          if (!assigneeExists) {
            return res
              .status(404)
              .json({ success: false, error: "AssignedTo non trouvé" });
          }
          page.assignedTo = assignedTo;
        }
      }

      await page.save();
      res.json(generateSuccessResponse(page, "Page mise à jour"));
    } catch (error) {
      console.error("Erreur mise à jour:", error);
      res.status(500).json({ success: false, error: "Erreur serveur" });
    }
  }
);

// DELETE
router.delete("/admin/page/:id", validateObjectId, async (req, res) => {
  try {
    const page = await Page.findById(req.params.id);
    if (!page) {
      return res
        .status(404)
        .json({ success: false, error: "Page non trouvée" });
    }

    // Supprimer images Cloudinary
    await Promise.all(
      page.images.map((img) => cloudinary.uploader.destroy(img.public_id))
    );

    await Page.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Page supprimée avec succès" });
  } catch (error) {
    console.error("Erreur suppression:", error);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

module.exports = router;
