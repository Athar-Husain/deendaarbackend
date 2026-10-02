import express from "express";
import authRoutes from "./auth.routes.js";
import applicantRoutes from "./applicant.routes.js";
import organizationRoutes from "./organization.routes.js";
import jobRoutes from "./job.routes.js";
import applicationRoutes from "./application.routes.js";
import chatRoutes from "./chat.routes.js";
import notificationRoutes from "./notification.routes.js";
import adminRoutes from "./admin.routes.js";
import * as adminCtrl from "../controllers/admin.controller.js";

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "DEENDAAR API is running",
    time: new Date().toISOString(),
  });
});

router.get("/content/public", adminCtrl.publicContent);

router.use("/auth", authRoutes);
router.use("/applicant", applicantRoutes);
router.use("/organization", organizationRoutes);
router.use("/jobs", jobRoutes);
router.use("/applications", applicationRoutes);
router.use("/chat", chatRoutes);
router.use("/notifications", notificationRoutes);
router.use("/admin", adminRoutes);

export default router;
