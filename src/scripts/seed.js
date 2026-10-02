import mongoose from "mongoose";
import { connectDatabase } from "../config/database1.js";
import logger from "../utils/logger.js";

import { seedAdmin } from "./seeders/admin.seeder.js";
import { seedLookups } from "./seeders/lookup.seeder.js";
import { seedOrganizations } from "./seeders/organization.seeder.js";
import { seedApplicants } from "./seeders/applicant.seeder.js";
import { seedJobs } from "./seeders/job.seeder.js";
import { seedInteractions } from "./seeders/interaction.seeder.js";

const seedAll = async () => {
  await connectDatabase();

  logger.info("--- Starting Database Seeding ---");

  await seedAdmin();
  await seedLookups();
  const organizations = await seedOrganizations();
  const applicants = await seedApplicants();
  const jobs = await seedJobs(organizations);
  await seedInteractions(organizations, applicants, jobs);

  logger.info("--- All Seed Data Completed Successfully ---");

  await mongoose.connection.close();
  process.exit(0);
};

seedAll().catch((err) => {
  logger.error(`Seed failed:\n${err.stack || err.message}`);
  process.exit(1);
});
