const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const displayMediaRoutes = require("./routes/displayMediaRoutes"); 
const errorHandler = require("./middlewares/errorHandler");
const seedAdmin = require("./seeder/adminSeeder");

const app = express();

// Middleware
app.use(
  cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "X-Requested-With",
    ],
  })
);
app.use(express.json());
app.use(cookieParser());

// Database Connection & Admin Seeder
const initializeApp = async () => {
  try {
    await connectDB();
    await seedAdmin();
  } catch (error) {
    console.error("❌ Error initializing app:", error);
  }
};

initializeApp();

// ✅ Routes
app.use("/api/auth", authRoutes);
app.use("/api/display-media", displayMediaRoutes); // ✅ your new media system

// Health Check
app.get("/", (req, res) => {
  console.log("📡 Timeline Server is running...");
  res.status(200).send("OK");
});

// Error Handler
app.use(errorHandler);

module.exports = app;
