import { cloudinary, configured } from "../config/cloudinary.js";
import logger from "../utils/logger.js";

const uploadBuffer = (
  buffer,
  folder = "deendaar/misc",
  resourceType = "auto",
) => {
  if (!configured) {
    return Promise.reject(new Error("Cloudinary is not configured"));
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (err, result) => {
        if (err) {
          logger.error(`Cloudinary upload error: ${err.message}`);
          return reject(err);
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      },
    );

    stream.end(buffer);
  });
};

const destroyAsset = async (publicId) => {
  if (!configured || !publicId) return null;

  try {
    return await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    logger.error(`Cloudinary destroy error: ${err.message}`);
    return null;
  }
};

export { uploadBuffer, destroyAsset };
