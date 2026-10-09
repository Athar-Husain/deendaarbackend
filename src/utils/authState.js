// backend/src/utils/authState.js

// import { demoMode } from "../config/env.js";
import { ACCOUNT_STATUS } from "../constants/index.js";

/**
 * Build the auth-state block returned to the mobile app.
 */
export const buildAuthState = (user, role) => {
  const approved = user.status === ACCOUNT_STATUS.APPROVED;
  const profileComplete = Boolean(user.profileComplete);
  const emailVerified =
    role === "organization"
      ? Boolean(user.otpVerified)
      : Boolean(user.emailVerified);

  const restricted = !approved;

  const capabilities = {
    canBrowseJobs: approved,
    canApply: approved,
    canChat: approved,
    canUploadDocs: true,
    canEditProfile: true,
  };

  let nextStep = "done";
  if (!emailVerified) nextStep = "verify_email";
  else if (!profileComplete) nextStep = "upload_documents";
  else if (!approved) nextStep = "pending_approval";

  return {
    restricted,
    capabilities,
    nextStep,
    profileComplete,
    approved,
  };
};
