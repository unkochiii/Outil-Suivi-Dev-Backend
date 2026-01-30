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

// ✅ Upload vers Cloudinary depuis un BUFFER
const uploadToCloudinary = (file) => {
  return new Promise((resolve, reject) => {
    if (!file || !file.buffer) {
      return reject(new Error("Fichier invalide"));
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "pages",
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          console.error("❌ Cloudinary error:", error);
          reject(error);
        } else {
          resolve({
            url: result.secure_url,
            public_id: result.public_id,
          });
        }
      },
    );

    uploadStream.end(file.buffer);
  });
};

// ✅ Upload multiple
const uploadMultiple = async (files) => {
  const uploaded = [];

  for (const file of files) {
    try {
      console.log(`📤 Upload: ${file.originalname}`);
      const result = await uploadToCloudinary(file);
      uploaded.push(result);
      console.log(`✅ OK: ${result.public_id}`);
    } catch (err) {
      // Nettoyer en cas d'erreur
      await deleteImages(uploaded);
      throw err;
    }
  }

  return uploaded;
};

// ✅ Supprimer images Cloudinary
const deleteImages = async (images) => {
  for (const img of images) {
    try {
      const publicId = typeof img === "string" ? img : img.public_id;
      if (publicId) {
        await cloudinary.uploader.destroy(publicId);
        console.log(`🗑️ Supprimé: ${publicId}`);
      }
    } catch (err) {
      console.error("Erreur suppression:", err.message);
    }
  }
};

// ✅ Middleware erreur Multer
const handleUpload = (req, res, next) => {
  upload.array("images", 5)(req, res, (err) => {
    if (err) {
      console.error("❌ Multer error:", err.message);

      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          error: "Fichier trop gros (max 5MB)",
        });
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({
          success: false,
          error: "Maximum 5 fichiers",
        });
      }

      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }
    next();
  });
};

// POST - Créer
router.post("/admin/page", handleUpload, async (req, res) => {
  let uploadedImages = [];

  try {
    console.log("📡 POST /admin/page");
    console.log("Body:", req.body);
    console.log("Files:", req.files?.length || 0);

    const { pageName, Description, owner, assignedTo } = req.body;

    // Validation
    if (!pageName?.trim() || !Description?.trim() || !owner) {
      return res.status(400).json({
        success: false,
        error: "pageName, Description et owner sont requis",
      });
    }

    // Vérifier owner
    const ownerExists = await Account.findById(owner);
    if (!ownerExists) {
      return res.status(404).json({
        success: false,
        error: "Owner non trouvé",
      });
    }

    // Vérifier assignedTo
    if (assignedTo) {
      const assigneeExists = await Account.findById(assignedTo);
      if (!assigneeExists) {
        return res.status(404).json({
          success: false,
          error: "AssignedTo non trouvé",
        });
      }
    }

    // Upload images
    if (req.files?.length > 0) {
      uploadedImages = await uploadMultiple(req.files);
    }

    // Créer page
    const newPage = new Page({
      pageName: pageName.trim(),
      Description: Description.trim(),
      owner,
      assignedTo: assignedTo || null,
      images: uploadedImages,
    });

    await newPage.save();
    console.log("✅ Page créée:", newPage._id);

    res.status(201).json({
      success: true,
      message: "Page créée",
      data: newPage,
    });
  } catch (error) {
    console.error("❌ Erreur:", error);
    await deleteImages(uploadedImages);

    res.status(500).json({
      success: false,
      error: error.message || "Erreur serveur",
    });
  }
});

// PUT - Modifier
router.put(
  "/admin/page/:id",
  validateObjectId,
  handleUpload,
  async (req, res) => {
    let newImages = [];

    try {
      const { pageName, Description, owner, assignedTo, imagesToDelete } =
        req.body;

      const page = await Page.findById(req.params.id);
      if (!page) {
        return res.status(404).json({
          success: false,
          error: "Page non trouvée",
        });
      }

      // Parser imagesToDelete
      let toDelete = [];
      if (imagesToDelete) {
        toDelete = Array.isArray(imagesToDelete)
          ? imagesToDelete
          : JSON.parse(imagesToDelete);
      }

      // Calculer limite
      const remaining = page.images.length - toDelete.length;
      const adding = req.files?.length || 0;

      if (remaining + adding > 5) {
        return res.status(400).json({
          success: false,
          error: `Max 5 images. Restantes: ${remaining}, ajout possible: ${5 - remaining}`,
        });
      }

      // Upload nouvelles images
      if (req.files?.length > 0) {
        newImages = await uploadMultiple(req.files);
      }

      // Supprimer anciennes
      if (toDelete.length > 0) {
        await deleteImages(toDelete);
        page.images = page.images.filter(
          (img) => !toDelete.includes(img.public_id),
        );
      }

      // Ajouter nouvelles
      page.images.push(...newImages);

      // Mettre à jour champs
      if (pageName?.trim()) page.pageName = pageName.trim();
      if (Description?.trim()) page.Description = Description.trim();

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
        if (!assignedTo || assignedTo === "null") {
          page.assignedTo = null;
        } else {
          const exists = await Account.findById(assignedTo);
          if (!exists) {
            return res
              .status(404)
              .json({ success: false, error: "AssignedTo non trouvé" });
          }
          page.assignedTo = assignedTo;
        }
      }

      await page.save();

      res.json({
        success: true,
        message: "Page mise à jour",
        data: page,
      });
    } catch (error) {
      console.error("❌ Erreur:", error);
      await deleteImages(newImages);

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

    await deleteImages(page.images);
    await Page.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: "Page supprimée" });
  } catch (error) {
    console.error("❌ Erreur:", error);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

module.exports = router;
