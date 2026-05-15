const mongoose = require("mongoose");

/** Global idle background slide — loops on big screen when no display media is active */
const BackgroundSchema = new mongoose.Schema(
  {
    imageUrl: { type: String },
    imageUrlEn: { type: String },
    imageUrlAr: { type: String },
    typeEn: { type: String, enum: ["image", "video"], default: "image" },
    typeAr: { type: String, enum: ["image", "video"], default: "image" },
    /** Playback order (0 = first in loop) */
    layer: { type: Number, required: true, default: 0 },
    opacity: { type: Number, default: 1, min: 0, max: 1 },
    darkOverlay: { type: Number, default: 0, min: 0, max: 1 },
    lightOverlay: { type: Number, default: 0, min: 0, max: 1 },
    displayTitle: { type: String, default: "" },
    titlePosition: {
      x: { type: Number, default: 50, min: 0, max: 100 },
      y: { type: Number, default: 50, min: 0, max: 100 },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Background", BackgroundSchema);
