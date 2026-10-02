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

// Public browsing (authenticated not required for list/detail)
router.get("/", validate(v.listQuery, "query"), ctrl.list);
router.get("/:id", ctrl.getOne);

// Organization actions
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

// Job applicants (org side)
router.get(
  "/:jobId/applicants",
  authenticate,
  requireRole("organization"),
  validate(av.listApplicants, "query"),
  applicationCtrl.applicantsForJob,
);

export default router;
