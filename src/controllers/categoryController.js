const Category = require("../models/Category");
const asyncHandler = require("../middlewares/asyncHandler");
const { uploadToS3 } = require("../utils/s3Storage");

const STORAGE_ROOT = "mtcit/categories";

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
  return roots;
};

exports.listCategories = asyncHandler(async (req, res) => {
  const all = await Category.find().lean().sort({ depth: 1, "name.en": 1 });
  const tree = buildTree(all);
  res.json({ success: true, data: tree });
});

exports.createCategory = asyncHandler(async (req, res) => {
  let { name, parent } = req.body;
  
  if (typeof name === "string") {
    try { name = JSON.parse(name); } catch(e) {}
  }

  if (!name || !name.en) return res.status(400).json({ success: false, message: "Name.en is required" });

  const cat = new Category({ name, parent: parent || null });

  if (req.file) {
    const { fileUrl } = await uploadToS3(req.file, STORAGE_ROOT, { inline: true });
    cat.icon = fileUrl;
  }

  if (parent && parent !== "null") {
    const parentDoc = await Category.findById(parent);
    if (!parentDoc) return res.status(400).json({ success: false, message: "Parent not found" });
    cat.path = [...(parentDoc.path || []), parentDoc._id];
    cat.depth = (parentDoc.depth || 0) + 1;
  } else {
    cat.path = [];
    cat.depth = 0;
  }

  await cat.save();
  res.status(201).json({ success: true, data: cat });
});

exports.updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  let { name, parent, removeIcon } = req.body;
  
  if (typeof name === "string") {
    try { name = JSON.parse(name); } catch(e) {}
  }

  const cat = await Category.findById(id);
  if (!cat) return res.status(404).json({ success: false, message: "Category not found" });

  // Handle icon removal
  if (removeIcon === "true" && !req.file) {
    cat.icon = "";
  }

  if (name) cat.name = name;
  
  if (req.file) {
    const { fileUrl } = await uploadToS3(req.file, STORAGE_ROOT, { inline: true });
    cat.icon = fileUrl;
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
  res.json({ success: true, data: cat });
});

exports.deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const cat = await Category.findById(id);
  if (!cat) return res.status(404).json({ success: false, message: "Category not found" });

  // Reparent children to parent of deleted node (or null)
  await Category.updateMany({ parent: cat._id }, { $set: { parent: cat.parent || null } });

  await Category.deleteOne({ _id: id });
  res.json({ success: true });
});
