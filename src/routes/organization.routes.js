import express from "express";
import * as ctrl from "../controllers/organization.controller.js";
import {
  authenticate,
  requireApproved,
} from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import upload from "../middleware/upload.middleware.js";
import v from "../validations/organization.validation.js";

const router = express.Router();

router.use(authenticate, requireRole("organization"));

router.get("/profile", ctrl.getProfile);
router.put("/profile", validate(v.updateProfile), ctrl.updateProfile);
router.put("/address", validate(v.updateAddress), ctrl.updateAddress);
router.put("/fcm-token", validate(v.fcmToken), ctrl.updateFcmToken);

router.post("/documents", upload.array("documents", 10), ctrl.uploadDocuments);

router.get("/stats", requireApproved, ctrl.dashboardStats);
router.get("/notifications", ctrl.myNotifications);
router.patch("/notifications/:id/read", ctrl.markNotificationRead);

export default router;
