/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
admin.initializeApp();

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
