// backend/src/middleware/upload.middleware.js

import multer from "multer";
import ApiError from "../utils/ApiError.js";

const storage = multer.memoryStorage();

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(new ApiError(400, `Unsupported file type: ${file.mimetype}`));
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 10,
  },
});

export const single = (field) => upload.single(field);

export const array = (field, max) => upload.array(field, max);

export const fields = (defs) => upload.fields(defs);

// 🌟 Add this default export so `import upload from ...` works smoothly in your routes
export default {
  single,
  array,
  fields,
  // If your routes expect `upload.single(...)` or `upload.fields(...)` directly on the default import object:
  upload,
};
