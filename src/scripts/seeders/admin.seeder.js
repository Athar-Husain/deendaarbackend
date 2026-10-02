import Admin from "../../models/Admin.model.js";
import { adminSeed } from "../../config/env.js";
import logger from "../../utils/logger.js";

export const seedAdmin = async () => {
  const existing = await Admin.findOne({ email: adminSeed.email });
  if (!existing) {
    await Admin.create({
      email: adminSeed.email,
      password: adminSeed.password,
      name: "Super Admin",
      role: "superadmin",
    });
    logger.info(`Admin created: ${adminSeed.email}`);
  } else {
    logger.info(`Admin already exists: ${adminSeed.email}`);
  }
};
