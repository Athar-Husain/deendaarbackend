// backend/src/constants/index.js

export const ROLES = {
  APPLICANT: "applicant",
  ORGANIZATION: "organization",
  ADMIN: "admin",
};

export const ACCOUNT_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  UPDATE_REQUESTED: "update_requested",
};

export const JOB_ROLES = ["imam", "khateeb", "muazzin", "teacher", "other"];

export const ORG_TYPES = ["masjid", "madrasa_boys", "madrasa_girls", "school"];

export const APPLICATION_STATUS = {
  APPLIED: "applied",
  SHORTLISTED: "shortlisted",
  REJECTED: "rejected",
};

// export const JOB_STATUS = {
//   OPEN: "open",
//   CLOSED: "closed",
//   REMOVED: "removed",
// };

export const JOB_STATUS = {
  PENDING: "pending",
  OPEN: "open",
  CLOSED: "closed",
  REJECTED: "rejected",
  REMOVED: "removed",
};

export const NOTIFICATION_TYPES = {
  APPROVAL: "approval",
  JOB: "job",
  MESSAGE: "message",
  APPLICATION: "application",
  SYSTEM: "system",
};

export const LANGUAGES = ["en", "ur", "ar"];

export const UPLOAD_FOLDERS = {
  APPLICANT: "deendaar/applicants",
  ORGANIZATION: "deendaar/organizations",
  JOB: "deendaar/jobs",
};
