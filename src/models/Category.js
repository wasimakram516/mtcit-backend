const mongoose = require("mongoose");

const CategorySchema = new mongoose.Schema(
  {
    // multilingual label
    name: {
      en: { type: String, required: true },
      ar: { type: String, default: "" },
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    // materialized path from root -> this
    path: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    depth: {
      type: Number,
      default: 0,
    },
    icon: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // ordering for display within siblings — lower = first (oldest first, newest last)
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Category", CategorySchema);
