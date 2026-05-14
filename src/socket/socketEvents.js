const DisplayMedia = require("../models/DisplayMedia");
const { normalizeSlug } = require("../utils/slugify");

const toDisplayMediaPayload = (media) => {
  if (!media) return null;
  const m = media.toObject ? media.toObject({ flattenMaps: true }) : { ...media };
  return {
    _id: m._id,
    slug: m.slug,
    title: m.title,
    categoryPath: m.categoryPath,
    categoryRef: m.categoryRef,
    layers: m.layers || [],
    mediaLayers: m.mediaLayers || [],
    pinpoint: m.pinpoint,
  };
};

const socketHandler = (io) => {
  io.on("connection", async (socket) => {
    console.log(`🔵 New client attempted to connect: ${socket.id}`);

    socket.on("connect_error", (err) => {
      console.error("❌ Socket connection error:", err.message);
    });

    // Helper: Fetch all unique categories and subcategories
    const getCategoryOptions = async () => {
        const categories = await DisplayMedia.aggregate([
          {
            $group: {
              _id: "$category",
              subcategories: { $addToSet: "$subcategory" },
            },
          },
          {
            $project: {
              _id: 0,
              category: "$_id",
              subcategories: 1,
            },
          },
        ]);

        const categoryOptions = {};
        categories.forEach((cat) => {
          const filteredSubs = cat.subcategories.filter(Boolean);
          categoryOptions[cat.category] = filteredSubs;
        });

        return categoryOptions;
      };

    // Build category tree from Category collection if available
    const getCategoryTree = async () => {
      try {
        const Category = require("../models/Category");
        const count = await Category.countDocuments();
        if (!count) return null;

        const all = await Category.find().lean().sort({ depth: 1, "name.en": 1 });

        const map = {};
        all.forEach((c) => (map[c._id] = { ...c, children: [] }));
        const roots = [];
        all.forEach((c) => {
          if (c.parent) {
            const parent = map[c.parent];
            if (parent) parent.children.push(map[c._id]);
          } else {
            roots.push(map[c._id]);
          }
        });

        return roots;
      } catch (err) {
        return null;
      }
    };

    // ✅ Emit category options immediately on connection
    try {
      const categoryOptions = await getCategoryOptions();
      socket.emit("categoryOptions", categoryOptions);
      const categoryTree = await getCategoryTree();
      if (categoryTree) socket.emit("categoryTree", categoryTree);
    } catch (error) {
      console.error("❌ Failed to send category options on init:", error);
    }

    // ✅ Add new event to let client explicitly ask for categoryOptions
    socket.on("getCategoryOptions", async () => {
      try {
        const categoryOptions = await getCategoryOptions();
        socket.emit("categoryOptions", categoryOptions);
        const categoryTree = await getCategoryTree();
        if (categoryTree) socket.emit("categoryTree", categoryTree);
      } catch (error) {
        console.error("❌ Failed to emit category options:", error);
      }
    });

    // 🔁 Send all display media to all clients
    const sendInitialMedia = async () => {
      try {
        const media = await DisplayMedia.find();
        io.emit("mediaUpdate", media);
      } catch (error) {
        console.error("❌ Failed to send media on init:", error);
      }
    };

    await sendInitialMedia();

    socket.on("register", async (role) => {
      socket.role = role;
      console.log(`👤 Client ${socket.id} registered as ${role}`);

      try {
        const media = await DisplayMedia.find();
        socket.emit("mediaUpdate", media);
      } catch (error) {
        console.error("❌ Failed to emit media on register:", error);
      }
    });

    // ✅ Broadcast language change to all clients
    socket.on("changeLanguage", (language) => {
      console.log(`🌐 Language changed to: ${language}`);
      io.emit("languageChanged", language);
    });

    // ✅ Category picked: list media for leaf (no auto-load on big screen)
    socket.on("selectCategory", async ({ categoryPath, language }) => {
      console.log(`📂 selectCategory | Lang: ${language}`, categoryPath);

      try {
        io.emit("categorySelected");
        io.emit("displayMedia", null);

        if (!Array.isArray(categoryPath) || categoryPath.length === 0) {
          io.emit("categoryMediaList", { categoryPath: [], leafId: null, items: [] });
          return;
        }

        const mongoose = require("mongoose");
        const leafId = categoryPath[categoryPath.length - 1];
        const leafObjectId = new mongoose.Types.ObjectId(leafId);

        const rows = await DisplayMedia.find({ categoryRef: leafObjectId })
          .select("slug title _id")
          .sort({ title: 1 })
          .lean();

        const items = rows.map((row) => ({
          slug: row.slug,
          title: row.title,
          _id: String(row._id),
        }));

        io.emit("categoryMediaList", {
          categoryPath,
          leafId: String(leafId),
          language: language || "en",
          items,
        });
      } catch (err) {
        console.error("❌ selectCategory:", err);
        io.emit("categoryMediaList", { categoryPath: [], leafId: null, items: [] });
        io.emit("displayMedia", null);
      }
    });

    socket.on("selectMedia", async ({ slug, language }) => {
      console.log(`🎯 selectMedia slug=${slug}`);
      try {
        const normalized = normalizeSlug(slug);
        const trimmed = String(slug ?? "").trim();
        let media = null;
        if (normalized) {
          media = await DisplayMedia.findOne({ slug: normalized });
        }
        if (!media && trimmed) {
          media = await DisplayMedia.findOne({ slug: trimmed.toLowerCase() });
        }
        if (!media) {
          io.emit("displayMedia", null);
          return;
        }
        io.emit("displayMedia", toDisplayMediaPayload(media));
        if (language) {
          io.emit("languageChanged", language);
        }
      } catch (err) {
        console.error("❌ selectMedia:", err);
        io.emit("displayMedia", null);
      }
    });

    // Controller triggers Carbon Mode
    socket.on("toggleCarbonMode", ({ active, value }) => {
      console.log(`🌍 Carbon Mode: ${active ? "ON" : "OFF"} | Value: ${value}`);
      io.emit("carbonMode", { active, value });
    });

    socket.on("disconnect", (reason) => {
      console.log(`❌ Client disconnected: ${socket.id} - Reason: ${reason}`);
    });
  });
};

module.exports = socketHandler;
