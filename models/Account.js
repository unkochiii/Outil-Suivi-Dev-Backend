const mongoose = require("mongoose");

const accountSchema = new mongoose.Schema(
  {
    projectName: {
      type: String,
      required: [true, "Le nom du projet est requis"],
      trim: true,
      maxlength: [100, "Le nom du projet ne peut pas dépasser 100 caractères"],
    },
    email: {
      type: String,
      required: [true, "L'email est requis"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      validate: {
        validator: (value) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(value);
        },
        message: "Format d'email invalide",
      },
    },
    hash: {
      type: String,
      default: null,
      select: false, // Exclure par défaut des requêtes
    },
    salt: {
      type: String,
      default: null,
      select: false,
    },
    token: {
      type: String,
      default: null,
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ["user", "admin"],
        message: "Le rôle doit être 'user' ou 'admin'",
      },
      default: "user",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: mongoose.Schema.Types.Mixed, // Accepte Date ou String
      default: "No Due Date !",
    },
  },
  {
    toJSON: {
      transform: function (doc, ret) {
        delete ret.hash;
        delete ret.salt;
        delete ret.token;
        return ret;
      },
    },
  }
);

// Index composé pour la performance
accountSchema.index({ isTemporaryPassword: 1, passwordExpiresAt: 1 });

module.exports = mongoose.model("Account", accountSchema);
