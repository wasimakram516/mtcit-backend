const multer = require("multer");
const response = require("../utils/response");

const errorHandler = (err, req, res, next) => {
  console.error("❌ Error:", err);

  if (err instanceof multer.MulterError) {
    return response(res, 400, `Upload error: ${err.message}`, null, null);
  }

  if (err.status) {
    return response(res, err.status, err.message, null, null);
  }

  return response(res, 500, "Internal Server Error", null, err.message || "An unexpected error occurred.");
};

module.exports = errorHandler;
