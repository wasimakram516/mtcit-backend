const Background = require("../models/Background");
const response = require("../utils/response");
const { deleteImage } = require("../config/cloudinary");
const { uploadToCloudinary } = require("../utils/uploadToCloudinary");
const asyncHandler = require("../middlewares/asyncHandler");

let io;

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
  const { title, description, position, size, opacity, rotation } = req.body;

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
  let nextLayer = (highestLayer?.layer || 0) + 1;

  const createdBackgrounds = [];

  // Check for bulk creation first
  const bulkFiles = req.files?.images || [];
  if (bulkFiles.length > 0) {
    for (const [index, file] of bulkFiles.entries()) {
      const cloudinaryResult = await uploadToCloudinary(file.buffer, file.mimetype);
      const baseTitle = title?.trim() || file.originalname.replace(/\.[^/.]+$/, "");

      const background = new Background({
        title: bulkFiles.length > 1 ? `${baseTitle} ${index + 1}` : baseTitle,
        description,
        imageUrl: cloudinaryResult.secure_url,
        imageUrlEn: cloudinaryResult.secure_url,
        publicId: cloudinaryResult.public_id,
        publicIdEn: cloudinaryResult.public_id,
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
    let publicIdEn = "";
    let imageUrlAr = "";
    let publicIdAr = "";

    if (fileEn) {
      const result = await uploadToCloudinary(fileEn.buffer, fileEn.mimetype);
      imageUrlEn = result.secure_url;
      publicIdEn = result.public_id;
    }

    if (fileAr) {
      const result = await uploadToCloudinary(fileAr.buffer, fileAr.mimetype);
      imageUrlAr = result.secure_url;
      publicIdAr = result.public_id;
    }

    const background = new Background({
      title: title?.trim() || "Untitled Background",
      description,
      imageUrl: imageUrlEn || imageUrlAr, // Legacy fallback
      imageUrlEn,
      publicIdEn,
      imageUrlAr,
      publicIdAr,
      publicId: publicIdEn || publicIdAr, // Legacy fallback
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
  const { title, description, position, size, opacity, rotation, layer, isActive } =
    req.body;

  const background = await Background.findById(id);
  if (!background) {
    return response(res, 404, "Background not found");
  }

  // Handle English image update
  const fileEn = req.files?.imageEn?.[0] || req.files?.image?.[0];
  if (fileEn) {
    if (background.publicIdEn) {
      await deleteImage(background.publicIdEn);
    } else if (background.publicId) {
      await deleteImage(background.publicId);
    }
    const result = await uploadToCloudinary(fileEn.buffer, fileEn.mimetype);
    background.imageUrlEn = result.secure_url;
    background.publicIdEn = result.public_id;
    background.imageUrl = result.secure_url; // Sync legacy
    background.publicId = result.public_id; // Sync legacy
  }

  // Handle Arabic image update
  const fileAr = req.files?.imageAr?.[0];
  if (fileAr) {
    if (background.publicIdAr) {
      await deleteImage(background.publicIdAr);
    }
    const result = await uploadToCloudinary(fileAr.buffer, fileAr.mimetype);
    background.imageUrlAr = result.secure_url;
    background.publicIdAr = result.public_id;
  }

  // Update fields
  if (title) background.title = title;
  if (description !== undefined) background.description = description;
  if (position) background.position = JSON.parse(position);
  if (size) background.size = JSON.parse(size);
  if (opacity !== undefined) background.opacity = opacity;
  if (rotation !== undefined) background.rotation = rotation;
  if (layer !== undefined) background.layer = layer;
  if (isActive !== undefined) background.isActive = isActive;

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

  // Delete from Cloudinary
  if (background.publicIdEn) {
    await deleteImage(background.publicIdEn);
  } else if (background.publicId) {
    await deleteImage(background.publicId);
  }
  
  if (background.publicIdAr) {
    await deleteImage(background.publicIdAr);
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
