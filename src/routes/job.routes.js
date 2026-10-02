import express from "express";
import * as ctrl from "../controllers/job.controller.js";
import * as applicationCtrl from "../controllers/application.controller.js";
import {
  authenticate,
  requireApproved,
} from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import * as v from "../validations/job.validation.js";
import * as av from "../validations/application.validation.js";

const router = express.Router();

// ==========================================
// 1. ORGANIZATION - MY JOBS
// ==========================================
router.get("/my", authenticate, requireRole("organization"), ctrl.myJobs);

// ==========================================
// 2. JOB APPLICANTS (Org side)
// ==========================================
router.get(
  "/:jobId/applicants",
  authenticate,
  requireRole("organization"),
  validate(av.listApplicants, "query"),
  applicationCtrl.applicantsForJob,
);

// ==========================================
// 3. JOB DETAILS
// ==========================================
// Applicant/mobile job details
router.get("/:id", ctrl.getOne);

// ==========================================
// 4. ORGANIZATION / EMPLOYER ACTIONS
// ==========================================
router.post(
  "/",
  authenticate,
  requireRole("organization"),
  requireApproved,
  validate(v.create),
  ctrl.create,
);

router.put(
  "/:id",
  authenticate,
  requireRole("organization"),
  requireApproved,
  validate(v.update),
  ctrl.update,
);

router.patch(
  "/:id/status",
  authenticate,
  requireRole("organization"),
  validate(v.changeStatus),
  ctrl.changeStatus,
);

router.delete("/:id", authenticate, requireRole("organization"), ctrl.remove);

// ==========================================
// 5. PUBLIC BROWSING
// ==========================================
router.get("/", validate(v.listQuery, "query"), ctrl.list);

export default router;
