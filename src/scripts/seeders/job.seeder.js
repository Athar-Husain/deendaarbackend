import Job from "../../models/Job.model.js";
import logger from "../../utils/logger.js";

export const seedJobs = async (organizations) => {
  if (!organizations || organizations.length === 0) return [];

  const jobsData = [
    {
      organization: organizations[0]._id,
      title: "Head Imam Required",
      role: "imam",
      salary: 25000,
      accommodation: true,
      location: {
        country: "India",
        state: "Uttar Pradesh",
        district: "Lucknow",
        fullAddress: "Chowk Masjid",
      },
      requirements: {
        hafiz: true,
        qari: true,
        notes: "Good voice required for Tajweed.",
      },
      description:
        "Looking for a pious and experienced Imam to lead 5-time prayers and Taraweeh.",
      status: "open",
    },
    {
      organization: organizations[1]._id,
      title: "Islamic Teacher for Hifz Class",
      role: "teacher",
      salary: 20000,
      accommodation: false,
      location: {
        country: "India",
        state: "Maharashtra",
        district: "Mumbai",
        fullAddress: "Madrasa Campus",
      },
      requirements: {
        hafiz: true,
        notes: "Must be patient with young students.",
      },
      description: "Hifz teacher needed for boys batch.",
      status: "open",
    },
  ];

  const createdJobs = [];
  for (const jData of jobsData) {
    let job = await Job.findOne({
      title: jData.title,
      organization: jData.organization,
    });
    if (!job) {
      job = await Job.create(jData);
      logger.info(`Job created: ${job.title}`);
    } else {
      logger.info(`Job already exists: ${job.title}`);
    }
    createdJobs.push(job);
  }
  return createdJobs;
};
