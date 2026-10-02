import admin from "firebase-admin";
import config from "./env.js";
import logger from "../utils/logger.js";

const { firebase } = config;

let initialized = false;

function initFirebase() {
  if (initialized) {
    return admin;
  }

  if (!firebase.projectId || !firebase.clientEmail || !firebase.privateKey) {
    logger.warn(
      "Firebase credentials not provided - push notifications disabled",
    );

    return null;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: firebase.projectId,
        clientEmail: firebase.clientEmail,
        privateKey: firebase.privateKey,
      }),
    });

    initialized = true;

    logger.info("Firebase Admin initialized");

    return admin;
  } catch (err) {
    logger.error(`Firebase init error: ${err.message}`);
    return null;
  }
}

const getFirebase = () => (initialized ? admin : null);

export { initFirebase, getFirebase };
