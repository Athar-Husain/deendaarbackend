import Organization from "../../models/Organization.model.js";
import logger from "../../utils/logger.js";

export const seedOrganizations = async () => {
  const orgs = [
    {
      name: "Shahi Masjid Trust",
      type: "masjid", // Make sure this matches your ORG_TYPES constant
      mobile: "9876543210",
      email: "org1@deendaar.com",
      password: "Password123!",
      status: "approved",
      otpVerified: true,
      contactPerson: "Maulana Ahmed",
      address: {
        country: "India",
        state: "Uttar Pradesh",
        district: "Lucknow",
        fullAddress: "Chowk, Lucknow",
      },
    },
    {
      name: "Al-Noor Public School",
      type: "school", // Changed from 'madrasa' to 'school' or any valid ORG_TYPES value
      mobile: "9876543211",
      email: "org2@deendaar.com",
      password: "Password123!",
      status: "approved",
      otpVerified: true,
      contactPerson: "Mufti Zuber",
      address: {
        country: "India",
        state: "Maharashtra",
        district: "Mumbai",
        fullAddress: "Mohammed Ali Road, Mumbai",
      },
    },
  ];

  const createdOrgs = [];
  for (const orgData of orgs) {
    let org = await Organization.findOne({ email: orgData.email });
    if (!org) {
      org = await Organization.create(orgData);
      logger.info(`Organization created: ${org.email}`);
    } else {
      logger.info(`Organization already exists: ${org.email}`);
    }
    createdOrgs.push(org);
  }
  return createdOrgs;
};
