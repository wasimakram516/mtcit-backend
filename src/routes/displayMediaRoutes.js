const express = require("express");
const {
  createDisplayMedia,
  updateDisplayMedia,
  deleteDisplayMedia,
  getDisplayMedia,
  getMediaById,
} = require("../controllers/displayMediaController");

const { protect, adminOnly } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");

const router = express.Router();

router.get("/", getDisplayMedia);
router.get("/:id", getMediaById);

router.post(
  "/",
  protect,
  adminOnly,
  upload.fields([
    { name: "mediaAr", maxCount: 1 },
    { name: "mediaEn", maxCount: 1 },
    { name: "pinpoint", maxCount: 1 },
  ]),
  createDisplayMedia
);

router.put(
  "/:id",
  protect,
  adminOnly,
  upload.fields([
    { name: "mediaAr", maxCount: 1 },
    { name: "mediaEn", maxCount: 1 },
    { name: "pinpoint", maxCount: 1 },
  ]),
  updateDisplayMedia
);

router.delete("/:id", protect, adminOnly, deleteDisplayMedia);

module.exports = router;
