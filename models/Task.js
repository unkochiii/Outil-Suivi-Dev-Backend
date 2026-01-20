const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    taskName: {
      type: String,
      required: [true, "Le nom de la tâche est requis"],
      trim: true,
      maxlength: [200, "Nom trop long"],
    },
    Description: {
      type: String,
      required: [true, "La description est requise"],
      trim: true,
      maxlength: [5000, "Description trop longue"],
    },
    Duration: {
      type: String,
      required: [true, "La durée est requise"],
      trim: true,
    },
    Progression: [
      {
        date: { type: Date, default: Date.now },
        percentage: {
          type: Number,
          min: [0, "Minimum 0%"],
          max: [100, "Maximum 100%"],
          default: 0,
        },
      },
    ],
    Problem: {
      type: String,
      default: null,
      maxlength: [2000, "Problème trop long"],
    },
    Done: {
      type: Boolean,
      default: false,
      index: true,
    },
    owner: {
      // ✅ Renommé pour cohérence
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
    Site: {
      dev: {
        url: { type: String, default: null, trim: true },
        version: { type: String, default: null },
        createdAt: { type: Date, default: null },
        updatedAt: { type: Date, default: null },
      },
      official: {
        url: { type: String, default: null, trim: true },
        version: { type: String, default: null },
        createdAt: { type: Date, default: null },
        updatedAt: { type: Date, default: null },
      },
    },
    Apk: {
      dev: {
        url: { type: String, default: null, trim: true },
        version: { type: String, default: null },
        createdAt: { type: Date, default: null },
        updatedAt: { type: Date, default: null },
      },
      official: {
        url: { type: String, default: null, trim: true },
        version: { type: String, default: null },
        createdAt: { type: Date, default: null },
        updatedAt: { type: Date, default: null },
      },
    },
    Backend: {
      dev: {
        url: { type: String, default: null, trim: true },
        createdAt: { type: Date, default: null },
        updatedAt: { type: Date, default: null },
      },
      official: {
        url: { type: String, default: null, trim: true },
        createdAt: { type: Date, default: null },
        updatedAt: { type: Date, default: null },
      },
    },
  },
  {
    timestamps: true,
    toJSON: { transform: (doc, ret) => ret },
  },
);

taskSchema.index({ owner: 1, assignedTo: 1, Done: 1 });
module.exports = mongoose.model("Task", taskSchema);
