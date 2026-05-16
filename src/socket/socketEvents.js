const mongoose = require("mongoose");
const DisplayMedia = require("../models/DisplayMedia");
const Category = require("../models/Category");
const Background = require("../models/Background");

const DEFAULT_EXPERIENCE_STATES = {
  "strategy-forecast": {
    progress: 0,
  },
  "electric-vehicles": {
    yearIndex: 9,
  },
  "map-embed": {},
};

const getExperienceFromCategory = (categoryDoc) => {
  const strategyForecast = categoryDoc?.metadata?.strategyForecast;
  if (strategyForecast?.enabled) {
    const defaultProgress = Number(strategyForecast.defaultProgress);
    return {
      type: "strategy-forecast",
      categoryId: String(categoryDoc._id),
      title: categoryDoc.name || { en: "", ar: "" },
      config: {
        defaultProgress: Number.isFinite(defaultProgress)
          ? Math.max(0, Math.min(100, defaultProgress))
          : DEFAULT_EXPERIENCE_STATES["strategy-forecast"].progress,
      },
    };
  }

  const electricVehicles = categoryDoc?.metadata?.electricVehicles;
  if (electricVehicles?.enabled) {
    const defaultYearIndex = Number(electricVehicles.defaultYearIndex);
    return {
      type: "electric-vehicles",
      categoryId: String(categoryDoc._id),
      title: categoryDoc.name || { en: "", ar: "" },
      config: {
        defaultYearIndex: Number.isFinite(defaultYearIndex)
          ? Math.max(0, Math.min(9, Math.round(defaultYearIndex)))
          : DEFAULT_EXPERIENCE_STATES["electric-vehicles"].yearIndex,
      },
    };
  }

  const mapEmbed = categoryDoc?.metadata?.mapEmbed;
  if (mapEmbed?.enabled && mapEmbed?.embedUrl) {
    return {
      type: "map-embed",
      categoryId: String(categoryDoc._id),
      title: categoryDoc.name || { en: "", ar: "" },
      config: {
        embedUrl: String(mapEmbed.embedUrl || "").trim(),
        qrImageUrl: mapEmbed.qrImageUrl || "",
        qrImageUrlEn: mapEmbed.qrImageUrlEn || mapEmbed.qrImageUrl || "",
        qrImageUrlAr: mapEmbed.qrImageUrlAr || "",
        qrPosition: {
          x: Math.max(0, Math.min(100, Number(mapEmbed.qrPosition?.x) || 72)),
          y: Math.max(0, Math.min(100, Number(mapEmbed.qrPosition?.y) || 74)),
        },
        qrSize: {
          width: Math.max(6, Math.min(40, Number(mapEmbed.qrSize?.width) || 16)),
          height: Math.max(6, Math.min(40, Number(mapEmbed.qrSize?.height) || 16)),
        },
      },
    };
  }

  return null;
};

const getDefaultExperienceState = (experience) => {
  if (!experience?.type) return {};
  const base = DEFAULT_EXPERIENCE_STATES[experience.type] || {};
  if (experience.type === "strategy-forecast") {
    return {
      ...base,
      progress: experience.config?.defaultProgress ?? base.progress,
    };
  }
  if (experience.type === "electric-vehicles") {
    return {
      ...base,
      yearIndex: experience.config?.defaultYearIndex ?? base.yearIndex,
    };
  }
  return { ...base };
};

const socketHandler = (io) => {
  let activeExperience = null;
  let activeExperienceState = {};

  io.on("connection", async (socket) => {
    console.log(`Socket client connected: ${socket.id}`);

    socket.on("connect_error", (err) => {
      console.error("Socket connection error:", err.message);
    });

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

    const getCategoryTree = async () => {
      try {
        const count = await Category.countDocuments();
        if (!count) return null;

        const all = await Category.find().lean().sort({ sortOrder: 1, createdAt: 1 });

        const map = {};
        all.forEach((category) => {
          map[category._id] = { ...category, children: [] };
        });

        const roots = [];
        all.forEach((category) => {
          if (category.parent) {
            const parent = map[category.parent];
            if (parent) parent.children.push(map[category._id]);
          } else {
            roots.push(map[category._id]);
          }
        });

        // Ensure children are sorted by sortOrder asc (lower first = oldest first) recursively
        const sortRec = (nodes) => {
          nodes.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
          nodes.forEach((n) => {
            if (n.children && n.children.length) sortRec(n.children);
          });
        };

        sortRec(roots);

        return roots;
      } catch (err) {
        return null;
      }
    };

    try {
      const categoryOptions = await getCategoryOptions();
      socket.emit("categoryOptions", categoryOptions);
      const categoryTree = await getCategoryTree();
      if (categoryTree) socket.emit("categoryTree", categoryTree);
    } catch (error) {
      console.error("Failed to send category options on init:", error);
    }

    socket.on("getCategoryOptions", async () => {
      try {
        const categoryOptions = await getCategoryOptions();
        socket.emit("categoryOptions", categoryOptions);
        const categoryTree = await getCategoryTree();
        if (categoryTree) socket.emit("categoryTree", categoryTree);
      } catch (error) {
        console.error("Failed to emit category options:", error);
      }
    });

    const sendInitialMedia = async () => {
      try {
        const media = await DisplayMedia.find();
        io.emit("mediaUpdate", media);
      } catch (error) {
        console.error("Failed to send media on init:", error);
      }
    };

    const sendInitialBackgrounds = async (target = io) => {
      try {
        const backgrounds = await Background.find({ isActive: true }).sort("layer");
        target.emit("backgroundUpdate", backgrounds);
      } catch (error) {
        console.error("Failed to send backgrounds on init:", error);
      }
    };

    await sendInitialMedia();
    await sendInitialBackgrounds();

    socket.on("register", async (role) => {
      socket.role = role;
      console.log(`Client ${socket.id} registered as ${role}`);

      try {
        const media = await DisplayMedia.find();
        socket.emit("mediaUpdate", media);
        await sendInitialBackgrounds(socket);
      } catch (error) {
        console.error("Failed to emit media on register:", error);
      }

      if (activeExperience) {
        socket.emit("displayExperience", activeExperience);
        socket.emit("experienceStateChanged", activeExperienceState);
      }
    });

    socket.on("changeLanguage", (language) => {
      console.log(`Language changed to: ${language}`);
      io.emit("languageChanged", language);
    });

    socket.on("selectCategory", async ({ categoryPath, language }) => {
      console.log(`selectCategory | Lang: ${language}`, categoryPath);

      try {
        io.emit("categorySelected");
        io.emit("displayMedia", null);
        io.emit("displayExperience", null);
        activeExperience = null;
        activeExperienceState = {};

        if (!Array.isArray(categoryPath) || categoryPath.length === 0) {
          io.emit("displayMedia", null);
          return;
        }

        const leafId = categoryPath[categoryPath.length - 1];
        const leafObjectId = new mongoose.Types.ObjectId(leafId);
        const leafCategory = await Category.findById(leafObjectId).lean();
        const categoryExperience = getExperienceFromCategory(leafCategory);

        if (categoryExperience) {
          activeExperience = categoryExperience;
          activeExperienceState = getDefaultExperienceState(categoryExperience);

          io.emit("categoryMediaList", {
            categoryPath,
            leafId: String(leafId),
            language: language || "en",
            items: [],
          });
          io.emit("displayExperience", activeExperience);
          io.emit("experienceStateChanged", activeExperienceState);
          return;
        }

        const media = await DisplayMedia.findOne({ categoryRef: leafObjectId }).lean();
        io.emit("displayMedia", media || null);
      } catch (err) {
        console.error("selectCategory:", err);
        io.emit("categoryMediaList", { categoryPath: [], leafId: null, items: [] });
        io.emit("displayMedia", null);
        io.emit("displayExperience", null);
      }
    });

    socket.on("selectMedia", async ({ slug, language }) => {
      console.log(`selectMedia slug=${slug}`);
      try {
        activeExperience = null;
        activeExperienceState = {};
        io.emit("displayExperience", null);

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
        console.error("selectMedia:", err);
        io.emit("displayMedia", null);
      }
    });

    socket.on("updateExperienceState", ({ type, state }) => {
      if (!activeExperience || type !== activeExperience.type || !state || typeof state !== "object") {
        return;
      }

      activeExperienceState = {
        ...getDefaultExperienceState(activeExperience),
        ...activeExperienceState,
        ...state,
      };
      io.emit("experienceStateChanged", activeExperienceState);
    });

    socket.on("toggleCarbonMode", ({ active, value }) => {
      console.log(`Carbon Mode: ${active ? "ON" : "OFF"} | Value: ${value}`);
      io.emit("carbonMode", { active, value });
    });

    socket.on("disconnect", (reason) => {
      console.log(`Client disconnected: ${socket.id} - Reason: ${reason}`);
    });
  });
};

module.exports = socketHandler;
