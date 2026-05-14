const mongoose = require("mongoose");

const BackgroundImageSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
    },
    imageUrl: {
      type: String,
    },
    imageUrlEn: {
      type: String,
    },
    imageUrlAr: {
      type: String,
    },
    typeEn: {
      type: String,
      enum: ["image", "video"],
      default: "image",
    },
    typeAr: {
      type: String,
      enum: ["image", "video"],
      default: "image",
    },
    layer: {
      type: Number,
      required: true,
      default: 0,
    },
    position: {
      x: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      y: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
    },
    size: {
      width: {
        type: Number,
        default: 100,
        min: 10,
        max: 100,
      },
      height: {
        type: Number,
        default: 100,
        min: 10,
        max: 100,
      },
    },
    opacity: {
      type: Number,
      default: 1,
      min: 0,
      max: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    rotation: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Background", BackgroundImageSchema);
