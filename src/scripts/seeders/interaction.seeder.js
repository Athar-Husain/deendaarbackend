import Application from "../../models/Application.model.js";
import Conversation from "../../models/Conversation.model.js";
import Message from "../../models/Message.model.js";
import Notification from "../../models/Notification.model.js";
import Complaint from "../../models/Complaint.model.js";
import { NOTIFICATION_TYPES } from "../../constants/index.js"; // Import your constant values
import logger from "../../utils/logger.js";

export const seedInteractions = async (organizations, applicants, jobs) => {
  if (!organizations.length || !applicants.length || !jobs.length) return;

  // 1. Application
  let application = await Application.findOne({
    job: jobs[0]._id,
    applicant: applicants[0]._id,
  });
  if (!application) {
    application = await Application.create({
      job: jobs[0]._id,
      applicant: applicants[0]._id,
      organization: organizations[0]._id,
      status: "applied",
      note: "I am very interested in this position.",
    });
    logger.info("Application seeded");
  }

  // 2. Conversation & Message
  let conversation = await Conversation.findOne({
    applicant: applicants[0]._id,
    organization: organizations[0]._id,
  });
  if (!conversation) {
    conversation = await Conversation.create({
      applicant: applicants[0]._id,
      organization: organizations[0]._id,
      job: jobs[0]._id,
      lastMessage: "Assalamu Alaikum, when is the interview?",
      lastMessageAt: new Date(),
    });

    await Message.create({
      conversation: conversation._id,
      senderModel: "Applicant",
      sender: applicants[0]._id,
      text: "Assalamu Alaikum, when is the interview?",
      read: false,
    });
    logger.info("Conversation and Message seeded");
  }

  // 3. Notification (Uses the first valid element from NOTIFICATION_TYPES enum automatically)
  let notification = await Notification.findOne({
    recipient: applicants[0]._id,
  });
  if (!notification) {
    await Notification.create({
      recipient: applicants[0]._id,
      recipientModel: "Applicant",
      title: "Application Received",
      body: "Your application for Head Imam has been received.",
      type: Object.values(NOTIFICATION_TYPES)[0], // Dynamically uses the first valid allowed enum string
      data: { jobId: jobs[0]._id },
    });
    logger.info("Notification seeded");
  }

  // 4. Complaint
  let complaint = await Complaint.findOne({ reporter: applicants[0]._id });
  if (!complaint) {
    await Complaint.create({
      reporter: applicants[0]._id,
      reporterModel: "Applicant",
      target: organizations[0]._id,
      targetModel: "Organization",
      reason: "Inquiry about job description",
      details: "Need clarification regarding accommodation facilities.",
      status: "open",
    });
    logger.info("Complaint seeded");
  }
};
