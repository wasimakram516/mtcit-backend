const mongoose = require("mongoose");

// Reusable sub-schema for a positioned media layer (used by both layers[] and mediaLayers[])
const layerSchema = {
  fileEn: {
    type: {
      type: String,
      enum: ["image", "video"],
      default: "image",
    },
    url: {
      type: String,
    },
  },
  fileAr: {
    type: {
      type: String,
      enum: ["image", "video"],
      default: "image",
    },
    url: {
      type: String,
    },
  },
  title: {
    type: String,
  },
  description: {
    type: String,
  },
  position: {
    x: {
      type: Number,
      default: 0,
    },
    y: {
      type: Number,
      default: 0,
    },
  },
  size: {
    width: {
      type: Number,
      default: 100,
    },
    height: {
      type: Number,
      default: 100,
    },
  },
  opacity: {
    type: Number,
    default: 1,
  },
  rotation: {
    type: Number,
    default: 0,
  },
  zIndex: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
};

const DisplayMediaSchema = new mongoose.Schema(
  {
    /** Display name in CMS and controller picker */
    title: {
      type: String,
      required: true,
      trim: true,
    },
    /** Globally unique identifier for controller / sockets */
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    // New hierarchical category reference (ordered from root -> leaf)
    categoryPath: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    // Convenience reference to the selected (leaf) category
    categoryRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    // Per-media background layers — rendered at 90% stage (same as global background)
    layers: [layerSchema],
    // Media content layers — rendered in 70% centered foreground container
    mediaLayers: [layerSchema],
    // Logo/pinpoint overlay — rendered above the 70% media container
    pinpoint: {
      file: {
        type: {
          type: String,
          enum: ["image"],
          default: "image",
        },
        url: {
          type: String,
        },
      },
      position: {
        x: {
          type: Number,
          max: 100,
        },
        y: {
          type: Number,
          max: 100,
        },
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DisplayMedia", DisplayMediaSchema);
