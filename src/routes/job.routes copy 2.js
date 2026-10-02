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

router.get("/:id",  ctrl.getOne);

// router.patch(
//   "/:id/moderate",
//   authenticate,
//   requireRole("admin"),
//   ctrl.moderate,
// );

// ==========================================
// 2. ORGANIZATION / EMPLOYER ACTIONS
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
// 3. JOB APPLICANTS (Org side)
// ==========================================
router.get(
  "/:jobId/applicants",
  authenticate,
  requireRole("organization"),
  validate(av.listApplicants, "query"),
  applicationCtrl.applicantsForJob,
);

// ==========================================
// 4. PUBLIC BROWSING (Keep at the very bottom)
// ==========================================
router.get("/", validate(v.listQuery, "query"), ctrl.list);

export default router;
