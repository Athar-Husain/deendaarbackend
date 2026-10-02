import express from "express";
import * as ctrl from "../controllers/applicant.controller.js";
import * as applicationCtrl from "../controllers/application.controller.js";
import {
  authenticate,
  requireApproved,
} from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import upload from "../middleware/upload.middleware.js";
import v from "../validations/applicant.validation.js";

const router = express.Router();

router.use(authenticate, requireRole("applicant"));

router.get("/profile", ctrl.getProfile);
router.put("/profile", validate(v.updateProfile), ctrl.updateProfile);
router.put("/address", validate(v.updateAddress), ctrl.updateAddress);
router.put(
  "/qualifications",
  validate(v.updateQualifications),
  ctrl.updateQualifications,
);
router.put("/skills", validate(v.updateSkills), ctrl.updateSkills);
router.put(
  "/preferences",
  validate(v.updatePreferences),
  ctrl.updatePreferences,
);
router.put("/fcm-token", validate(v.fcmToken), ctrl.updateFcmToken);

router.post(
  "/documents",
  upload.fields([
    { name: "profilePhoto", maxCount: 1 },
    { name: "idProof", maxCount: 1 },
    { name: "cv", maxCount: 1 },
    { name: "certificates", maxCount: 10 },
  ]),
  ctrl.uploadDocuments,
);

router.get("/applications", applicationCtrl.myApplications);
router.get("/notifications", ctrl.myNotifications);
router.patch("/notifications/:id/read", ctrl.markNotificationRead);

export default router;
