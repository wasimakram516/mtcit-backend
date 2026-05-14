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
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Category", CategorySchema);
