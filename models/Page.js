const mongoose = require("mongoose");

const pageSchema = new mongoose.Schema(
  {
    pageName: {
      type: String,
      required: [true, "Le nom de la page est requis"],
      trim: true,
      maxlength: [200, "Le nom ne peut pas dépasser 200 caractères"],
    },
    Description: {
      type: String,
      required: [true, "La description est requise"],
      trim: true,
      maxlength: [5000, "Description trop longue"],
    },
    owner: {
      // ✅ Renommé pour cohérence avec Official
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },
    assignedTo: {
      // ✅ Renommé
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      default: null,
      index: true,
    },
    images: {
      type: [
        {
          url: { type: String, required: true },
          public_id: { type: String, required: true },
        },
      ],
      default: [],
      validate: {
        validator: (v) => v.length <= 10,
        message: "Maximum 10 images autorisées",
      },
    },
    createdAt: {
      // ✅ Renommé pour clarté
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    toJSON: { transform: (doc, ret) => ret },
  },
);

pageSchema.index({ owner: 1, assignedTo: 1 });
module.exports = mongoose.model("Page", pageSchema);
