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

const roleModel = (role) => {
  if (role === "applicant") return "Applicant";
  if (role === "organization") return "Organization";
  throw new ApiError(403, "Invalid role for chat");
};

export const startConversationold = asyncHandler(async (req, res) => {
  const { otherUserId } = req.body;
  if (!otherUserId) throw new ApiError(400, "otherUserId required");

  let applicantId;
  let organizationId;

  if (req.role === "applicant") {
    applicantId = req.user._id;
    organizationId = otherUserId;
  } else if (req.role === "organization") {
    organizationId = req.user._id;
    applicantId = otherUserId;
  } else {
    throw new ApiError(403, "Admins cannot start conversations");
  }

  let convo = await Conversation.findOne({
    applicant: applicantId,
    organization: organizationId,
  });
  if (!convo) {
    convo = await Conversation.create({
      applicant: applicantId,
      organization: organizationId,
    });
  }
  res.json(new ApiResponse(200, convo, "Conversation ready"));
});
export const startConversation = asyncHandler(async (req, res) => {
  const { otherUserId } = req.body;

  if (!otherUserId) {
    throw new ApiError(400, "otherUserId required");
  }

  let applicantId;
  let organizationId;

  if (req.role === "applicant") {
    applicantId = req.user._id;
    organizationId = otherUserId;
  } else if (req.role === "organization") {
    organizationId = req.user._id;
    applicantId = otherUserId;
  } else {
    throw new ApiError(403, "Admins cannot start conversations");
  }

  const convo = await Conversation.findOne({
    applicant: applicantId,
    organization: organizationId,
  });

  // IMPORTANT:
  // Do not create an empty conversation.
  // The conversation should only exist after the first message is sent.
  if (!convo) {
    return res.json(new ApiResponse(200, null, "No existing conversation"));
  }

  res.json(new ApiResponse(200, convo, "Conversation ready"));
});

export const createConversationWithMessage = asyncHandler(async (req, res) => {
  const { otherUserId, text } = req.body;

  if (!otherUserId) {
    throw new ApiError(400, "otherUserId required");
  }

  if (!text || !text.trim()) {
    throw new ApiError(400, "Message text required");
  }

  let applicantId;
  let organizationId;

  if (req.role === "applicant") {
    applicantId = req.user._id;
    organizationId = otherUserId;
  } else if (req.role === "organization") {
    organizationId = req.user._id;
    applicantId = otherUserId;
  } else {
    throw new ApiError(403, "Admins cannot start conversations");
  }

  let convo = await Conversation.findOne({
    applicant: applicantId,
    organization: organizationId,
  });

  if (!convo) {
    convo = await Conversation.create({
      applicant: applicantId,
      organization: organizationId,
    });
  }

  const senderModel = roleModel(req.role);

  const message = await Message.create({
    conversation: convo._id,
    sender: req.user._id,
    senderModel,
    text: text.trim(),
  });

  convo.lastMessage = message.text.slice(0, 200);
  convo.lastMessageAt = new Date();

  await convo.save();

  // Notify the other party.
  try {
    const isApplicantSender = senderModel === "Applicant";

    const recipientId = isApplicantSender
      ? convo.organization
      : convo.applicant;

    const recipientModel = isApplicantSender ? "Organization" : "Applicant";

    const RecipientModel = isApplicantSender ? Organization : Applicant;

    await Notification.create({
      recipient: recipientId,
      recipientModel,
      title: "New message",
      body: message.text.slice(0, 100),
      type: NOTIFICATION_TYPES.MESSAGE,
      data: {
        conversationId: convo._id.toString(),
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
          conversationId: convo._id.toString(),
        },
      );
    }
  } catch (_) {
    // Notification failure must not fail message creation.
  }

  const io = req.app.get("io");

  if (io) {
    io.to(convo._id.toString()).emit("message:receive", message.toObject());
  }

  res
    .status(201)
    .json(new ApiResponse(201, convo, "Conversation created and message sent"));
});

export const listConversations = asyncHandler(async (req, res) => {
  let filter;
  if (req.role === "applicant") filter = { applicant: req.user._id };
  else if (req.role === "organization") filter = { organization: req.user._id };
  else throw new ApiError(403, "Invalid role");

  const conversations = await Conversation.find(filter)
    .populate("applicant", "name documents.profilePhoto")
    .populate("organization", "name type documents")
    .sort({ lastMessageAt: -1 });

  res.json(new ApiResponse(200, conversations, "Conversations fetched"));
});

export const getMessages = asyncHandler(async (req, res) => {
  const convo = await Conversation.findById(req.params.id);
  if (!convo) throw new ApiError(404, "Conversation not found");

  const owns =
    (req.role === "applicant" && convo.applicant.equals(req.user._id)) ||
    (req.role === "organization" && convo.organization.equals(req.user._id)) ||
    req.role === "admin";
  if (!owns) throw new ApiError(403, "Not allowed");

  const messages = await Message.find({ conversation: convo._id }).sort({
    createdAt: 1,
  });

  if (req.role !== "admin") {
    await Message.updateMany(
      {
        conversation: convo._id,
        senderModel: { $ne: roleModel(req.role) },
        read: false,
      },
      { $set: { read: true } },
    );
  }

  res.json(
    new ApiResponse(200, { conversation: convo, messages }, "Messages fetched"),
  );
});

export const sendMessage = asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) throw new ApiError(400, "Message text required");

  const convo = await Conversation.findById(req.params.id);
  if (!convo) throw new ApiError(404, "Conversation not found");

  const owns =
    (req.role === "applicant" && convo.applicant.equals(req.user._id)) ||
    (req.role === "organization" && convo.organization.equals(req.user._id));
  if (!owns) throw new ApiError(403, "Not allowed");

  const senderModel = roleModel(req.role);
  const message = await Message.create({
    conversation: convo._id,
    sender: req.user._id,
    senderModel,
    text: text.trim(),
  });

  convo.lastMessage = text.trim().slice(0, 200);
  convo.lastMessageAt = new Date();
  await convo.save();

  // Notify other party
  try {
    const isApplicantSender = senderModel === "Applicant";
    const recipientId = isApplicantSender
      ? convo.organization
      : convo.applicant;
    const recipientModel = isApplicantSender ? "Organization" : "Applicant";
    const RecipientModel = isApplicantSender ? Organization : Applicant;

    await Notification.create({
      recipient: recipientId,
      recipientModel,
      title: "New message",
      body: message.text.slice(0, 100),
      type: NOTIFICATION_TYPES.MESSAGE,
      data: { conversationId: convo._id.toString() },
    });

    const recipient =
      await RecipientModel.findById(recipientId).select("fcmToken");
    if (recipient?.fcmToken) {
      await sendPush(
        recipient.fcmToken,
        "New message",
        message.text.slice(0, 100),
        {
          conversationId: convo._id.toString(),
        },
      );
    }
  } catch (_) {
    /* silent */
  }

  const io = req.app.get("io");
  if (io) {
    io.to(convo._id.toString()).emit("message:receive", message.toObject());
  }

  res.status(201).json(new ApiResponse(201, message, "Message sent"));
});
