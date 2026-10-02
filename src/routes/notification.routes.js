import express from "express";
import * as ctrl from "../controllers/notification.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

router.get("/", ctrl.list);
router.get("/unread-count", ctrl.unreadCount);
router.patch("/:id/read", ctrl.markRead);
router.patch("/read-all", ctrl.markAllRead);

export default router;
