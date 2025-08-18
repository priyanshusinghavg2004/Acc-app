/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest, onCall} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const axios = require("axios");
const { getStorage } = require("firebase-admin/storage");

// Initialize Firebase Admin SDK
admin.initializeApp();

const APP_ID = "acc-app-e5316";

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({
  maxInstances: 10,
  region: "asia-south1",
});
// Public document proxy: /d/:token -> fetch and stream from Storage
exports.docproxy = onRequest({ maxInstances: 10, region: "asia-south1", cors: true }, async (req, res) => {
  try {
    // token format: base64 path of the stored file to avoid exposing full paths directly
    const token = req.path.split("/").pop();
    if (!token) return res.status(400).send("Bad Request");
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const storage = getStorage();
    // decoded should be like: bucket/path/to/file.html
    const [bucketName, ...pathParts] = decoded.split("/");
    if (!bucketName || pathParts.length === 0) return res.status(400).send("Bad Request");
    const filePath = pathParts.join("/");
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filePath);
    const [exists] = await file.exists();
    if (!exists) return res.status(404).send("Not Found");
    const [meta] = await file.getMetadata();
    res.set("Cache-Control", "public, max-age=86400");
    if (meta.contentType) res.type(meta.contentType);
    const stream = file.createReadStream();
    stream.on("error", () => res.status(500).end());
    stream.pipe(res);
  } catch (e) {
    logger.error("docproxy failed", e);
    res.status(500).send("Internal Error");
  }
});

// Image proxy to bypass CORS for print/export: /img?u=<encoded>
exports.imgproxy = onRequest({ maxInstances: 10, region: "asia-south1", cors: true }, async (req, res) => {
  try {
    const url = req.query.u;
    if (!url || typeof url !== "string") return res.status(400).send("Bad Request");
    const parsed = new URL(url);
    const host = parsed.host;
    const allowed = [
      "firebasestorage.googleapis.com",
      "storage.googleapis.com",
      "appspot.com",
    ];
    if (!allowed.some((d) => host.endsWith(d) || host.includes("firebasestorage.app"))) {
      return res.status(400).send("Host not allowed");
    }
    const response = await axios.get(url, { responseType: "stream" });
    res.set("Access-Control-Allow-Origin", "*");
    if (response.headers["content-type"]) res.type(response.headers["content-type"]);
    if (response.headers["cache-control"]) res.set("Cache-Control", response.headers["cache-control"]);
    response.data.pipe(res);
  } catch (e) {
    logger.error("imgproxy failed", e);
    res.status(500).send("Internal Error");
  }
});

// Generate password reset link for the authenticated user's primary email
exports.getPasswordResetLink = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  try {
    if (!request.auth) {
      throw new Error("Authentication required");
    }
    const uid = request.auth.uid;
    const userRecord = await admin.auth().getUser(uid);
    const primaryEmail = userRecord.email;
    if (!primaryEmail) {
      throw new Error("No primary email on account");
    }

    const actionCodeSettings = {
      url: "https://acctoo.com/#/login",
      handleCodeInApp: false,
    };
    const link = await admin.auth().generatePasswordResetLink(primaryEmail, actionCodeSettings);

    const db = admin.firestore();
    const settingsDocRef = db.doc(`artifacts/${APP_ID}/users/${uid}/Settings/default`);
    const snap = await settingsDocRef.get();
    const data = snap.exists ? snap.data() : {};
    const recoveryEmail = data.recoveryEmail || data.secondaryEmail || null;
    const recoveryContacts = data.recoveryContacts || data.secondaryPhone || null;

    return { link, primaryEmail, recoveryEmail, recoveryContacts };
  } catch (error) {
    logger.error("getPasswordResetLink failed", error);
    throw new Error(error.message || "Failed to generate reset link");
  }
});

// Security middleware
const validateAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({error: "Unauthorized"});
    return;
  }
  const token = authHeader.split("Bearer ")[1];

  admin.auth().verifyIdToken(token)
      .then((decodedToken) => {
        req.user = decodedToken;
        next();
      })
      .catch((error) => {
        logger.error("Token verification failed:", error);
        res.status(401).json({error: "Invalid token"});
      });
};

/**
 * Check if the given UID is a system admin based on Firestore Settings
 * @param {string} uid
 * @throws {Error} when the user is not a system admin
 */
async function assertSystemAdmin(uid) {
  const db = admin.firestore();
  // Preferred: backoffice_admins
  const boRef = db.doc(`artifacts/${APP_ID}/backoffice_admins/${uid}`);
  const boSnap = await boRef.get();
  if (boSnap.exists) {
    const bo = boSnap.data() || {};
    if (!bo.role) throw new Error("Admin only");
    return;
  }
  // Backward-compat: legacy 'backoffice' collection
  const legacyRef = db.doc(`artifacts/${APP_ID}/backoffice/${uid}`);
  const legacySnap = await legacyRef.get();
  if (legacySnap.exists) {
    const bo = legacySnap.data() || {};
    if (!bo.role) throw new Error("Admin only");
    return;
  }
  // Fallback: legacy settings.systemRole
  const ref = db.doc(`artifacts/${APP_ID}/users/${uid}/Settings/default`);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Admin only");
  const data = snap.data() || {};
  if (!data.systemRole) throw new Error("Admin only");
}

// Backoffice: auth status for current user
exports.backoffice_authStatus = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  try {
    if (!request.auth) throw new Error("Auth required");
    const uid = request.auth.uid;
    const db = admin.firestore();
    const docRef = db.doc(`artifacts/${APP_ID}/backoffice_admins/${uid}`);
    const snap = await docRef.get();
    return { isAdmin: snap.exists, admin: snap.exists ? snap.data() : null };
  } catch (error) {
    logger.error("backoffice_authStatus failed", error);
    throw new Error(error.message || "Failed");
  }
});

// Backoffice: list users with basic info
exports.backoffice_listUsers = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  try {
    if (!request.auth) throw new Error("Auth required");
    await assertSystemAdmin(request.auth.uid);
    const auth = admin.auth();
    const list = await auth.listUsers(1000);
    const db = admin.firestore();
    const users = await Promise.all(list.users.map(async (u) => {
      let settings = null;
      try {
        const s = await db.doc(`artifacts/${APP_ID}/users/${u.uid}/Settings/default`).get();
        settings = s.exists ? s.data() : null;
      } catch (e) {
        // ignore
      }
      let subscription = null;
      try {
        const sub = await db.doc(`subscriptions/${u.uid}`).get();
        subscription = sub.exists ? sub.data() : null;
      } catch (e) {
        // ignore
      }
      return {
        uid: u.uid,
        email: u.email || null,
        phone: u.phoneNumber || (settings && settings.phone) || null,
        name: (settings && (settings.companyName || settings.displayName)) || u.displayName || null,
        companyName: settings && settings.companyName || null,
        planType: subscription && subscription.planType || (settings && settings.planType) || null,
        subscriptionExpiry: subscription && subscription.endDate || null,
        lastLogin: u.metadata && u.metadata.lastSignInTime || null,
      };
    }));
    return { users };
  } catch (error) {
    logger.error("backoffice_listUsers failed", error);
    throw new Error(error.message || "Failed to list users");
  }
});

// Backoffice: plans CRUD
exports.backoffice_listPlans = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  try {
    if (!request.auth) throw new Error("Auth required");
    await assertSystemAdmin(request.auth.uid);
    const db = admin.firestore();
    const snap = await db.collection(`artifacts/${APP_ID}/backoffice_plans`).get();
    const plans = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { plans };
  } catch (error) {
    logger.error("backoffice_listPlans failed", error);
    throw new Error(error.message || "Failed to list plans");
  }
});

exports.backoffice_upsertPlan = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  try {
    if (!request.auth) throw new Error("Auth required");
    await assertSystemAdmin(request.auth.uid);
    const { id, plan } = request.data || {};
    if (!plan || typeof plan !== "object") throw new Error("plan required");
    const db = admin.firestore();
    const ref = id ? db.doc(`artifacts/${APP_ID}/backoffice_plans/${id}`) : db.collection(`artifacts/${APP_ID}/backoffice_plans`).doc();
    await ref.set({ ...plan, updatedAt: new Date().toISOString() }, { merge: true });
    await writeAdminLog({ adminUid: request.auth.uid, action: id ? "update_plan" : "create_plan", module: "plans", details: { id: ref.id } });
    return { ok: true, id: ref.id };
  } catch (error) {
    logger.error("backoffice_upsertPlan failed", error);
    throw new Error(error.message || "Failed to save plan");
  }
});

exports.backoffice_deletePlan = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  try {
    if (!request.auth) throw new Error("Auth required");
    await assertSystemAdmin(request.auth.uid);
    const { id } = request.data || {};
    if (!id) throw new Error("id required");
    const db = admin.firestore();
    await db.doc(`artifacts/${APP_ID}/backoffice_plans/${id}`).delete();
    await writeAdminLog({ adminUid: request.auth.uid, action: "delete_plan", module: "plans", details: { id } });
    return { ok: true };
  } catch (error) {
    logger.error("backoffice_deletePlan failed", error);
    throw new Error(error.message || "Failed to delete plan");
  }
});

// Backoffice: coupons CRUD
exports.backoffice_listCoupons = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  try {
    if (!request.auth) throw new Error("Auth required");
    await assertSystemAdmin(request.auth.uid);
    const db = admin.firestore();
    const snap = await db.collection(`artifacts/${APP_ID}/backoffice_coupons`).get();
    const coupons = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { coupons };
  } catch (error) {
    logger.error("backoffice_listCoupons failed", error);
    throw new Error(error.message || "Failed to list coupons");
  }
});

exports.backoffice_upsertCoupon = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  try {
    if (!request.auth) throw new Error("Auth required");
    await assertSystemAdmin(request.auth.uid);
    const { id, coupon } = request.data || {};
    if (!coupon || typeof coupon !== "object") throw new Error("coupon required");
    const db = admin.firestore();
    const ref = id ? db.doc(`artifacts/${APP_ID}/backoffice_coupons/${id}`) : db.collection(`artifacts/${APP_ID}/backoffice_coupons`).doc();
    await ref.set({ ...coupon, updatedAt: new Date().toISOString() }, { merge: true });
    await writeAdminLog({ adminUid: request.auth.uid, action: id ? "update_coupon" : "create_coupon", module: "coupons", details: { id: ref.id } });
    return { ok: true, id: ref.id };
  } catch (error) {
    logger.error("backoffice_upsertCoupon failed", error);
    throw new Error(error.message || "Failed to save coupon");
  }
});

exports.backoffice_deleteCoupon = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  try {
    if (!request.auth) throw new Error("Auth required");
    await assertSystemAdmin(request.auth.uid);
    const { id } = request.data || {};
    if (!id) throw new Error("id required");
    const db = admin.firestore();
    await db.doc(`artifacts/${APP_ID}/backoffice_coupons/${id}`).delete();
    await writeAdminLog({ adminUid: request.auth.uid, action: "delete_coupon", module: "coupons", details: { id } });
    return { ok: true };
  } catch (error) {
    logger.error("backoffice_deleteCoupon failed", error);
    throw new Error(error.message || "Failed to delete coupon");
  }
});

// Backoffice: website content
exports.backoffice_getWebsiteContent = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  try {
    if (!request.auth) throw new Error("Auth required");
    await assertSystemAdmin(request.auth.uid);
    const db = admin.firestore();
    const ref = db.doc(`artifacts/${APP_ID}/backoffice_website/content`);
    const snap = await ref.get();
    return { content: snap.exists ? snap.data() : {} };
  } catch (error) {
    logger.error("backoffice_getWebsiteContent failed", error);
    throw new Error(error.message || "Failed to get content");
  }
});

exports.backoffice_updateWebsiteContent = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  try {
    if (!request.auth) throw new Error("Auth required");
    await assertSystemAdmin(request.auth.uid);
    const { content } = request.data || {};
    if (!content || typeof content !== "object") throw new Error("content required");
    const db = admin.firestore();
    const ref = db.doc(`artifacts/${APP_ID}/backoffice_website/content`);
    await ref.set({ ...content, updatedAt: new Date().toISOString() }, { merge: true });
    await writeAdminLog({ adminUid: request.auth.uid, action: "update_website", module: "website" });
    return { ok: true };
  } catch (error) {
    logger.error("backoffice_updateWebsiteContent failed", error);
    throw new Error(error.message || "Failed to update content");
  }
});

// Backoffice: user allocations (services per user)
exports.backoffice_listAllocations = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  try {
    if (!request.auth) throw new Error("Auth required");
    await assertSystemAdmin(request.auth.uid);
    const db = admin.firestore();
    const snap = await db.collection(`artifacts/${APP_ID}/backoffice_user_allocations`).get();
    const allocations = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { allocations };
  } catch (error) {
    logger.error("backoffice_listAllocations failed", error);
    throw new Error(error.message || "Failed to list allocations");
  }
});

exports.backoffice_setAllocation = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  try {
    if (!request.auth) throw new Error("Auth required");
    await assertSystemAdmin(request.auth.uid);
    const { userId, allocation } = request.data || {};
    if (!userId || !allocation || typeof allocation !== "object") throw new Error("invalid payload");
    const db = admin.firestore();
    const ref = db.doc(`artifacts/${APP_ID}/backoffice_user_allocations/${userId}`);
    await ref.set({ ...allocation, updatedAt: new Date().toISOString() }, { merge: true });
    await writeAdminLog({ adminUid: request.auth.uid, action: "set_allocation", module: "allocations", targetUserId: userId });
    return { ok: true };
  } catch (error) {
    logger.error("backoffice_setAllocation failed", error);
    throw new Error(error.message || "Failed to set allocation");
  }
});

// Backoffice: add/remove admin
exports.backoffice_addAdmin = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  try {
    if (!request.auth) throw new Error("Auth required");
    await assertSystemAdmin(request.auth.uid);
    const { uid, role = "superAdmin", name = null, email = null } = request.data || {};
    if (!uid) throw new Error("uid required");
    const db = admin.firestore();
    const ref = db.doc(`artifacts/${APP_ID}/backoffice_admins/${uid}`);
    await ref.set({ role, name, email, updatedAt: new Date().toISOString() }, { merge: true });
    await writeAdminLog({ adminUid: request.auth.uid, action: "add_admin", module: "admins", targetUserId: uid, details: { role } });
    return { ok: true };
  } catch (error) {
    logger.error("backoffice_addAdmin failed", error);
    throw new Error(error.message || "Failed to add admin");
  }
});

// Backoffice: providers (sms/email/payment) CRUD
exports.backoffice_listProviders = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  try {
    if (!request.auth) throw new Error("Auth required");
    await assertSystemAdmin(request.auth.uid);
    const { kind } = request.data || {}; // 'sms' | 'payment' | 'email'
    const db = admin.firestore();
    const base = `artifacts/${APP_ID}/backoffice_providers`;
    if (kind) {
      const snap = await db.collection(`${base}_${kind}`).get();
      return { providers: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
    }
    const sms = await db.collection(`${base}_sms`).get();
    const payment = await db.collection(`${base}_payment`).get();
    const email = await db.collection(`${base}_email`).get();
    return {
      sms: sms.docs.map((d) => ({ id: d.id, ...d.data() })),
      payment: payment.docs.map((d) => ({ id: d.id, ...d.data() })),
      email: email.docs.map((d) => ({ id: d.id, ...d.data() })),
    };
  } catch (error) {
    logger.error("backoffice_listProviders failed", error);
    throw new Error(error.message || "Failed to list providers");
  }
});

exports.backoffice_upsertProvider = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  try {
    if (!request.auth) throw new Error("Auth required");
    await assertSystemAdmin(request.auth.uid);
    const { kind, id, config } = request.data || {};
    if (!kind || !config || typeof config !== "object") throw new Error("invalid payload");
    const db = admin.firestore();
    const col = db.collection(`artifacts/${APP_ID}/backoffice_providers_${kind}`);
    const ref = id ? col.doc(id) : col.doc();
    await ref.set({ ...config, updatedAt: new Date().toISOString() }, { merge: true });
    await writeAdminLog({ adminUid: request.auth.uid, action: id ? "update_provider" : "create_provider", module: "providers", details: { kind, id: ref.id } });
    return { ok: true, id: ref.id };
  } catch (error) {
    logger.error("backoffice_upsertProvider failed", error);
    throw new Error(error.message || "Failed to save provider");
  }
});

exports.backoffice_deleteProvider = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  try {
    if (!request.auth) throw new Error("Auth required");
    await assertSystemAdmin(request.auth.uid);
    const { kind, id } = request.data || {};
    if (!kind || !id) throw new Error("invalid payload");
    const db = admin.firestore();
    await db.doc(`artifacts/${APP_ID}/backoffice_providers_${kind}/${id}`).delete();
    await writeAdminLog({ adminUid: request.auth.uid, action: "delete_provider", module: "providers", details: { kind, id } });
    return { ok: true };
  } catch (error) {
    logger.error("backoffice_deleteProvider failed", error);
    throw new Error(error.message || "Failed to delete provider");
  }
});

// Backoffice: notifications (broadcast or to user)
exports.backoffice_sendNotification = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  try {
    if (!request.auth) throw new Error("Auth required");
    await assertSystemAdmin(request.auth.uid);
    const { target = "broadcast", uid, title, body, data } = request.data || {};
    if (!title || !body) throw new Error("title and body required");
    const db = admin.firestore();
    let recipients = [];
    if (target === "user") {
      if (!uid) throw new Error("uid required");
      recipients = [uid];
    } else {
      const list = await admin.auth().listUsers(1000);
      recipients = list.users.map((u) => u.uid);
    }
    const batch = db.batch();
    const payload = { title, body, data: data || null, createdAt: new Date().toISOString(), createdBy: request.auth.uid };
    for (const r of recipients) {
      const ref = db.collection("notifications").doc(r).collection("messages").doc();
      batch.set(ref, payload);
    }
    await batch.commit();
    await writeAdminLog({ adminUid: request.auth.uid, action: "send_notification", module: "notifications", targetUserId: target === "user" ? uid : null, details: { title } });
    return { ok: true, recipients: recipients.length };
  } catch (error) {
    logger.error("backoffice_sendNotification failed", error);
    throw new Error(error.message || "Failed to send notification");
  }
});

// Backoffice: owner employees CRUD
exports.backoffice_listOwnerEmployees = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  try {
    if (!request.auth) throw new Error("Auth required");
    await assertSystemAdmin(request.auth.uid);
    const db = admin.firestore();
    const snap = await db.collection(`artifacts/${APP_ID}/backoffice_employees`).get();
    return { employees: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
  } catch (error) {
    logger.error("backoffice_listOwnerEmployees failed", error);
    throw new Error(error.message || "Failed to list employees");
  }
});

exports.backoffice_upsertOwnerEmployee = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  try {
    if (!request.auth) throw new Error("Auth required");
    await assertSystemAdmin(request.auth.uid);
    const { id, employee } = request.data || {};
    if (!employee || typeof employee !== "object") throw new Error("employee required");
    const db = admin.firestore();
    const col = db.collection(`artifacts/${APP_ID}/backoffice_employees`);
    const ref = id ? col.doc(id) : col.doc();
    await ref.set({ ...employee, updatedAt: new Date().toISOString() }, { merge: true });
    await writeAdminLog({ adminUid: request.auth.uid, action: id ? "update_owner_employee" : "create_owner_employee", module: "owner_employees", details: { id: ref.id } });
    return { ok: true, id: ref.id };
  } catch (error) {
    logger.error("backoffice_upsertOwnerEmployee failed", error);
    throw new Error(error.message || "Failed to save employee");
  }
});

exports.backoffice_deleteOwnerEmployee = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  try {
    if (!request.auth) throw new Error("Auth required");
    await assertSystemAdmin(request.auth.uid);
    const { id } = request.data || {};
    if (!id) throw new Error("id required");
    const db = admin.firestore();
    await db.doc(`artifacts/${APP_ID}/backoffice_employees/${id}`).delete();
    await writeAdminLog({ adminUid: request.auth.uid, action: "delete_owner_employee", module: "owner_employees", details: { id } });
    return { ok: true };
  } catch (error) {
    logger.error("backoffice_deleteOwnerEmployee failed", error);
    throw new Error(error.message || "Failed to delete employee");
  }
});

exports.backoffice_removeAdmin = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  try {
    if (!request.auth) throw new Error("Auth required");
    await assertSystemAdmin(request.auth.uid);
    const { uid } = request.data || {};
    if (!uid) throw new Error("uid required");
    const db = admin.firestore();
    await db.doc(`artifacts/${APP_ID}/backoffice_admins/${uid}`).delete();
    await writeAdminLog({ adminUid: request.auth.uid, action: "remove_admin", module: "admins", targetUserId: uid });
    return { ok: true };
  } catch (error) {
    logger.error("backoffice_removeAdmin failed", error);
    throw new Error(error.message || "Failed to remove admin");
  }
});

// Backoffice: extend/update subscription (new names)
exports.backoffice_extendSubscription = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  // Reuse admin_extendSubscription logic
  return exports.admin_extendSubscription.run(request);
});

exports.backoffice_updateSubscription = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  // Wrap admin_updateSubscription logic
  return exports.admin_updateSubscription.run(request);
});

/**
 * Write an admin action log entry under both admin and target user (if provided)
 * @param {Object} params
 * @param {string} params.adminUid
 * @param {string} params.action
 * @param {string} params.module
 * @param {string=} params.targetUserId
 * @param {*} params.details
 * @return {Promise<void>}
 */
async function writeAdminLog({ adminUid, action, module, targetUserId, details }) {
  try {
    const db = admin.firestore();
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      module,
      userId: targetUserId || null,
      adminUid,
      details: details || null,
    };
    const batch = db.batch();
    // Log under admin's logs
    const adminLogRef = db.collection("logs").doc(adminUid).collection("entries").doc();
    batch.set(adminLogRef, logEntry);
    // Log under target user's logs if provided
    if (targetUserId) {
      const userLogRef = db.collection("logs").doc(targetUserId).collection("entries").doc();
      batch.set(userLogRef, logEntry);
    }
    // Dual-write to backoffice logs collection
    const boLogRef = db.collection(`artifacts/${APP_ID}/backoffice_logs`).doc();
    batch.set(boLogRef, logEntry);
    await batch.commit();
  } catch (e) {
    logger.warn("writeAdminLog failed", e);
  }
}

// TODO: Re-implement admin_listUsers aligned to new architecture (removed)

// TODO: Re-implement impersonation aligned to new architecture (removed)

// Admin: extend subscription by N days
exports.admin_extendSubscription = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  try {
    if (!request.auth) throw new Error("Auth required");
    await assertSystemAdmin(request.auth.uid);
    const { uid, days } = request.data || {};
    if (!uid || !days) throw new Error("uid and days required");
    const db = admin.firestore();
    const ref = db.doc(`subscriptions/${uid}`);
    const snap = await ref.get();
    const now = new Date();
    let end = now;
    if (snap.exists && snap.data().endDate) {
      const prev = new Date(snap.data().endDate);
      end = prev > now ? prev : now;
    }
    end.setDate(end.getDate() + Number(days));
    await ref.set({
      planType: (snap.exists && snap.data().planType) || "Basic",
      startDate: snap.exists && snap.data().startDate || now.toISOString(),
      endDate: end.toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    // Mirror to backoffice subscriptions control doc
    const boRef = db.doc(`artifacts/${APP_ID}/backoffice_subscriptions/${uid}`);
    await boRef.set({
      planType: (snap.exists && snap.data().planType) || "Basic",
      endDate: end.toISOString(),
      updatedAt: new Date().toISOString(),
      source: "admin_extendSubscription",
    }, { merge: true });
    await writeAdminLog({ adminUid: request.auth.uid, action: "extend_subscription", module: "subscriptions", targetUserId: uid, details: { days } });
    return { ok: true, endDate: end.toISOString() };
  } catch (error) {
    logger.error("admin_extendSubscription failed", error);
    throw new Error(error.message || "Failed to extend subscription");
  }
});

// Admin: basic stats
exports.admin_stats = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  try {
    if (!request.auth) throw new Error("Auth required");
    await assertSystemAdmin(request.auth.uid);
    const auth = admin.auth();
    const list = await auth.listUsers(1000);
    const totalUsers = list.users.length;
    // Placeholder stats
    return {
      totalUsers,
      activeSubscriptions: null,
      monthlyRevenue: null,
    };
  } catch (error) {
    logger.error("admin_stats failed", error);
    throw new Error(error.message || "Failed to load stats");
  }
});

// TODO: Re-implement subscriptions listing aligned to new architecture (removed)

// Admin: update subscription plan
exports.admin_updateSubscription = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  try {
    if (!request.auth) throw new Error("Auth required");
    await assertSystemAdmin(request.auth.uid);
    const { uid, planType } = request.data || {};
    if (!uid || !planType) throw new Error("uid and planType required");
    const db = admin.firestore();
    await db.doc(`subscriptions/${uid}`).set({ planType, updatedAt: new Date().toISOString() }, { merge: true });
    // Mirror to backoffice subscriptions control doc
    await db.doc(`artifacts/${APP_ID}/backoffice_subscriptions/${uid}`).set({ planType, updatedAt: new Date().toISOString(), source: "admin_updateSubscription" }, { merge: true });
    await writeAdminLog({ adminUid: request.auth.uid, action: "update_plan", module: "subscriptions", targetUserId: uid, details: { planType } });
    return { ok: true };
  } catch (error) {
    logger.error("admin_updateSubscription failed", error);
    throw new Error(error.message || "Failed to update subscription");
  }
});

// Admin: add a payment record to a subscription
exports.admin_addPayment = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  try {
    if (!request.auth) throw new Error("Auth required");
    await assertSystemAdmin(request.auth.uid);
    const { uid, amount, currency = "INR", gateway, status = "paid", txnId, paidAt } = request.data || {};
    if (!uid || !amount || !gateway) throw new Error("uid, amount, gateway required");
    const db = admin.firestore();
    const ref = db.doc(`subscriptions/${uid}`);
    const payload = {
      amount,
      currency,
      gateway,
      status,
      txnId: txnId || null,
      paidAt: paidAt || new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    await ref.set({ paymentHistory: admin.firestore.FieldValue.arrayUnion(payload), updatedAt: new Date().toISOString() }, { merge: true });
    await writeAdminLog({ adminUid: request.auth.uid, action: "add_payment", module: "subscriptions", targetUserId: uid, details: payload });
    return { ok: true };
  } catch (error) {
    logger.error("admin_addPayment failed", error);
    throw new Error(error.message || "Failed to add payment");
  }
});

// Admin: send notification (broadcast or individual)
// TODO: Re-implement notifications aligned to new architecture (removed)

// Admin: list logs
exports.admin_listLogs = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  try {
    if (!request.auth) throw new Error("Auth required");
    await assertSystemAdmin(request.auth.uid);
    const { uid, limit = 50, module, action } = request.data || {};
    const db = admin.firestore();
    const owner = uid || request.auth.uid;
    let q = db.collection("logs").doc(owner).collection("entries").orderBy("timestamp", "desc").limit(Number(limit));
    if (module) q = q.where("module", "==", module);
    if (action) q = q.where("action", "==", action);
    const snap = await q.get();
    const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { entries };
  } catch (error) {
    logger.error("admin_listLogs failed", error);
    throw new Error(error.message || "Failed to list logs");
  }
});

// Admin: settings get/update
// TODO: Re-implement settings aligned to new architecture (removed)

// Admin: analytics summary
exports.admin_analytics = onCall({ maxInstances: 5, region: "asia-south1", cors: true }, async (request) => {
  try {
    if (!request.auth) throw new Error("Auth required");
    await assertSystemAdmin(request.auth.uid);
    const db = admin.firestore();
    const subsSnap = await db.collection("subscriptions").get();
    const revenueByPlan = {};
    const now = new Date();
    let active = 0;
    let inactive = 0;
    for (const docSnap of subsSnap.docs) {
      const s = docSnap.data();
      if (Array.isArray(s.paymentHistory)) {
        for (const p of s.paymentHistory) {
          const plan = s.planType || "Unknown";
          revenueByPlan[plan] = (revenueByPlan[plan] || 0) + (Number(p.amount) || 0);
        }
      }
      if (s.endDate) {
        const end = new Date(s.endDate);
        if (end > now) active++;
        else inactive++;
      }
    }
    const list = await admin.auth().listUsers(1000);
    // User growth by month (last 12 months)
    const growth = {};
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    for (const u of list.users) {
      const created = u.metadata.creationTime ? new Date(u.metadata.creationTime) : null;
      if (!created) continue;
      if (created < twelveMonthsAgo) continue;
      const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
      growth[key] = (growth[key] || 0) + 1;
    }
    return {
      revenueByPlan,
      userGrowth: growth,
      activeUsers: active,
      inactiveUsers: inactive,
      topCompanies: [],
      failedPayments: subsSnap.docs.filter((d) => Array.isArray(d.data().paymentHistory) && d.data().paymentHistory.some((p) => String(p.status).toLowerCase() === "failed")).length,
      pendingRenewals: subsSnap.docs.filter((d) => d.data().endDate && new Date(d.data().endDate) < now).length,
    };
  } catch (error) {
    logger.error("admin_analytics failed", error);
    throw new Error(error.message || "Failed to load analytics");
  }
});

// Backoffice: one-time bootstrap to seed first admin from current user
exports.backoffice_bootstrapAdmin = onCall({ maxInstances: 2, region: "asia-south1", cors: true }, async (request) => {
  try {
    if (!request.auth) throw new Error("Auth required");
    const uid = request.auth.uid;
    const db = admin.firestore();
    const boCol = db.collection(`artifacts/${APP_ID}/backoffice_admins`);
    const existing = await boCol.limit(1).get();
    if (!existing.empty) {
      throw new Error("Backoffice already initialized");
    }
    let name = null;
    let email = null;
    try {
      const u = await admin.auth().getUser(uid);
      name = u.displayName || null;
      email = u.email || null;
    } catch (e) {
      // ignore
    }
    await boCol.doc(uid).set({
      name,
      email,
      role: "superAdmin",
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      seededBy: uid,
    });
    await writeAdminLog({ adminUid: uid, action: "bootstrap", module: "backoffice" });
    return { ok: true };
  } catch (error) {
    logger.error("backoffice_bootstrapAdmin failed", error);
    throw new Error(error.message || "Failed to bootstrap admin");
  }
});

// Example API endpoint with authentication
exports.api = onRequest({
  maxInstances: 5,
  cors: true,
}, (req, res) => {
  // Apply security middleware
  validateAuth(req, res, () => {
    try {
      logger.info("API request received", {
        method: req.method,
        path: req.path,
        userId: req.user.uid,
      });

      // Your API logic here
      res.json({
        message: "API endpoint working",
        userId: req.user.uid,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("API error:", error);
      res.status(500).json({error: "Internal server error"});
    }
  });
});

// Security health check endpoint
exports.health = onRequest({
  maxInstances: 2,
  cors: true,
}, (req, res) => {
  try {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    });
  } catch (error) {
    logger.error("Health check error:", error);
    res.status(500).json({error: "Service unavailable"});
  }
});

// reCAPTCHA verification function
exports.verifyCaptcha = onCall({
  maxInstances: 10,
  cors: true,
}, async (request) => {
  try {
    const { captchaToken } = request.data;
    
    if (!captchaToken) {
      throw new Error("Captcha token is required");
    }

    // Verify with Google reCAPTCHA API
    const response = await axios.post(
      "https://www.google.com/recaptcha/api/siteverify",
      null,
      {
        params: {
          secret: process.env.RECAPTCHA_SECRET_KEY || "YOUR_SECRET_KEY_HERE",
          response: captchaToken
        }
      }
    );

    const { success, score, action } = response.data;

    logger.info("reCAPTCHA verification result", {
      success,
      score,
      action,
      timestamp: new Date().toISOString()
    });

    if (!success) {
      throw new Error("reCAPTCHA verification failed");
    }

    return {
      success: true,
      score: score || 0,
      action: action || "verify",
      message: "reCAPTCHA verified successfully"
    };

  } catch (error) {
    logger.error("reCAPTCHA verification error:", error);
    throw new Error(`reCAPTCHA verification failed: ${error.message}`);
  }
});

// Login with reCAPTCHA verification
exports.loginWithCaptcha = onCall({
  maxInstances: 10,
  cors: true,
}, async (request) => {
  try {
    const { email, password, captchaToken } = request.data;
    
    if (!email || !password || !captchaToken) {
      throw new Error("Email, password, and captcha token are required");
    }

    // First verify reCAPTCHA
    const captchaResponse = await axios.post(
      "https://www.google.com/recaptcha/api/siteverify",
      null,
      {
        params: {
          secret: process.env.RECAPTCHA_SECRET_KEY || "YOUR_SECRET_KEY_HERE",
          response: captchaToken
        }
      }
    );

    const { success, score } = captchaResponse.data;

    if (!success) {
      throw new Error("reCAPTCHA verification failed");
    }

    // If score is too low (for v3), reject the request
    if (score && score < 0.5) {
      throw new Error("reCAPTCHA score too low");
    }

    // Here you would typically authenticate the user
    // For demo purposes, we'll just return success
    logger.info("Login attempt with reCAPTCHA", {
      email,
      captchaScore: score,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      message: "Login successful",
      captchaScore: score || 0
    };

  } catch (error) {
    logger.error("Login with captcha error:", error);
    throw new Error(`Login failed: ${error.message}`);
  }
});

// Removed legacy getUserStats function that depended on root users collection

// Email verification and enhanced auth functions
/**
 * Signup with reCAPTCHA verification and email verification
 */
exports.auth_signupWithCaptcha = onCall({ cors: true }, async (request) => {
  try {
    const { email, companyName, phone, captchaToken } = request.data;
    const { uid } = request.auth;

    // Verify reCAPTCHA first
    const captchaResult = await verifyRecaptchaToken(captchaToken);
    if (!captchaResult.success || captchaResult.score < 0.5) {
      throw new Error("reCAPTCHA verification failed");
    }

    // Create user account
    const userRecord = await admin.auth().createUser({
      email,
      emailVerified: false
    });

    // Send email verification
    await admin.auth().generateEmailVerificationLink(email);

    // Create user settings document
    const userRef = admin.firestore().doc(`artifacts/${APP_ID}/users/${userRecord.uid}/Settings/default`);
    await userRef.set({
      email,
      companyName,
      phone: phone || "",
      contact: phone || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "active",
      emailVerified: false
    });

    // Seed minimal company details
    try {
      const companyDocRef = admin.firestore().doc(`artifacts/${APP_ID}/users/${userRecord.uid}/companyDetails/myCompany`);
      await companyDocRef.set({
        firmName: companyName,
        email,
        contactNumber: phone || "",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (seedErr) {
      console.error("Error seeding initial company details:", seedErr);
    }

    // Log the action
    await writeAdminLog(uid || "system", "auth_signup", "User registration", {
      userId: userRecord.uid,
      email,
      companyName,
      captchaScore: captchaResult.score
    });

    return {
      success: true,
      message: "Registration successful! Please check your email for verification.",
      userId: userRecord.uid
    };

  } catch (error) {
    console.error("Signup error:", error);
    throw new Error(error.message || "Registration failed");
  }
});

/**
 * Login with reCAPTCHA verification and email verification check
 */
exports.auth_loginWithCaptcha = onCall({ cors: true }, async (request) => {
  try {
    const { email, captchaToken } = request.data;

    // Verify reCAPTCHA first
    const captchaResult = await verifyRecaptchaToken(captchaToken);
    if (!captchaResult.success || captchaResult.score < 0.5) {
      throw new Error("reCAPTCHA verification failed");
    }

    // Sign in with Firebase Auth
    const userCredential = await admin.auth().getUserByEmail(email);
    const user = userCredential;

    // Check if email is verified
    if (!user.emailVerified) {
      throw new Error("Please verify your email before logging in. Check your inbox for verification link.");
    }

    // Log the action
    await writeAdminLog(user.uid, "auth_login", "User login", {
      email,
      captchaScore: captchaResult.score
    });

    return {
      success: true,
      message: "Login successful!",
      userId: user.uid,
      emailVerified: user.emailVerified
    };

  } catch (error) {
    console.error("Login error:", error);
    throw new Error(error.message || "Login failed");
  }
 });

/**
 * Send email verification link to user
 */
exports.auth_sendEmailVerification = onCall({ cors: true }, async (request) => {
  try {
    const { email } = request.data;
    const { uid } = request.auth;

    // Generate and send verification email
    const verificationLink = await admin.auth().generateEmailVerificationLink(email);
    
    // Update user status in Firestore
    const userRef = admin.firestore().doc(`artifacts/${APP_ID}/users/${uid}/Settings/default`);
    await userRef.update({
      emailVerificationSent: admin.firestore.FieldValue.serverTimestamp(),
      emailVerified: false
    });

    // Log the action
    await writeAdminLog(uid, "auth_sendEmailVerification", "Email verification sent", {
      email
    });

    return {
      success: true,
      message: "Verification email sent! Please check your inbox.",
      verificationLink
    };

  } catch (error) {
    console.error("Send email verification error:", error);
    throw new Error(error.message || "Failed to send verification email");
  }
});

/**
 * Check email verification status for user
 */
exports.auth_checkEmailVerification = onCall({ cors: true }, async (request) => {
  try {
    const { uid } = request.auth;
    
    // Get user from Firebase Auth
    const userRecord = await admin.auth().getUser(uid);
    
    // Update verification status in Firestore
    const userRef = admin.firestore().doc(`artifacts/${APP_ID}/users/${uid}/Settings/default`);
    await userRef.update({
      emailVerified: userRecord.emailVerified,
      lastVerificationCheck: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      emailVerified: userRecord.emailVerified,
      message: userRecord.emailVerified ? "Email verified!" : "Email not verified yet."
    };

  } catch (error) {
    console.error("Check email verification error:", error);
    throw new Error(error.message || "Failed to check verification status");
  }
});

/**
 * Helper function to verify reCAPTCHA token
 * @param {string} token - The reCAPTCHA token to verify
 * @return {Promise<Object>} The verification result
 */
async function verifyRecaptchaToken(token) {
  try {
    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `secret=6LfsmqkrAAAAAIHNBxpgnMD7uBtqkc_5fEgYF7Vo&response=${token}`
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("reCAPTCHA verification error:", error);
    return { success: false, score: 0 };
  }
}
