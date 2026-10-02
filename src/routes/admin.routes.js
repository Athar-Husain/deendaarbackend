// backend/src/routes/admin.routes.js
import express from "express";
import * as ctrl from "../controllers/admin.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { authLimiter } from "../middleware/rateLimit.middleware.js";
import v from "../validations/admin.validation.js";

const router = express.Router();

// Public login
router.post("/login", authLimiter, validate(v.login), ctrl.login);

// Everything else requires admin
router.use(authenticate, requireRole("admin"));

router.get("/me", ctrl.me);
router.get("/stats", ctrl.stats);

// Applicants
router.get("/applicants", validate(v.listQuery, "query"), ctrl.listApplicants);
router.get("/applicants/:id", ctrl.getApplicant);
router.patch(
  "/applicants/:id/approve",
  validate(v.statusAction),
  ctrl.approveApplicant,
);
router.patch(
  "/applicants/:id/reject",
  validate(v.statusAction),
  ctrl.rejectApplicant,
);
router.patch(
  "/applicants/:id/request-update",
  validate(v.statusAction),
  ctrl.requestUpdateApplicant,
);
router.patch(
  "/applicants/:id/block",
  validate(v.blockAction),
  ctrl.blockApplicant,
);
router.patch(
  "/applicants/:id/suspend",
  validate(v.suspendAction),
  ctrl.suspendApplicant,
);

// Organizations
router.get(
  "/organizations",
  validate(v.listQuery, "query"),
  ctrl.listOrganizations,
);
router.get("/organizations/:id", ctrl.getOrganization);
router.patch(
  "/organizations/:id/approve",
  validate(v.statusAction),
  ctrl.approveOrganization,
);
router.patch(
  "/organizations/:id/reject",
  validate(v.statusAction),
  ctrl.rejectOrganization,
);
router.patch(
  "/organizations/:id/block",
  validate(v.blockAction),
  ctrl.blockOrganization,
);
router.patch(
  "/organizations/:id/suspend",
  validate(v.suspendAction),
  ctrl.suspendOrganization,
);

// Jobs
router.get("/jobs", validate(v.listQuery, "query"), ctrl.listJobs);

router.get("/jobs/:id", ctrl.getJob);
router.patch("/jobs/:id/moderate", ctrl.moderateJob);
router.delete("/jobs/:id", ctrl.removeJob);

// Content
router.get("/roles", ctrl.listRoles);
router.post("/roles", validate(v.contentItem), ctrl.upsertRole);
router.delete("/roles/:id", ctrl.deleteRole);

router.get("/categories", ctrl.listCategories);
router.post("/categories", validate(v.contentItem), ctrl.upsertCategory);
router.delete("/categories/:id", ctrl.deleteCategory);

router.get("/locations", ctrl.listLocations);
router.post("/locations", validate(v.locationItem), ctrl.upsertLocation);
router.delete("/locations/:id", ctrl.deleteLocation);

// Complaints
router.get("/complaints", validate(v.listQuery, "query"), ctrl.listComplaints);
router.patch(
  "/complaints/:id",
  validate(v.complaintStatus),
  ctrl.updateComplaint,
);

export default router;
