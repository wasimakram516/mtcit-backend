const Category = require("../models/Category");
const asyncHandler = require("../middlewares/asyncHandler");
const { uploadToS3 } = require("../utils/s3Storage");

const STORAGE_ROOT = "mtcit/categories";
let io = null;

const getUploadedFile = (req, fieldName) => {
  if (req.files && Array.isArray(req.files[fieldName]) && req.files[fieldName][0]) {
    return req.files[fieldName][0];
  }
  if (req.file && req.file.fieldname === fieldName) {
    return req.file;
  }
  return null;
};

// Helper to build tree from flat list
const buildTree = (items) => {
  const map = {};
  items.forEach((it) => (map[it._id] = { ...it, children: [] }));
  const roots = [];
  items.forEach((it) => {
    if (it.parent) {
      const p = map[it.parent];
      if (p) p.children.push(map[it._id]);
      else roots.push(map[it._id]);
    } else {
      roots.push(map[it._id]);
    }
  });

  // sort children by sortOrder asc (lower first = oldest first) recursively
  const sortRec = (nodes) => {
    nodes.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    nodes.forEach((n) => {
      if (n.children && n.children.length) sortRec(n.children);
    });
  };
  sortRec(roots);

  return roots;
};

const emitCategoryTree = async () => {
  if (!io) return;
  const all = await Category.find().lean().sort({ depth: 1, "name.en": 1 });
  io.emit("categoryTree", buildTree(all));
};

exports.setSocketIo = (socketIoInstance) => {
  io = socketIoInstance;
};

exports.listCategories = asyncHandler(async (req, res) => {
  // fetch all and build a sibling-sorted tree by sortOrder (ascending: oldest first, newest last)
  const all = await Category.find().lean().sort({ sortOrder: 1, createdAt: 1 });
  const tree = buildTree(all);
  res.json({ success: true, data: tree });
});

// Bulk reorder categories: accepts [{ id, sortOrder }]
exports.reorderCategories = asyncHandler(async (req, res) => {
  const list = req.body;
  if (!Array.isArray(list)) return res.status(400).json({ success: false, message: "Invalid payload" });
  const ops = list.map((it) => ({ updateOne: { filter: { _id: it.id }, update: { $set: { sortOrder: Number(it.sortOrder) || 0 } } } }));
  if (ops.length === 0) return res.json({ success: true });
  await Category.bulkWrite(ops);
  res.json({ success: true });
});

exports.createCategory = asyncHandler(async (req, res) => {
  let { name, parent, metadata } = req.body;
  
  if (typeof name === "string") {
    try { name = JSON.parse(name); } catch(e) {}
  }
  if (typeof metadata === "string") {
    try { metadata = JSON.parse(metadata); } catch (e) {}
  }

  if (!name || !name.en) return res.status(400).json({ success: false, message: "Name.en is required" });

  const cat = new Category({
    name,
    parent: parent || null,
    metadata: metadata && typeof metadata === "object" ? metadata : {},
  });

  const iconFile = getUploadedFile(req, "icon");
  const mapQrEnFile = getUploadedFile(req, "mapQrEn") || getUploadedFile(req, "mapQr");
  const mapQrArFile = getUploadedFile(req, "mapQrAr");

  if (iconFile) {
    const { fileUrl } = await uploadToS3(iconFile, STORAGE_ROOT, { inline: true });
    cat.icon = fileUrl;
  }

  if (mapQrEnFile) {
    const { fileUrl } = await uploadToS3(mapQrEnFile, STORAGE_ROOT, { inline: true });
    cat.metadata = {
      ...(cat.metadata || {}),
      mapEmbed: { ...(cat.metadata?.mapEmbed || {}), qrImageUrlEn: fileUrl },
    };
  }

  if (mapQrArFile) {
    const { fileUrl } = await uploadToS3(mapQrArFile, STORAGE_ROOT, { inline: true });
    cat.metadata = {
      ...(cat.metadata || {}),
      mapEmbed: { ...(cat.metadata?.mapEmbed || {}), qrImageUrlAr: fileUrl },
    };
  }

  // Calculate sortOrder: append new category at end (max of siblings + 1)
  if (parent && parent !== "null") {
    const siblings = await Category.find({ parent }).sort({ sortOrder: 1 });
    const maxSort = siblings.length > 0 ? Math.max(...siblings.map(s => s.sortOrder || 0)) : -1;
    cat.sortOrder = maxSort + 1;
  } else {
    const roots = await Category.find({ parent: null }).sort({ sortOrder: 1 });
    const maxSort = roots.length > 0 ? Math.max(...roots.map(r => r.sortOrder || 0)) : -1;
    cat.sortOrder = maxSort + 1;
  }

  await cat.save();
  await emitCategoryTree();
  res.status(201).json({ success: true, data: cat });
});

exports.updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  let { name, parent, removeIcon, removeMapQr, metadata } = req.body;
  
  if (typeof name === "string") {
    try { name = JSON.parse(name); } catch(e) {}
  }
  if (typeof metadata === "string") {
    try { metadata = JSON.parse(metadata); } catch (e) {}
  }

  const cat = await Category.findById(id);
  if (!cat) return res.status(404).json({ success: false, message: "Category not found" });

  const iconFile = getUploadedFile(req, "icon");
  const mapQrEnFile = getUploadedFile(req, "mapQrEn") || getUploadedFile(req, "mapQr");
  const mapQrArFile = getUploadedFile(req, "mapQrAr");
  const { removeMapQrEn, removeMapQrAr } = req.body;

  // Handle icon removal
  if (removeIcon === "true" && !iconFile) {
    cat.icon = "";
  }

  if (name) cat.name = name;
  if (metadata && typeof metadata === "object") {
    const merged = { ...(cat.metadata || {}) };
    for (const [key, value] of Object.entries(metadata)) {
      if (key === "mapEmbed" && value && typeof value === "object" && merged.mapEmbed && typeof merged.mapEmbed === "object") {
        // Deep-merge mapEmbed so existing qrImageUrlEn/qrImageUrlAr are not wiped
        merged.mapEmbed = { ...merged.mapEmbed, ...value };
      } else {
        merged[key] = value;
      }
    }
    cat.metadata = merged;
  }

  if (iconFile) {
    const { fileUrl } = await uploadToS3(iconFile, STORAGE_ROOT, { inline: true });
    cat.icon = fileUrl;
  }

  // Legacy removeMapQr removes both
  if (removeMapQr === "true") {
    cat.metadata = {
      ...(cat.metadata || {}),
      mapEmbed: { ...(cat.metadata?.mapEmbed || {}), qrImageUrlEn: "", qrImageUrlAr: "", qrImageUrl: "" },
    };
  }

  if (removeMapQrEn === "true" && !mapQrEnFile) {
    cat.metadata = {
      ...(cat.metadata || {}),
      mapEmbed: { ...(cat.metadata?.mapEmbed || {}), qrImageUrlEn: "" },
    };
  }

  if (removeMapQrAr === "true" && !mapQrArFile) {
    cat.metadata = {
      ...(cat.metadata || {}),
      mapEmbed: { ...(cat.metadata?.mapEmbed || {}), qrImageUrlAr: "" },
    };
  }

  if (mapQrEnFile) {
    const { fileUrl } = await uploadToS3(mapQrEnFile, STORAGE_ROOT, { inline: true });
    cat.metadata = {
      ...(cat.metadata || {}),
      mapEmbed: { ...(cat.metadata?.mapEmbed || {}), qrImageUrlEn: fileUrl },
    };
  }

  if (mapQrArFile) {
    const { fileUrl } = await uploadToS3(mapQrArFile, STORAGE_ROOT, { inline: true });
    cat.metadata = {
      ...(cat.metadata || {}),
      mapEmbed: { ...(cat.metadata?.mapEmbed || {}), qrImageUrlAr: fileUrl },
    };
  }

  if (parent !== undefined) {
    if (parent === null || parent === "null" || parent === "") {
      cat.parent = null;
      cat.path = [];
      cat.depth = 0;
    } else {
      const parentDoc = await Category.findById(parent);
      if (!parentDoc) return res.status(400).json({ success: false, message: "Parent not found" });
      cat.parent = parent;
      cat.path = [...(parentDoc.path || []), parentDoc._id];
      cat.depth = (parentDoc.depth || 0) + 1;
    }
  }

  await cat.save();
  await emitCategoryTree();
  res.json({ success: true, data: cat });
});

exports.deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const cat = await Category.findById(id);
  if (!cat) return res.status(404).json({ success: false, message: "Category not found" });

  // Reparent children to parent of deleted node (or null)
  await Category.updateMany({ parent: cat._id }, { $set: { parent: cat.parent || null } });

  await Category.deleteOne({ _id: id });
  await emitCategoryTree();
  res.json({ success: true });
});
