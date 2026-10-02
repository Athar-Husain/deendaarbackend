import Applicant from "../../models/Applicant.model.js";
import logger from "../../utils/logger.js";

export const seedApplicants = async () => {
  const applicants = [
    {
      mobile: "9123456780",
      email: "applicant1@deendaar.com",
      password: "Password123!",
      status: "approved",
      emailVerified: true,
      name: "Qari Abdullah",
      fatherName: "Haji Ismail",
      gender: "male",
      roles: ["imam", "other"], // Updated to valid enum values from your roles list
      qualifications: { hafiz: true, qari: true, aalim: false, mufti: false },
      experienceYears: 5,
      address: {
        country: "India",
        state: "Uttar Pradesh",
        district: "Lucknow",
      },
    },
    {
      mobile: "9123456781",
      email: "applicant2@deendaar.com",
      password: "Password123!",
      status: "approved",
      emailVerified: true,
      name: "Mufti Bilal",
      fatherName: "Ibrahim",
      gender: "male",
      roles: ["teacher", "khateeb"], // Updated to valid enum values
      qualifications: { hafiz: true, qari: false, aalim: true, mufti: true },
      experienceYears: 8,
      address: { country: "India", state: "Maharashtra", district: "Mumbai" },
    },
  ];

  const createdApplicants = [];
  for (const appData of applicants) {
    let app = await Applicant.findOne({ email: appData.email });
    if (!app) {
      app = await Applicant.create(appData);
      logger.info(`Applicant created: ${app.email}`);
    } else {
      logger.info(`Applicant already exists: ${app.email}`);
    }
    createdApplicants.push(app);
  }
  return createdApplicants;
};
