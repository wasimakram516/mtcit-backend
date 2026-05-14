const mongoose = require("mongoose");

const DisplayMediaSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: false,
    },
    subcategory: {
      type: String,
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
    layers: [
      {
        fileEn: {
          type: {
            type: String,
            enum: ["image", "video"],
            default: "image",
          },
          url: {
            type: String,
          },
          publicId: {
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
          publicId: {
            type: String,
          },
        },
        // Legacy support
        file: {
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
      },
    ],
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

// Custom validation: require either legacy 'category' or new 'categoryPath'
DisplayMediaSchema.pre("save", function (next) {
  if (!this.category && (!this.categoryPath || this.categoryPath.length === 0)) {
    return next(new Error("Either 'category' (legacy) or 'categoryPath' (new) must be provided."));
  }
  next();
});

module.exports = mongoose.model("DisplayMedia", DisplayMediaSchema);
