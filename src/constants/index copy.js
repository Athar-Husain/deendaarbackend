// backend/src/constants/index.js

export default {
  ROLES: {
    APPLICANT: "applicant",
    ORGANIZATION: "organization",
    ADMIN: "admin",
  },

  ACCOUNT_STATUS: {
    PENDING: "pending",
    APPROVED: "approved",
    REJECTED: "rejected",
    UPDATE_REQUESTED: "update_requested",
  },

  JOB_ROLES: ["imam", "khateeb", "muazzin", "teacher", "other"],

  ORG_TYPES: ["masjid", "madrasa_boys", "madrasa_girls", "school"],

  APPLICATION_STATUS: {
    APPLIED: "applied",
    SHORTLISTED: "shortlisted",
    REJECTED: "rejected",
  },

  JOB_STATUS: {
    OPEN: "open",
    CLOSED: "closed",
    REMOVED: "removed",
  },

  NOTIFICATION_TYPES: {
    APPROVAL: "approval",
    JOB: "job",
    MESSAGE: "message",
    APPLICATION: "application",
    SYSTEM: "system",
  },

  LANGUAGES: ["en", "ur", "ar"],

  UPLOAD_FOLDERS: {
    APPLICANT: "deendaar/applicants",
    ORGANIZATION: "deendaar/organizations",
    JOB: "deendaar/jobs",
  },
};
