const mongoose = require("mongoose");

const ToDoSchema = new mongoose.Schema(
  {
    ToDoTitle: {
      type: String,
      required: [true, "Le titre du report est requis"],
      trim: true,
      maxlength: [300, "Titre trop long"],
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
      default: "6967cf8cd23c48acdf06475d",
      index: true,
    },
    content: {
      type: String,
      required: [true, "Le contenu est requis"],
      trim: true,
      maxlength: [5000, "Contenu trop long"],
    },
    status: {
      type: String,
      enum: {
        values: ["pending", "resolved"],
        message: "Statut invalide",
      },
      default: "pending",
    },
    priority: {
      type: String,
      enum: {
        values: ["urgent", "important", "secondaire"],
        message: "Priorité invalide",
      },
      default: "secondaire",
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
  },
);

ToDoSchema.index({ owner: 1, assignedTo: 1, createdAt: -1 });
module.exports = mongoose.model("ToDo", ToDoSchema);
