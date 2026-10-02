import express from "express";
import * as ctrl from "../controllers/chat.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

const router = express.Router();

router.use(authenticate);

router.post(
  "/start",
  requireRole("applicant", "organization"),
  ctrl.startConversation,
);



router.get(
  "/conversations",
  requireRole("applicant", "organization"),
  ctrl.listConversations,
);
router.get(
  "/:id/messages",
  requireRole("applicant", "organization"),
  ctrl.getMessages,
);
router.post(
  "/:id/messages",
  requireRole("applicant", "organization"),
  ctrl.sendMessage,
);

export default router;
