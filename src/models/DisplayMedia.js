const mongoose = require("mongoose");

/** Foreground content layers (70% stage) — positioned stack with zIndex */
const foregroundLayerSchema = {
  fileEn: {
    type: { type: String, enum: ["image", "video"], default: "image" },
    url: { type: String },
  },
  fileAr: {
    type: { type: String, enum: ["image", "video"], default: "image" },
    url: { type: String },
  },
  position: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
  },
  size: {
    width: { type: Number, default: 100 },
    height: { type: Number, default: 100 },
  },
  title: { type: String, default: "" },
  description: { type: String, default: "" },
  opacity: { type: Number, default: 1 },
  rotation: { type: Number, default: 0 },
  zIndex: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
};

/**
 * Stage background slides (90% area) — sequential loop on big screen.
 * Order = array index / sequence field (not zIndex stacking).
 */
const backgroundSlideSchema = {
  fileEn: {
    type: { type: String, enum: ["image", "video"], default: "image" },
    url: { type: String },
  },
  fileAr: {
    type: { type: String, enum: ["image", "video"], default: "image" },
    url: { type: String },
  },
  opacity: { type: Number, default: 1, min: 0, max: 1 },
  darkOverlay: { type: Number, default: 0, min: 0, max: 1 },
  lightOverlay: { type: Number, default: 0, min: 0, max: 1 },
  displayTitle: { type: String, default: "" },
  titlePosition: {
    x: { type: Number, default: 50, min: 0, max: 100 },
    y: { type: Number, default: 50, min: 0, max: 100 },
  },
  sequence: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
};

const DisplayMediaSchema = new mongoose.Schema(
  {
    categoryPath: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    categoryRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    layers: [backgroundSlideSchema],
    mediaLayers: [foregroundLayerSchema],
    pinpoint: {
      file: {
        type: { type: String, enum: ["image"], default: "image" },
        url: { type: String },
      },
      position: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 },
      },
    },
    qr: {
      en: {
        type: { type: String, enum: ["image"], default: "image" },
        url: { type: String, default: "" },
      },
      ar: {
        type: { type: String, enum: ["image"], default: "image" },
        url: { type: String, default: "" },
      },
      position: {
        x: { type: Number, default: 85, min: 0, max: 100 },
        y: { type: Number, default: 80, min: 0, max: 100 },
      },
      size: { type: Number, default: 10, min: 2, max: 40 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DisplayMedia", DisplayMediaSchema);
