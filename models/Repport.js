const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    reportTitle: {
      type: String,
      required: [true, "Le titre du report est requis"],
      trim: true,
      maxlength: [300, "Titre trop long"],
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
        validator: (v) => v.length <= 2,
        message: "Maximum 2 images autorisées",
      },
    },
    owner: {
      // ✅ Renommé pour cohérence
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      default: null,
      index: true,
    },
    place: {
      type: String,
      required: [true, "Le lieu est requis"],
      trim: true,
      maxlength: [500, "Lieu trop long"],
    },
    priority: {
      type: String,
      enum: {
        values: [
          "urgent",
          "important",
          "secondaire",
          "peu important",
          "sans interet",
        ],
        message: "Priorité invalide",
      },
      default: "secondaire",
    },
    status: {
      type: String,
      enum: {
        values: ["pending", "in_progress", "resolved"],
        message: "Statut invalide",
      },
      default: "pending",
    },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  {
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

reportSchema.index({ owner: 1, assignedTo: 1, createdAt: -1 });
module.exports = mongoose.model("Report", reportSchema);
