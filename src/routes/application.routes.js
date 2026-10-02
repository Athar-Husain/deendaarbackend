import express from "express";
import * as ctrl from "../controllers/application.controller.js";
import {
  authenticate,
  requireApproved,
} from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import v from "../validations/application.validation.js";

const router = express.Router();

router.use(authenticate);

router.post(
  "/",
  requireRole("applicant"),
  requireApproved,
  validate(v.apply),
  ctrl.apply,
);
router.get("/my", requireRole("applicant"), ctrl.myApplications);
router.get("/:id", ctrl.getOne);
router.patch(
  "/:id/status",
  requireRole("organization"),
  requireApproved,
  validate(v.updateStatus),
  ctrl.updateStatus,
);

export default router;
