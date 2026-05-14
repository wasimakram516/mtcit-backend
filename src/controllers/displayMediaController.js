const DisplayMedia = require("../models/DisplayMedia");
const response = require("../utils/response");
const { deleteFromS3, uploadToS3 } = require("../utils/s3Storage");
const asyncHandler = require("../middlewares/asyncHandler");

let io;
const STORAGE_ROOT = "mtcit";

const parseJsonArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizeNumber = (value, fallback = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const getMediaType = (mimetype = "") =>
  mimetype.startsWith("video/") ? "video" : "image";

const buildLayerRecord = async (layerMeta = {}, uploadedFileEn, uploadedFileAr) => {
  let urlEn = layerMeta.existingUrlEn || layerMeta.existingUrl || "";
  let typeEn = layerMeta.typeEn || layerMeta.type || "image";
  let urlAr = layerMeta.existingUrlAr || "";
  let typeAr = layerMeta.typeAr || "image";

  if (uploadedFileEn) {
    const { fileUrl } = await uploadToS3(
      uploadedFileEn,
      STORAGE_ROOT,
      { inline: true }
    );
    urlEn = fileUrl;
    typeEn = getMediaType(uploadedFileEn.mimetype);
  }

  if (uploadedFileAr) {
    const { fileUrl } = await uploadToS3(
      uploadedFileAr,
      STORAGE_ROOT,
      { inline: true }
    );
    urlAr = fileUrl;
    typeAr = getMediaType(uploadedFileAr.mimetype);
  }

  if (!urlEn && !urlAr) return null;

  return {
    fileEn: {
      type: typeEn,
      url: urlEn,
    },
    fileAr: {
      type: typeAr,
      url: urlAr,
    },
    // Legacy support
    file: {
      type: typeEn,
      url: urlEn,
    },
    title: layerMeta.title || "",
    description: layerMeta.description || "",
    position: {
      x: normalizeNumber(layerMeta.position?.x, 0),
      y: normalizeNumber(layerMeta.position?.y, 0),
    },
    size: {
      width: normalizeNumber(layerMeta.size?.width, 100),
      height: normalizeNumber(layerMeta.size?.height, 100),
    },
    opacity: normalizeNumber(layerMeta.opacity, 1),
    rotation: normalizeNumber(layerMeta.rotation, 0),
    zIndex: normalizeNumber(layerMeta.zIndex, 0),
    isActive: layerMeta.isActive !== undefined ? Boolean(layerMeta.isActive) : true,
  };
};

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
  const layerMetaList = parseJsonArray(req.body.layers);
  const uploadedLayerFiles = req.files?.mediaLayers || [];

  const mediaObj = {
    category,
    subcategory,
    media: {},
    layers: [],
  };

  // Upload English media if provided
  if (req.files?.mediaEn?.[0]) {
    const uploadedEn = await uploadToS3(
      req.files.mediaEn[0],
      STORAGE_ROOT,
      { inline: true }
    );
    mediaObj.media.en = {
      type: getMediaType(req.files.mediaEn[0].mimetype),
      url: uploadedEn.fileUrl,
    };
  }

  // Upload Arabic media if provided
  if (req.files?.mediaAr?.[0]) {
    const uploadedAr = await uploadToS3(
      req.files.mediaAr[0],
      STORAGE_ROOT,
      { inline: true }
    );
    mediaObj.media.ar = {
      type: getMediaType(req.files.mediaAr[0].mimetype),
      url: uploadedAr.fileUrl,
    };
  }

  // Upload pinpoint if provided
  if (req.files?.pinpoint?.[0]) {
    const pinpointUploaded = await uploadToS3(
      req.files.pinpoint[0],
      STORAGE_ROOT,
      { inline: true }
    );
    mediaObj.pinpoint = {
      file: { type: "image", url: pinpointUploaded.fileUrl },
      position: { x: Number(pinpointX), y: Number(pinpointY) },
    };
  }

  if (layerMetaList.length > 0) {
    const uploadedLayerFilesEn = req.files?.mediaLayers || [];
    const uploadedLayerFilesAr = req.files?.mediaLayersAr || [];

    for (const layerMeta of layerMetaList) {
      const fileIndexEnValue = layerMeta.fileIndexEn ?? layerMeta.fileIndex;
      const fileIndexArValue = layerMeta.fileIndexAr;

      const fileIndexEn = (fileIndexEnValue !== null && fileIndexEnValue !== undefined && fileIndexEnValue !== "") 
        ? Number(fileIndexEnValue) 
        : null;
      
      const fileIndexAr = (fileIndexArValue !== null && fileIndexArValue !== undefined && fileIndexArValue !== "") 
        ? Number(fileIndexArValue) 
        : null;

      const uploadedFileEn =
        fileIndexEn !== null && Number.isInteger(fileIndexEn) && uploadedLayerFilesEn[fileIndexEn]
          ? uploadedLayerFilesEn[fileIndexEn]
          : null;

      const uploadedFileAr =
        fileIndexAr !== null && Number.isInteger(fileIndexAr) && uploadedLayerFilesAr[fileIndexAr]
          ? uploadedLayerFilesAr[fileIndexAr]
          : null;

      const layerRecord = await buildLayerRecord(layerMeta, uploadedFileEn, uploadedFileAr);
      if (layerRecord) {
        mediaObj.layers.push(layerRecord);
      }
    }
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
  const layerMetaList = req.body.layers ? parseJsonArray(req.body.layers) : null;
  const uploadedLayerFiles = req.files?.mediaLayers || [];

  if (category) item.category = category;
  if (subcategory) item.subcategory = subcategory;

  // Update English media if provided
  if (req.files?.mediaEn?.[0]) {
    if (item.media?.en?.url) await deleteFromS3(item.media.en.url);
    const uploadedEn = await uploadToS3(
      req.files.mediaEn[0],
      STORAGE_ROOT,
      { inline: true }
    );
    item.media.en = {
      type: getMediaType(req.files.mediaEn[0].mimetype),
      url: uploadedEn.fileUrl,
    };
  }

  // Update Arabic media if provided
  if (req.files?.mediaAr?.[0]) {
    if (item.media?.ar?.url) await deleteFromS3(item.media.ar.url);
    const uploadedAr = await uploadToS3(
      req.files.mediaAr[0],
      STORAGE_ROOT,
      { inline: true }
    );
    item.media.ar = {
      type: getMediaType(req.files.mediaAr[0].mimetype),
      url: uploadedAr.fileUrl,
    };
  }

  // Pinpoint logic stays the same
  if (req.files?.pinpoint?.[0]) {
    if (item.pinpoint?.file?.url) await deleteFromS3(item.pinpoint.file.url);
    const pinpointUploaded = await uploadToS3(
      req.files.pinpoint[0],
      STORAGE_ROOT,
      { inline: true }
    );
    if (!item.pinpoint) {
      item.pinpoint = {
        file: { type: "image", url: pinpointUploaded.fileUrl },
        position: { x: pinpointX !== undefined ? Number(pinpointX) : 0, y: pinpointY !== undefined ? Number(pinpointY) : 0 },
      };
    } else {
      item.pinpoint.file = { type: "image", url: pinpointUploaded.fileUrl };
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

  if (layerMetaList) {
    const nextLayers = [];
    const uploadedLayerFilesEn = req.files?.mediaLayers || [];
    const uploadedLayerFilesAr = req.files?.mediaLayersAr || [];

    for (const layerMeta of layerMetaList) {
      const fileIndexEnValue = layerMeta.fileIndexEn ?? layerMeta.fileIndex;
      const fileIndexArValue = layerMeta.fileIndexAr;

      const fileIndexEn = (fileIndexEnValue !== null && fileIndexEnValue !== undefined && fileIndexEnValue !== "") 
        ? Number(fileIndexEnValue) 
        : null;

      const fileIndexAr = (fileIndexArValue !== null && fileIndexArValue !== undefined && fileIndexArValue !== "") 
        ? Number(fileIndexArValue) 
        : null;

      const uploadedFileEn =
        fileIndexEn !== null && Number.isInteger(fileIndexEn) && uploadedLayerFilesEn[fileIndexEn]
          ? uploadedLayerFilesEn[fileIndexEn]
          : null;

      const uploadedFileAr =
        fileIndexAr !== null && Number.isInteger(fileIndexAr) && uploadedLayerFilesAr[fileIndexAr]
          ? uploadedLayerFilesAr[fileIndexAr]
          : null;

      const layerRecord = await buildLayerRecord(layerMeta, uploadedFileEn, uploadedFileAr);
      if (layerRecord) {
        nextLayers.push(layerRecord);
      }
    }

    // Delete any layer assets that are no longer referenced after the update
    const nextUrls = new Set();
    nextLayers.forEach(l => {
      if (l.fileEn?.url) nextUrls.add(l.fileEn.url);
      if (l.fileAr?.url) nextUrls.add(l.fileAr.url);
    });

    const prevUrls = [];
    (item.layers || []).forEach(l => {
      if (l.fileEn?.url) prevUrls.push(l.fileEn.url);
      if (l.fileAr?.url) prevUrls.push(l.fileAr.url);
      if (l.file?.url) prevUrls.push(l.file.url);
    });

    for (const url of prevUrls) {
      if (url && !nextUrls.has(url)) {
        await deleteFromS3(url);
      }
    }

    item.layers = nextLayers;
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
  if (item.media?.en?.url) await deleteFromS3(item.media.en.url);

  // Delete Arabic media if exists
  if (item.media?.ar?.url) await deleteFromS3(item.media.ar.url);

  // Delete pinpoint image if exists
  if (item.pinpoint?.file?.url) await deleteFromS3(item.pinpoint.file.url);

  for (const layer of item.layers || []) {
    if (layer.fileEn?.url) await deleteFromS3(layer.fileEn.url);
    if (layer.fileAr?.url) await deleteFromS3(layer.fileAr.url);
  }

  await item.deleteOne();
  await emitMediaUpdate();
  return response(res, 200, "Media deleted successfully.");
});
