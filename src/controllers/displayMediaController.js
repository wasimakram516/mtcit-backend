const DisplayMedia = require("../models/DisplayMedia");
const response = require("../utils/response");
const { deleteImage } = require("../config/cloudinary");
const { uploadToCloudinary } = require("../utils/uploadToCloudinary");
const asyncHandler = require("../middlewares/asyncHandler");

let io;

// ✅ Set WebSocket instance
exports.setSocketIo = (socketIoInstance) => {
  io = socketIoInstance;
};

// ✅ Emit updated media list to all screens
const emitMediaUpdate = async () => {
  try {
    if (!io) throw new Error("WebSocket instance (io) is not initialized.");
    const allMedia = await DisplayMedia.find().sort({ createdAt: -1 });
    io.emit("mediaUpdate", allMedia);
  } catch (err) {
    console.error("❌ Failed to emit media update:", err.message);
  }
};

// ✅ Get all media
exports.getDisplayMedia = asyncHandler(async (req, res) => {
  const items = await DisplayMedia.find().sort({ createdAt: -1 });
  return response(
    res,
    200,
    items.length ? "Media fetched." : "No media found.",
    items
  );
});

// ✅ Get a single media item
exports.getMediaById = asyncHandler(async (req, res) => {
  const media = await DisplayMedia.findById(req.params.id);
  if (!media) return response(res, 404, "Media not found.");
  return response(res, 200, "Media retrieved.", media);
});

// ✅ Create new display media
exports.createDisplayMedia = asyncHandler(async (req, res) => {
  const { category, subcategory, pinpointX, pinpointY } = req.body;

  const mediaObj = {
    category,
    subcategory,
    media: {},
  };

  // Upload English media if provided
  if (req.files?.mediaEn?.[0]) {
    const uploadedEn = await uploadToCloudinary(
      req.files.mediaEn[0].buffer,
      req.files.mediaEn[0].mimetype
    );
    mediaObj.media.en = {
      type: uploadedEn.resource_type,
      url: uploadedEn.secure_url,
    };
  }

  // Upload Arabic media if provided
  if (req.files?.mediaAr?.[0]) {
    const uploadedAr = await uploadToCloudinary(
      req.files.mediaAr[0].buffer,
      req.files.mediaAr[0].mimetype
    );
    mediaObj.media.ar = {
      type: uploadedAr.resource_type,
      url: uploadedAr.secure_url,
    };
  }

  // Upload pinpoint if provided
  if (req.files?.pinpoint?.[0]) {
    const pinpointUploaded = await uploadToCloudinary(
      req.files.pinpoint[0].buffer,
      req.files.pinpoint[0].mimetype
    );
    mediaObj.pinpoint = {
      file: { type: "image", url: pinpointUploaded.secure_url },
      position: { x: Number(pinpointX), y: Number(pinpointY) },
    };
  }

  const media = await DisplayMedia.create(mediaObj);
  await emitMediaUpdate();
  return response(res, 201, "Media created successfully.", media);
});

// ✅ Update media entry
exports.updateDisplayMedia = asyncHandler(async (req, res) => {
  const item = await DisplayMedia.findById(req.params.id);
  if (!item) return response(res, 404, "Media item not found.");

  const { category, subcategory, pinpointX, pinpointY } = req.body;

  if (category) item.category = category;
  if (subcategory) item.subcategory = subcategory;

  // Update English media if provided
  if (req.files?.mediaEn?.[0]) {
    if (item.media?.en?.url) await deleteImage(item.media.en.url);
    const uploadedEn = await uploadToCloudinary(
      req.files.mediaEn[0].buffer,
      req.files.mediaEn[0].mimetype
    );
    item.media.en = {
      type: uploadedEn.resource_type,
      url: uploadedEn.secure_url,
    };
  }

  // Update Arabic media if provided
  if (req.files?.mediaAr?.[0]) {
    if (item.media?.ar?.url) await deleteImage(item.media.ar.url);
    const uploadedAr = await uploadToCloudinary(
      req.files.mediaAr[0].buffer,
      req.files.mediaAr[0].mimetype
    );
    item.media.ar = {
      type: uploadedAr.resource_type,
      url: uploadedAr.secure_url,
    };
  }

  // Pinpoint logic stays the same
  if (req.files?.pinpoint?.[0]) {
    if (item.pinpoint?.file?.url) await deleteImage(item.pinpoint.file.url);
    const pinpointUploaded = await uploadToCloudinary(
      req.files.pinpoint[0].buffer,
      req.files.pinpoint[0].mimetype
    );
    if (!item.pinpoint) {
      item.pinpoint = {
        file: { type: "image", url: pinpointUploaded.secure_url },
        position: { x: pinpointX !== undefined ? Number(pinpointX) : 0, y: pinpointY !== undefined ? Number(pinpointY) : 0 },
      };
    } else {
      item.pinpoint.file = { type: "image", url: pinpointUploaded.secure_url };
      item.pinpoint.position = {
        x: pinpointX !== undefined ? Number(pinpointX) : item.pinpoint.position.x,
        y: pinpointY !== undefined ? Number(pinpointY) : item.pinpoint.position.y,
      };
    }
  }

  // Position updates only
  else if (pinpointX !== undefined || pinpointY !== undefined) {
    if (!item.pinpoint) {
      item.pinpoint = {
        file: { type: "image", url: "" },
        position: {
          x: pinpointX !== undefined ? Number(pinpointX) : 0,
          y: pinpointY !== undefined ? Number(pinpointY) : 0,
        },
      };
    } else {
      if (pinpointX !== undefined) item.pinpoint.position.x = Number(pinpointX);
      if (pinpointY !== undefined) item.pinpoint.position.y = Number(pinpointY);
    }
  }

  await item.save();
  await emitMediaUpdate();
  return response(res, 200, "Media updated successfully.", item);
});

// ✅ Delete media
exports.deleteDisplayMedia = asyncHandler(async (req, res) => {
  const item = await DisplayMedia.findById(req.params.id);
  if (!item) return response(res, 404, "Media not found.");

  // Delete English media if exists
  if (item.media?.en?.url) await deleteImage(item.media.en.url);

  // Delete Arabic media if exists
  if (item.media?.ar?.url) await deleteImage(item.media.ar.url);

  // Delete pinpoint image if exists
  if (item.pinpoint?.file?.url) await deleteImage(item.pinpoint.file.url);

  await item.deleteOne();
  await emitMediaUpdate();
  return response(res, 200, "Media deleted successfully.");
});
