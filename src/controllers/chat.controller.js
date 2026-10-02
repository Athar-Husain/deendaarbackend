import Conversation from "../models/Conversation.model.js";
import Message from "../models/Message.model.js";
import Applicant from "../models/Applicant.model.js";
import Organization from "../models/Organization.model.js";
import Notification from "../models/Notification.model.js";

import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

import { NOTIFICATION_TYPES } from "../constants/index.js";
import { sendPush } from "../services/push.service.js";

/**
 * Return the Mongoose model name for the authenticated role.
 */
const roleModel = (role) => {
  if (role === "applicant") return "Applicant";
  if (role === "organization") return "Organization";
  if (role === "admin") return "Admin";

  throw new ApiError(403, "Invalid role for chat");
};

/**
 * Validate the other participant and return the
 * applicant/organization IDs required by Conversation.
 */
const resolveParticipants = async (req, otherUserId) => {
  if (!otherUserId) {
    throw new ApiError(400, "otherUserId required");
  }

  if (req.role === "applicant") {
    const organization = await Organization.findById(otherUserId).select("_id");

    if (!organization) {
      throw new ApiError(404, "Organization not found");
    }

    return {
      applicantId: req.user._id,
      organizationId: organization._id,
    };
  }

  if (req.role === "organization") {
    const applicant = await Applicant.findById(otherUserId).select("_id");

    if (!applicant) {
      throw new ApiError(404, "Applicant not found");
    }

    return {
      applicantId: applicant._id,
      organizationId: req.user._id,
    };
  }

  throw new ApiError(403, "Admins cannot start conversations");
};

/**
 * Find an existing conversation or create one atomically.
 *
 * The unique compound index on Conversation guarantees
 * that only one conversation can exist between the same
 * applicant and organization.
 */
const getOrCreateConversation = async ({
  applicantId,
  organizationId,
  jobId = null,
}) => {
  try {
    const update = {
      $setOnInsert: {
        applicant: applicantId,
        organization: organizationId,
        lastMessage: "",
        lastMessageAt: null,
      },
    };

    if (jobId) {
      update.$setOnInsert.job = jobId;
    }

    return await Conversation.findOneAndUpdate(
      {
        applicant: applicantId,
        organization: organizationId,
      },
      update,
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );
  } catch (error) {
    // If two requests race while creating the same conversation,
    // the unique index can cause one request to receive E11000.
    // In that case, fetch the conversation that the other request created.
    if (error?.code === 11000) {
      const conversation = await Conversation.findOne({
        applicant: applicantId,
        organization: organizationId,
      });

      if (conversation) {
        return conversation;
      }
    }

    throw error;
  }
};

/**
 * Send notification to the other participant.
 *
 * Notification/push failures are intentionally isolated from
 * message creation.
 */
const notifyNewMessage = async (conversation, message, senderModel) => {
  const isApplicantSender = senderModel === "Applicant";

  const recipientId = isApplicantSender
    ? conversation.organization
    : conversation.applicant;

  const recipientModel = isApplicantSender ? "Organization" : "Applicant";

  const RecipientModel = isApplicantSender ? Organization : Applicant;

  await Notification.create({
    recipient: recipientId,
    recipientModel,
    title: "New message",
    body: message.text.slice(0, 100),
    type: NOTIFICATION_TYPES.MESSAGE,
    data: {
      conversationId: conversation._id.toString(),
    },
  });

  const recipient =
    await RecipientModel.findById(recipientId).select("fcmToken");

  if (recipient?.fcmToken) {
    await sendPush(
      recipient.fcmToken,
      "New message",
      message.text.slice(0, 100),
      {
        conversationId: conversation._id.toString(),
      },
    );
  }
};

/**
 * Emit a new message through Socket.IO.
 */
const emitMessage = (req, conversationId, message) => {
  const io = req.app.get("io");

  if (!io) {
    return;
  }

  io.to(conversationId.toString()).emit("message:receive", message.toObject());
};

/**
 * Start conversation.
 *
 * IMPORTANT:
 * This endpoint does NOT create a conversation.
 * It only checks whether an existing conversation exists.
 *
 * The conversation is created when the first message is sent
 * through POST /start/message.
 */
export const startConversation = asyncHandler(async (req, res) => {
  const { otherUserId } = req.body;

  const { applicantId, organizationId } = await resolveParticipants(
    req,
    otherUserId,
  );

  const conversation = await Conversation.findOne({
    applicant: applicantId,
    organization: organizationId,
  });

  if (!conversation) {
    return res.json(new ApiResponse(200, null, "No existing conversation"));
  }

  return res.json(new ApiResponse(200, conversation, "Conversation ready"));
});

/**
 * Create a conversation and send the first message.
 *
 * This is the endpoint that actually creates a new conversation.
 */
export const createConversationWithMessage = asyncHandler(async (req, res) => {
  const { otherUserId, text, jobId } = req.body;

  if (!text || !text.trim()) {
    throw new ApiError(400, "Message text required");
  }

  const { applicantId, organizationId } = await resolveParticipants(
    req,
    otherUserId,
  );

  const conversation = await getOrCreateConversation({
    applicantId,
    organizationId,
    jobId,
  });

  const senderModel = roleModel(req.role);

  const message = await Message.create({
    conversation: conversation._id,
    sender: req.user._id,
    senderModel,
    text: text.trim(),
  });

  conversation.lastMessage = message.text.slice(0, 200);
  conversation.lastMessageAt = message.createdAt || new Date();

  await conversation.save();

  // Notification failure must not fail message creation.
  try {
    await notifyNewMessage(conversation, message, senderModel);
  } catch (error) {
    console.error("New message notification failed:", error);
  }

  emitMessage(req, conversation._id, message);

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        conversation,
        message,
      },
      "Conversation created and message sent",
    ),
  );
});

/**
 * List conversations for the authenticated user.
 */
export const listConversations = asyncHandler(async (req, res) => {
  let filter;

  if (req.role === "applicant") {
    filter = {
      applicant: req.user._id,
    };
  } else if (req.role === "organization") {
    filter = {
      organization: req.user._id,
    };
  } else {
    throw new ApiError(403, "Invalid role");
  }

  const conversations = await Conversation.find(filter)
    .populate("applicant", "name documents.profilePhoto")
    .populate("organization", "name type documents")
    .sort({
      lastMessageAt: -1,
      createdAt: -1,
    });

  return res.json(new ApiResponse(200, conversations, "Conversations fetched"));
});

/**
 * Get messages for a conversation.
 */
export const getMessages = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findById(req.params.id);

  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }

  const ownsConversation =
    (req.role === "applicant" && conversation.applicant.equals(req.user._id)) ||
    (req.role === "organization" &&
      conversation.organization.equals(req.user._id));

  if (!ownsConversation) {
    throw new ApiError(403, "Not allowed");
  }

  const senderModel = roleModel(req.role);

  // Mark messages from the other participant as read first.
  await Message.updateMany(
    {
      conversation: conversation._id,
      senderModel: {
        $ne: senderModel,
      },
      read: false,
    },
    {
      $set: {
        read: true,
      },
    },
  );

  const messages = await Message.find({
    conversation: conversation._id,
  })
    .populate("sender", "name documents.profilePhoto")
    .sort({
      createdAt: 1,
    });

  return res.json(
    new ApiResponse(
      200,
      {
        conversation,
        messages,
      },
      "Messages fetched",
    ),
  );
});

/**
 * Send a message in an existing conversation.
 */
export const sendMessage = asyncHandler(async (req, res) => {
  const { text } = req.body;

  if (!text || !text.trim()) {
    throw new ApiError(400, "Message text required");
  }

  const conversation = await Conversation.findById(req.params.id);

  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }

  const ownsConversation =
    (req.role === "applicant" && conversation.applicant.equals(req.user._id)) ||
    (req.role === "organization" &&
      conversation.organization.equals(req.user._id));

  if (!ownsConversation) {
    throw new ApiError(403, "Not allowed");
  }

  const senderModel = roleModel(req.role);

  const message = await Message.create({
    conversation: conversation._id,
    sender: req.user._id,
    senderModel,
    text: text.trim(),
  });

  conversation.lastMessage = message.text.slice(0, 200);
  conversation.lastMessageAt = message.createdAt || new Date();

  await conversation.save();

  // Notification failure must not fail message creation.
  try {
    await notifyNewMessage(conversation, message, senderModel);
  } catch (error) {
    console.error("New message notification failed:", error);
  }

  emitMessage(req, conversation._id, message);

  return res.status(201).json(new ApiResponse(201, message, "Message sent"));
});
