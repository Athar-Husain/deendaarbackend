import { getFirebase } from "../config/firebase.js";
import logger from "../utils/logger.js";

const sendPush = async (fcmToken, title, body, data = {}) => {
  const admin = getFirebase();

  if (!admin || !fcmToken) {
    logger.debug(`Push skipped token=${!!fcmToken}`);
    return null;
  }

  try {
    const stringData = Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, String(value ?? "")]),
    );

    const res = await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: stringData,
    });

    logger.info(`Push sent: ${res}`);
    return res;
  } catch (err) {
    logger.error(`Push error: ${err.message}`);
    return null;
  }
};

export { sendPush };
