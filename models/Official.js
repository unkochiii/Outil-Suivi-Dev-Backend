const mongoose = require("mongoose");

const officialSchema = new mongoose.Schema(
  {
    documentName: {
      type: String,
      required: [true, "Le nom du document est requis"],
      trim: true,
      maxlength: [200, "Nom trop long"],
    },
    pdf: {
      url: {
        type: String,
        required: [true, "L'URL du PDF est requise"],
        trim: true,
      },
      fileName: { type: String, default: null },
      uploadedAt: { type: Date, default: Date.now },
    },
    owner: {
      // ✅ Renommé 'Account' → 'owner' pour plus de clarté
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },
    assignedTo: {
      // ✅ Renommé 'AssignedTo' → 'assignedTo'
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      default: null,
      index: true,
    },
  },
  {
    toJSON: {
      transform: function (doc, ret) {
        // Optionnel: nettoyer les champs sensibles si nécessaire
        return ret;
      },
    },
  }
);

// Index composé pour optimiser les recherches
officialSchema.index({ owner: 1, assignedTo: 1 });

module.exports = mongoose.model("Official", officialSchema);
