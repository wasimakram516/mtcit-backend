const Background = require("../models/Background");
const response = require("../utils/response");
const { deleteFromS3, uploadToS3 } = require("../utils/s3Storage");
const asyncHandler = require("../middlewares/asyncHandler");

let io;
const STORAGE_ROOT = "mtcit";

// Set WebSocket instance
exports.setSocketIo = (socketIoInstance) => {
  io = socketIoInstance;
};

// Emit background update to all screens
const emitBackgroundUpdate = async () => {
  try {
    if (!io) throw new Error("WebSocket instance (io) is not initialized.");
    const backgrounds = await Background.find({ isActive: true }).sort(
      "layer"
    );
    io.emit("backgroundUpdate", backgrounds);
  } catch (err) {
    console.error("Failed to emit background update:", err.message);
  }
};

// Get all background images
exports.getAllBackgrounds = asyncHandler(async (req, res) => {
  const backgrounds = await Background.find().sort("layer");
  return response(res, 200, "Backgrounds retrieved successfully", backgrounds);
});

// Get active backgrounds for display
exports.getActiveBackgrounds = asyncHandler(async (req, res) => {
  const backgrounds = await Background.find({ isActive: true }).sort("layer");
  return response(
    res,
    200,
    "Active backgrounds retrieved successfully",
    backgrounds
  );
});

// Create background image
exports.createBackground = asyncHandler(async (req, res) => {
  const { title, description, position, size, opacity, rotation, typeEn, typeAr } = req.body;

  const parseJsonField = (value, fallback) => {
    if (value === undefined || value === null || value === "") return fallback;
    if (typeof value === "object") return value;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };

  const normalizedPosition = parseJsonField(position, { x: 0, y: 0 });
  const normalizedSize = parseJsonField(size, { width: 100, height: 100 });

  const highestLayer = await Background.findOne().sort({ layer: -1 });
  let nextLayer = highestLayer ? highestLayer.layer + 1 : 0;

  const createdBackgrounds = [];

  // Check for bulk creation first
  const bulkFiles = req.files?.images || [];
  if (bulkFiles.length > 0) {
    for (const [index, file] of bulkFiles.entries()) {
      const { fileUrl } = await uploadToS3(file, STORAGE_ROOT, {
        inline: true,
      });
      const baseTitle = title?.trim() || file.originalname.replace(/\.[^/.]+$/, "");

      const background = new Background({
        title: bulkFiles.length > 1 ? `${baseTitle} ${index + 1}` : baseTitle,
        description,
        imageUrl: fileUrl,
        imageUrlEn: fileUrl,
        layer: nextLayer,
        position: normalizedPosition,
        size: normalizedSize,
        opacity: opacity !== undefined ? Number(opacity) : 1,
        rotation: rotation !== undefined ? Number(rotation) : 0,
      });

      await background.save();
      createdBackgrounds.push(background);
      nextLayer += 1;
    }
  } else {
    // Single creation with En/Ar support
    const fileEn = req.files?.imageEn?.[0] || req.files?.image?.[0];
    const fileAr = req.files?.imageAr?.[0];

    if (!fileEn && !fileAr) {
      return response(res, 400, "At least one image file (English or Arabic) is required");
    }

    let imageUrlEn = "";
    let imageUrlAr = "";

    if (fileEn) {
      const { fileUrl } = await uploadToS3(fileEn, STORAGE_ROOT, {
        inline: true,
      });
      imageUrlEn = fileUrl;
    }

    if (fileAr) {
      const { fileUrl } = await uploadToS3(fileAr, STORAGE_ROOT, {
        inline: true,
      });
      imageUrlAr = fileUrl;
    }

    const background = new Background({
      title: title?.trim() || "Untitled Background",
      description,
      imageUrl: imageUrlEn || imageUrlAr, // Legacy fallback
      imageUrlEn,
      imageUrlAr,
      typeEn: typeEn || "image",
      typeAr: typeAr || "image",
      layer: nextLayer,
      position: normalizedPosition,
      size: normalizedSize,
      opacity: opacity !== undefined ? Number(opacity) : 1,
      rotation: rotation !== undefined ? Number(rotation) : 0,
    });

    await background.save();
    createdBackgrounds.push(background);
  }

  await emitBackgroundUpdate();

  return response(
    res,
    201,
    "Background created successfully",
    createdBackgrounds
  );
});

// Update background image
exports.updateBackground = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, description, position, size, opacity, rotation, layer, isActive, typeEn, typeAr, removeImageEn, removeImageAr } =
    req.body;

  const background = await Background.findById(id);
  if (!background) {
    return response(res, 404, "Background not found");
  }

  // Handle English image removal
  if (removeImageEn === "true" && !req.files?.imageEn && !req.files?.image) {
    if (background.imageUrlEn) await deleteFromS3(background.imageUrlEn);
    if (background.imageUrl) await deleteFromS3(background.imageUrl);
    background.imageUrlEn = "";
    background.imageUrl = "";
  }

  // Handle Arabic image removal
  if (removeImageAr === "true" && !req.files?.imageAr) {
    if (background.imageUrlAr) await deleteFromS3(background.imageUrlAr);
    background.imageUrlAr = "";
  }

  // Handle English image update
  const fileEn = req.files?.imageEn?.[0] || req.files?.image?.[0];
  if (fileEn) {
    if (background.imageUrlEn) {
      await deleteFromS3(background.imageUrlEn);
    } else if (background.imageUrl) {
      await deleteFromS3(background.imageUrl);
    }
    const { fileUrl } = await uploadToS3(fileEn, STORAGE_ROOT, {
      inline: true,
    });
    background.imageUrlEn = fileUrl;
    background.imageUrl = fileUrl; // Sync legacy
  }

  // Handle Arabic image update
  const fileAr = req.files?.imageAr?.[0];
  if (fileAr) {
    if (background.imageUrlAr) {
      await deleteFromS3(background.imageUrlAr);
    }
    const { fileUrl } = await uploadToS3(fileAr, STORAGE_ROOT, {
      inline: true,
    });
    background.imageUrlAr = fileUrl;
  }

  // Update fields
  if (title) background.title = title;
  if (description !== undefined) background.description = description;
  if (position) {
    background.position = typeof position === "string" ? JSON.parse(position) : position;
  }
  if (size) {
    background.size = typeof size === "string" ? JSON.parse(size) : size;
  }
  if (opacity !== undefined) background.opacity = opacity;
  if (rotation !== undefined) background.rotation = rotation;
  if (layer !== undefined) background.layer = layer;
  if (isActive !== undefined) background.isActive = isActive;
  if (typeEn !== undefined) background.typeEn = typeEn;
  if (typeAr !== undefined) background.typeAr = typeAr;

  await background.save();
  await emitBackgroundUpdate();

  return response(res, 200, "Background updated successfully", background);
});

// Delete background image
exports.deleteBackground = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const background = await Background.findById(id);
  if (!background) {
    return response(res, 404, "Background not found");
  }

  // Delete from S3
  if (background.imageUrlEn) {
    await deleteFromS3(background.imageUrlEn);
  } else if (background.imageUrl) {
    await deleteFromS3(background.imageUrl);
  }
  
  if (background.imageUrlAr) {
    await deleteFromS3(background.imageUrlAr);
  }

  await Background.deleteOne({ _id: id });
  await emitBackgroundUpdate();

  return response(res, 200, "Background deleted successfully");
});

// Update layer order (reorder backgrounds)
exports.updateLayerOrder = asyncHandler(async (req, res) => {
  const { layerUpdates } = req.body; // Array of { id, layer }

  if (!Array.isArray(layerUpdates)) {
    return response(res, 400, "layerUpdates must be an array");
  }

  // Update all backgrounds with new layers
  for (const update of layerUpdates) {
    await Background.findByIdAndUpdate(update.id, { layer: update.layer });
  }

  await emitBackgroundUpdate();

  const backgrounds = await Background.find().sort("layer");
  return response(
    res,
    200,
    "Layers reordered successfully",
    backgrounds
  );
});

// Update position
exports.updatePosition = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { x, y } = req.body;

  const background = await Background.findByIdAndUpdate(
    id,
    { position: { x, y } },
    { new: true }
  );

  if (!background) {
    return response(res, 404, "Background not found");
  }

  await emitBackgroundUpdate();

  return response(res, 200, "Position updated successfully", background);
});

// Move background forward (increase layer)
exports.moveForward = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const background = await Background.findById(id);
  if (!background) {
    return response(res, 404, "Background not found");
  }

  // Find background with layer just above current
  const nextLayer = await Background.findOne({ layer: { $gt: background.layer } })
    .sort({ layer: 1 })
    .limit(1);

  if (!nextLayer) {
    return response(res, 400, "Already at the top layer");
  }

  // Swap layers
  const tempLayer = background.layer;
  background.layer = nextLayer.layer;
  nextLayer.layer = tempLayer;

  await background.save();
  await nextLayer.save();
  await emitBackgroundUpdate();

  const backgrounds = await Background.find().sort("layer");
  return response(res, 200, "Moved forward successfully", backgrounds);
});

// Move background backward (decrease layer)
exports.moveBackward = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const background = await Background.findById(id);
  if (!background) {
    return response(res, 404, "Background not found");
  }

  // Find background with layer just below current
  const previousLayer = await Background.findOne({
    layer: { $lt: background.layer },
  })
    .sort({ layer: -1 })
    .limit(1);

  if (!previousLayer) {
    return response(res, 400, "Already at the bottom layer");
  }

  // Swap layers
  const tempLayer = background.layer;
  background.layer = previousLayer.layer;
  previousLayer.layer = tempLayer;

  await background.save();
  await previousLayer.save();
  await emitBackgroundUpdate();

  const backgrounds = await Background.find().sort("layer");
  return response(res, 200, "Moved backward successfully", backgrounds);
});

exports.getBackgroundById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const background = await Background.findById(id);
  if (!background) {
    return response(res, 404, "Background not found");
  }
  return response(res, 200, "Background retrieved successfully", background);
});
