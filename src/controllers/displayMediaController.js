const mongoose = require("mongoose");
const DisplayMedia = require("../models/DisplayMedia");
const response = require("../utils/response");
const { normalizeSlug } = require("../utils/slugify");
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
  let urlEn = (layerMeta.removeEn === "true" || layerMeta.removeEn === true) ? "" : (layerMeta.existingUrlEn || layerMeta.existingUrl || "");
  let typeEn = layerMeta.typeEn || layerMeta.type || "image";
  let urlAr = (layerMeta.removeAr === "true" || layerMeta.removeAr === true) ? "" : (layerMeta.existingUrlAr || "");
  let typeAr = layerMeta.typeAr || "image";

  if (uploadedFileEn) {
    const { fileUrl } = await uploadToS3(uploadedFileEn, STORAGE_ROOT, { inline: true });
    urlEn = fileUrl;
    typeEn = getMediaType(uploadedFileEn.mimetype);
  }

  if (uploadedFileAr) {
    const { fileUrl } = await uploadToS3(uploadedFileAr, STORAGE_ROOT, { inline: true });
    urlAr = fileUrl;
    typeAr = getMediaType(uploadedFileAr.mimetype);
  }

  if (!urlEn && !urlAr) return null;

  return {
    fileEn: { type: typeEn, url: urlEn },
    fileAr: { type: typeAr, url: urlAr },
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

/**
 * Shared helper: build an array of layer records from meta + uploaded files.
 * @param {Array} layerMetaList   - parsed JSON array of layer metadata
 * @param {Array} uploadedFilesEn - req.files[fieldEn] array
 * @param {Array} uploadedFilesAr - req.files[fieldAr] array
 */
const buildLayerArray = async (layerMetaList, uploadedFilesEn = [], uploadedFilesAr = []) => {
  const result = [];
  for (const layerMeta of layerMetaList) {
    const fileIndexEnValue = layerMeta.fileIndexEn ?? layerMeta.fileIndex;
    const fileIndexArValue = layerMeta.fileIndexAr;

    const fileIndexEn =
      fileIndexEnValue !== null && fileIndexEnValue !== undefined && fileIndexEnValue !== ""
        ? Number(fileIndexEnValue)
        : null;
    const fileIndexAr =
      fileIndexArValue !== null && fileIndexArValue !== undefined && fileIndexArValue !== ""
        ? Number(fileIndexArValue)
        : null;

    const uploadedFileEn =
      fileIndexEn !== null && Number.isInteger(fileIndexEn) && uploadedFilesEn[fileIndexEn]
        ? uploadedFilesEn[fileIndexEn]
        : null;
    const uploadedFileAr =
      fileIndexAr !== null && Number.isInteger(fileIndexAr) && uploadedFilesAr[fileIndexAr]
        ? uploadedFilesAr[fileIndexAr]
        : null;

    const layerRecord = await buildLayerRecord(layerMeta, uploadedFileEn, uploadedFileAr);
    if (layerRecord) result.push(layerRecord);
  }
  return result;
};

/**
 * Collect all S3 URLs from a layers array.
 */
const collectLayerUrls = (layers = []) => {
  const urls = new Set();
  for (const l of layers) {
    if (l.fileEn?.url) urls.add(l.fileEn.url);
    if (l.fileAr?.url) urls.add(l.fileAr.url);
  }
  return urls;
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
  const items = await DisplayMedia.find().sort({ title: 1, createdAt: -1 });
  return response(res, 200, items.length ? "Media fetched." : "No media found.", items);
});

/** List { slug, title, _id } for a leaf category (controller picker). */
exports.listMediaByLeafCategory = asyncHandler(async (req, res) => {
  const { leafId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(leafId)) {
    return response(res, 400, "Invalid category id.");
  }
  const oid = new mongoose.Types.ObjectId(leafId);
  const items = await DisplayMedia.find({ categoryRef: oid })
    .select("slug title _id")
    .sort({ title: 1 })
    .lean();
  return response(res, 200, "Media for category.", items);
});

/** Single doc by globally unique slug */
exports.getMediaBySlug = asyncHandler(async (req, res) => {
  const slug = normalizeSlug(req.params.slug);
  if (!slug) return response(res, 400, "Invalid slug.");
  const media = await DisplayMedia.findOne({ slug });
  if (!media) return response(res, 404, "Media not found.");
  return response(res, 200, "Media retrieved.", media);
});

// ✅ Get a single media item
exports.getMediaById = asyncHandler(async (req, res) => {
  const media = await DisplayMedia.findById(req.params.id);
  if (!media) return response(res, 404, "Media not found.");
  return response(res, 200, "Media retrieved.", media);
});

// ✅ Create new display media
exports.createDisplayMedia = asyncHandler(async (req, res) => {
  const { pinpointX, pinpointY } = req.body;

  // Parse categoryPath
  const rawCategoryPath = req.body.categoryPath;
  const categoryPath = Array.isArray(rawCategoryPath)
    ? rawCategoryPath
    : (() => {
        try {
          const parsed = JSON.parse(rawCategoryPath);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })();

  if (!categoryPath.length) return response(res, 400, "Category is required.");

  console.log("📝 createDisplayMedia received:", { categoryPath, rawCategoryPath });

  const title = (req.body.title || "").trim();
  const slug = normalizeSlug(req.body.slug || req.body.title || "");
  if (!title) return response(res, 400, "Title is required.");
  if (!slug) return response(res, 400, "Slug is required. Use letters, numbers, and hyphens.");
  if (await DisplayMedia.findOne({ slug }).select("_id").lean()) {
    return response(res, 409, "This slug is already in use.");
  }

  const mediaObj = {
    title,
    slug,
    categoryPath: categoryPath.length ? categoryPath : undefined,
    categoryRef: categoryPath.length ? categoryPath[categoryPath.length - 1] : undefined,
    layers: [],
    mediaLayers: [],
  };

  // ── Background layers ──────────────────────────────────────────────────────
  const layerMetaList = parseJsonArray(req.body.layers);
  if (layerMetaList.length > 0) {
    mediaObj.layers = await buildLayerArray(
      layerMetaList,
      req.files?.mediaLayers || [],
      req.files?.mediaLayersAr || []
    );
  }

  // ── Media content layers ───────────────────────────────────────────────────
  const mediaLayerMetaList = parseJsonArray(req.body.mediaLayersMeta);
  if (mediaLayerMetaList.length > 0) {
    mediaObj.mediaLayers = await buildLayerArray(
      mediaLayerMetaList,
      req.files?.mediaLayerFiles || [],
      req.files?.mediaLayerFilesAr || []
    );
  }

  // ── Pinpoint / Logo ────────────────────────────────────────────────────────
  if (req.files?.pinpoint?.[0]) {
    const pinpointUploaded = await uploadToS3(req.files.pinpoint[0], STORAGE_ROOT, { inline: true });
    mediaObj.pinpoint = {
      file: { type: "image", url: pinpointUploaded.fileUrl },
      position: { x: Number(pinpointX) || 0, y: Number(pinpointY) || 0 },
    };
  }

  let media;
  try {
    media = await DisplayMedia.create(mediaObj);
  } catch (err) {
    if (err?.code === 11000) return response(res, 409, "This slug is already in use.");
    throw err;
  }
  await emitMediaUpdate();
  return response(res, 201, "Media created successfully.", media);
});

// ✅ Update media entry
exports.updateDisplayMedia = asyncHandler(async (req, res) => {
  const item = await DisplayMedia.findById(req.params.id);
  if (!item) return response(res, 404, "Media item not found.");

  const { pinpointX, pinpointY, removePinpoint } = req.body;

  if (req.body.title !== undefined) {
    const nextTitle = String(req.body.title).trim();
    if (!nextTitle) return response(res, 400, "Title cannot be empty.");
    item.title = nextTitle;
  }

  if (req.body.slug !== undefined) {
    const nextSlug = normalizeSlug(req.body.slug);
    if (!nextSlug) return response(res, 400, "Slug cannot be empty.");
    if (nextSlug !== item.slug) {
      const taken = await DisplayMedia.findOne({ slug: nextSlug, _id: { $ne: item._id } }).lean();
      if (taken) return response(res, 409, "This slug is already in use.");
      item.slug = nextSlug;
    }
  }

  // ── Category path ──────────────────────────────────────────────────────────
  const rawCategoryPath = req.body.categoryPath;
  const categoryPath = rawCategoryPath
    ? Array.isArray(rawCategoryPath)
      ? rawCategoryPath
      : (() => {
          try {
            const parsed = JSON.parse(rawCategoryPath);
            return Array.isArray(parsed) ? parsed : null;
          } catch {
            return null;
          }
        })()
    : null;

  if (categoryPath && Array.isArray(categoryPath)) {
    item.categoryPath = categoryPath;
    item.categoryRef = categoryPath.length ? categoryPath[categoryPath.length - 1] : null;
  }

  // ── Pinpoint / Logo ────────────────────────────────────────────────────────
  if (removePinpoint === "true" && !req.files?.pinpoint?.[0]) {
    if (item.pinpoint?.file?.url) await deleteFromS3(item.pinpoint.file.url);
    item.pinpoint = { file: { url: "", type: "image" }, position: { x: 0, y: 0 } };
    item.markModified("pinpoint");
  }

  if (req.files?.pinpoint?.[0]) {
    if (item.pinpoint?.file?.url) await deleteFromS3(item.pinpoint.file.url);
    const pinpointUploaded = await uploadToS3(req.files.pinpoint[0], STORAGE_ROOT, { inline: true });
    if (!item.pinpoint) {
      item.pinpoint = {
        file: { type: "image", url: pinpointUploaded.fileUrl },
        position: {
          x: pinpointX !== undefined ? Number(pinpointX) : 0,
          y: pinpointY !== undefined ? Number(pinpointY) : 0,
        },
      };
    } else {
      item.pinpoint.file = { type: "image", url: pinpointUploaded.fileUrl };
      item.pinpoint.position = {
        x: pinpointX !== undefined ? Number(pinpointX) : item.pinpoint.position.x,
        y: pinpointY !== undefined ? Number(pinpointY) : item.pinpoint.position.y,
      };
    }
    item.markModified("pinpoint");
  } else if (pinpointX !== undefined || pinpointY !== undefined) {
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

  // ── Background layers ──────────────────────────────────────────────────────
  const layerMetaList = req.body.layers !== undefined ? parseJsonArray(req.body.layers) : null;
  if (layerMetaList !== null) {
    const nextLayers = await buildLayerArray(
      layerMetaList,
      req.files?.mediaLayers || [],
      req.files?.mediaLayersAr || []
    );

    // Clean up S3 files that are no longer referenced
    const nextUrls = collectLayerUrls(nextLayers);
    const prevUrls = collectLayerUrls(item.layers || []);
    for (const url of prevUrls) {
      if (url && !nextUrls.has(url)) await deleteFromS3(url);
    }

    item.layers = nextLayers;
  }

  // ── Media content layers ───────────────────────────────────────────────────
  const mediaLayerMetaList = req.body.mediaLayersMeta !== undefined ? parseJsonArray(req.body.mediaLayersMeta) : null;
  if (mediaLayerMetaList !== null) {
    const nextMediaLayers = await buildLayerArray(
      mediaLayerMetaList,
      req.files?.mediaLayerFiles || [],
      req.files?.mediaLayerFilesAr || []
    );

    // Clean up S3 files that are no longer referenced
    const nextUrls = collectLayerUrls(nextMediaLayers);
    const prevUrls = collectLayerUrls(item.mediaLayers || []);
    for (const url of prevUrls) {
      if (url && !nextUrls.has(url)) await deleteFromS3(url);
    }

    item.mediaLayers = nextMediaLayers;
  }

  try {
    await item.save();
  } catch (err) {
    if (err?.code === 11000) return response(res, 409, "This slug is already in use.");
    throw err;
  }
  await emitMediaUpdate();
  return response(res, 200, "Media updated successfully.", item);
});

// ✅ Delete media
exports.deleteDisplayMedia = asyncHandler(async (req, res) => {
  const item = await DisplayMedia.findById(req.params.id);
  if (!item) return response(res, 404, "Media not found.");

  // Delete pinpoint logo if exists
  if (item.pinpoint?.file?.url) await deleteFromS3(item.pinpoint.file.url);

  // Delete background layers
  for (const layer of item.layers || []) {
    if (layer.fileEn?.url) await deleteFromS3(layer.fileEn.url);
    if (layer.fileAr?.url) await deleteFromS3(layer.fileAr.url);
  }

  // Delete media content layers
  for (const layer of item.mediaLayers || []) {
    if (layer.fileEn?.url) await deleteFromS3(layer.fileEn.url);
    if (layer.fileAr?.url) await deleteFromS3(layer.fileAr.url);
  }

  await DisplayMedia.deleteOne({ _id: req.params.id });
  await emitMediaUpdate();
  return response(res, 200, "Media deleted successfully.");
});
