import { v2 as cloudinary } from "cloudinary";
import config from "./env.js";

const { cloudinary: cfg } = config;

let configured = false;

if (cfg.cloudName && cfg.apiKey && cfg.apiSecret) {
  cloudinary.config({
    cloud_name: cfg.cloudName,
    api_key: cfg.apiKey,
    api_secret: cfg.apiSecret,
    secure: true,
  });

  configured = true;
}

export { cloudinary, configured };
