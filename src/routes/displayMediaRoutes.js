const express = require("express");
const {
  createDisplayMedia,
  updateDisplayMedia,
  deleteDisplayMedia,
  getDisplayMedia,
  getMediaById,
  getMediaBySlug,
  listMediaByLeafCategory,
} = require("../controllers/displayMediaController");

const { protect, adminOnly } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");

const router = express.Router();

router.get("/", getDisplayMedia);
router.get("/by-slug/:slug", getMediaBySlug);
router.get("/by-category/:leafId", listMediaByLeafCategory);
router.get("/:id", getMediaById);

router.post(
  "/",
  protect,
  adminOnly,
  upload.fields([
    { name: "mediaLayers", maxCount: 20 },
    { name: "mediaLayersAr", maxCount: 20 },
    { name: "mediaLayerFiles", maxCount: 20 },
    { name: "mediaLayerFilesAr", maxCount: 20 },
    { name: "pinpoint", maxCount: 1 },
  ]),
  createDisplayMedia
);

router.put(
  "/:id",
  protect,
  adminOnly,
  upload.fields([
    { name: "mediaLayers", maxCount: 20 },
    { name: "mediaLayersAr", maxCount: 20 },
    { name: "mediaLayerFiles", maxCount: 20 },
    { name: "mediaLayerFilesAr", maxCount: 20 },
    { name: "pinpoint", maxCount: 1 },
  ]),
  updateDisplayMedia
);

router.delete("/:id", protect, adminOnly, deleteDisplayMedia);

module.exports = router;
