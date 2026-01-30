const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const fs = require("fs").promises;
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

// Fonction utilitaire pour supprimer les fichiers temporaires
const cleanupTempFiles = async (files) => {
  if (!files?.length) return;
  await Promise.all(
    files.map(async (file) => {
      try {
        if (file.path) await fs.unlink(file.path);
      } catch (err) {
        console.error("Erreur suppression fichier temp:", err);
      }
    }),
  );
};

// Fonction utilitaire pour supprimer des images Cloudinary
const deleteCloudinaryImages = async (images) => {
  if (!images?.length) return;
  await Promise.all(
    images.map(async (img) => {
      try {
        const publicId = typeof img === "string" ? img : img.public_id;
        if (publicId) await cloudinary.uploader.destroy(publicId);
      } catch (err) {
        console.error("Erreur suppression Cloudinary:", err);
      }
    }),
  );
};

// Fonction pour uploader les images vers Cloudinary
const uploadToCloudinary = async (files) => {
  const uploadedImages = [];

  for (const file of files) {
    try {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: "pages",
        resource_type: "image",
      });
      uploadedImages.push({
        url: result.secure_url,
        public_id: result.public_id,
      });
    } catch (err) {
      // En cas d'erreur, supprimer les images déjà uploadées
      await deleteCloudinaryImages(uploadedImages);
      throw new Error(`Erreur upload image: ${err.message}`);
    }
  }

  return uploadedImages;
};

// POST
router.post("/admin/page", upload.array("images", 5), async (req, res) => {
  let uploadedImages = [];

  try {
    const { pageName, Description, owner, assignedTo } = req.body;

    // Validations
    if (!pageName?.trim() || !Description?.trim() || !owner) {
      await cleanupTempFiles(req.files);
      return res.status(400).json({
        success: false,
        error: "pageName, Description et owner sont requis",
      });
    }

    // ✅ Vérifier le nombre AVANT l'upload
    if (req.files?.length > 5) {
      await cleanupTempFiles(req.files);
      return res.status(400).json({
        success: false,
        error: "Maximum 5 images autorisées",
      });
    }

    // Vérifier existence du owner
    const ownerExists = await Account.findById(owner);
    if (!ownerExists) {
      await cleanupTempFiles(req.files);
      return res.status(404).json({
        success: false,
        error: "Owner non trouvé",
      });
    }

    // Vérifier existence de assignedTo
    if (assignedTo) {
      const assigneeExists = await Account.findById(assignedTo);
      if (!assigneeExists) {
        await cleanupTempFiles(req.files);
        return res.status(404).json({
          success: false,
          error: "AssignedTo non trouvé",
        });
      }
    }

    // Upload des images vers Cloudinary
    if (req.files?.length) {
      uploadedImages = await uploadToCloudinary(req.files);
    }

    // Créer la page
    const newPage = new Page({
      pageName: pageName.trim(),
      Description: Description.trim(),
      owner,
      assignedTo: assignedTo || null,
      images: uploadedImages,
    });

    await newPage.save();

    // Nettoyer les fichiers temporaires
    await cleanupTempFiles(req.files);

    res.status(201).json(generateSuccessResponse(newPage, "Page créée"));
  } catch (error) {
    console.error("Erreur création:", error);

    // ✅ Nettoyer en cas d'erreur
    await cleanupTempFiles(req.files);
    await deleteCloudinaryImages(uploadedImages);

    res.status(500).json({
      success: false,
      error: error.message || "Erreur serveur",
    });
  }
});

// PUT
router.put(
  "/admin/page/:id",
  validateObjectId,
  upload.array("images", 5),
  async (req, res) => {
    let newUploadedImages = [];

    try {
      const { pageName, Description, owner, assignedTo, imagesToDelete } =
        req.body;

      const page = await Page.findById(req.params.id);
      if (!page) {
        await cleanupTempFiles(req.files);
        return res.status(404).json({
          success: false,
          error: "Page non trouvée",
        });
      }

      // Parser imagesToDelete si c'est une string JSON
      let imagesToDeleteArray = [];
      if (imagesToDelete) {
        imagesToDeleteArray = Array.isArray(imagesToDelete)
          ? imagesToDelete
          : JSON.parse(imagesToDelete);
      }

      // ✅ Vérifier que les images à supprimer appartiennent bien à la page
      const pageImageIds = page.images.map((img) => img.public_id);
      const invalidDeleteIds = imagesToDeleteArray.filter(
        (id) => !pageImageIds.includes(id),
      );

      if (invalidDeleteIds.length > 0) {
        await cleanupTempFiles(req.files);
        return res.status(400).json({
          success: false,
          error:
            "Certaines images à supprimer n'appartiennent pas à cette page",
        });
      }

      // ✅ Calculer le nombre final d'images CORRECTEMENT
      const remainingImagesCount =
        page.images.length - imagesToDeleteArray.length;
      const newImagesCount = req.files?.length || 0;
      const totalImages = remainingImagesCount + newImagesCount;

      if (totalImages > 5) {
        await cleanupTempFiles(req.files);
        return res.status(400).json({
          success: false,
          error: `Limite de 5 images dépassée. Actuellement: ${remainingImagesCount} images restantes. Vous pouvez ajouter maximum ${5 - remainingImagesCount} nouvelles images`,
        });
      }

      // Upload des nouvelles images AVANT de supprimer les anciennes
      if (req.files?.length) {
        newUploadedImages = await uploadToCloudinary(req.files);
      }

      // Supprimer les anciennes images de Cloudinary
      if (imagesToDeleteArray.length > 0) {
        await deleteCloudinaryImages(imagesToDeleteArray);
        page.images = page.images.filter(
          (img) => !imagesToDeleteArray.includes(img.public_id),
        );
      }

      // Ajouter les nouvelles images
      if (newUploadedImages.length > 0) {
        page.images.push(...newUploadedImages);
      }

      // Mettre à jour les autres champs
      if (pageName?.trim()) page.pageName = pageName.trim();
      if (Description?.trim()) page.Description = Description.trim();

      if (owner && owner !== page.owner.toString()) {
        const ownerExists = await Account.findById(owner);
        if (!ownerExists) {
          await cleanupTempFiles(req.files);
          return res.status(404).json({
            success: false,
            error: "Owner non trouvé",
          });
        }
        page.owner = owner;
      }

      if (assignedTo !== undefined) {
        if (assignedTo === null || assignedTo === "null" || assignedTo === "") {
          page.assignedTo = null;
        } else if (assignedTo !== page.assignedTo?.toString()) {
          const assigneeExists = await Account.findById(assignedTo);
          if (!assigneeExists) {
            await cleanupTempFiles(req.files);
            return res.status(404).json({
              success: false,
              error: "AssignedTo non trouvé",
            });
          }
          page.assignedTo = assignedTo;
        }
      }

      await page.save();

      // Nettoyer les fichiers temporaires
      await cleanupTempFiles(req.files);

      res.json(generateSuccessResponse(page, "Page mise à jour"));
    } catch (error) {
      console.error("Erreur mise à jour:", error);

      // ✅ Nettoyer en cas d'erreur
      await cleanupTempFiles(req.files);
      await deleteCloudinaryImages(newUploadedImages);

      res.status(500).json({
        success: false,
        error: error.message || "Erreur serveur",
      });
    }
  },
);

// DELETE
router.delete("/admin/page/:id", validateObjectId, async (req, res) => {
  try {
    const page = await Page.findById(req.params.id);
    if (!page) {
      return res.status(404).json({
        success: false,
        error: "Page non trouvée",
      });
    }

    // Supprimer images Cloudinary (avec gestion d'erreur)
    await deleteCloudinaryImages(page.images);

    await Page.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Page supprimée avec succès" });
  } catch (error) {
    console.error("Erreur suppression:", error);
    res.status(500).json({
      success: false,
      error: "Erreur serveur",
    });
  }
});

module.exports = router;
