const mongoose = require("mongoose");

const DisplayMediaSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
    },
    subcategory: {
      type: String,
    },
    media: {
      en: {
        type: {
          type: String,
          enum: ["image", "video"],
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
      },
      ar: {
        type: {
          type: String,
          enum: ["image", "video"],
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
      },
    },
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
