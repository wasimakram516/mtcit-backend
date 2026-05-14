const AWS = require("aws-sdk");
const path = require("path");
const env = require("../config/env");

AWS.config.update({
  region: env.aws.region,
  accessKeyId: env.aws.accessKeyId,
  secretAccessKey: env.aws.secretAccessKey,
});

const s3 = new AWS.S3();

const normalizeBaseUrl = (value = "") => value.replace(/\/+$/, "");

const sanitizePathSegment = (value) =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";

const sanitizeFileName = (value) =>
  path
    .basename(String(value || "file"))
    .replace(/[^a-zA-Z0-9._-]/g, "_") || "file";

const getFolderName = (mimetype = "") => {
  if (mimetype.startsWith("image/")) return "images";
  if (mimetype.startsWith("video/")) return "videos";
  if (mimetype === "application/pdf") return "pdfs";
  return "others";
};

const getFolderPath = (rootFolder, mimetype, originalname) => {
  const safeRootFolder = sanitizePathSegment(rootFolder);
  const safeFileName = sanitizeFileName(originalname);

  return `${safeRootFolder}/${getFolderName(mimetype)}/${Date.now()}_${safeFileName}`;
};

const buildS3Url = (key) =>
  `https://${env.aws.s3Bucket}.s3.${env.aws.region}.amazonaws.com/${key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;

const buildFileUrl = (key) => {
  const cloudfrontBase = normalizeBaseUrl(env.aws.cloudfrontUrl || "");
  if (cloudfrontBase) {
    return `${cloudfrontBase}/${key}`;
  }

  return buildS3Url(key);
};

const extractKeyFromUrl = (fileKeyOrUrl) => {
  if (!fileKeyOrUrl || !fileKeyOrUrl.startsWith("http")) {
    return fileKeyOrUrl;
  }

  const cloudfrontBase = normalizeBaseUrl(env.aws.cloudfrontUrl || "");
  if (cloudfrontBase && fileKeyOrUrl.startsWith(`${cloudfrontBase}/`)) {
    return decodeURIComponent(fileKeyOrUrl.slice(cloudfrontBase.length + 1));
  }

  try {
    const parsed = new URL(fileKeyOrUrl);
    return decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  } catch (err) {
    console.warn("Failed to extract S3 key from URL:", fileKeyOrUrl);
    return fileKeyOrUrl;
  }
};

const buildContentDisposition = (fileName, inline = true) => {
  const dispositionType = inline ? "inline" : "attachment";
  return `${dispositionType}; filename="${sanitizeFileName(fileName)}"`;
};

const uploadToS3 = async (file, rootFolder, options = {}) => {
  const key = getFolderPath(rootFolder, file.mimetype, file.originalname);
  const contentDisposition = buildContentDisposition(
    file.originalname,
    options.inline !== false
  );

  await s3
    .upload({
      Bucket: env.aws.s3Bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ContentDisposition: contentDisposition,
    })
    .promise();

  return { key, fileUrl: buildFileUrl(key) };
};

const deleteFromS3 = async (fileKeyOrUrl) => {
  if (!fileKeyOrUrl) return;

  const key = extractKeyFromUrl(fileKeyOrUrl);

  try {
    await s3.deleteObject({ Bucket: env.aws.s3Bucket, Key: key }).promise();
    console.log("Deleted from S3:", key);
  } catch (err) {
    console.error("S3 delete error:", err.message);
  }
};

module.exports = {
  deleteFromS3,
  uploadToS3,
};
