import express from "express";

import * as ctrl from "../controllers/chat.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

const router = express.Router();

router.use(authenticate);

/*
 * Check whether a conversation already exists.
 *
 * Does NOT create an empty conversation.
 */
router.post(
  "/start",
  requireRole("applicant", "organization"),
  ctrl.startConversation,
);

/*
 * Create a conversation only when sending
 * the first message.
 */
router.post(
  "/start/message",
  requireRole("applicant", "organization"),
  ctrl.createConversationWithMessage,
);

/*
 * List conversations belonging to the
 * authenticated applicant/organization.
 */
router.get(
  "/conversations",
  requireRole("applicant", "organization"),
  ctrl.listConversations,
);

/*
 * Get messages from a conversation.
 */
router.get(
  "/:id/messages",
  requireRole("applicant", "organization"),
  ctrl.getMessages,
);

/*
 * Send a message in an existing conversation.
 */
router.post(
  "/:id/messages",
  requireRole("applicant", "organization"),
  ctrl.sendMessage,
);

export default router;
