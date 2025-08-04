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

// Get user statistics
exports.getUserStats = onCall({
  maxInstances: 5,
  cors: true,
}, async (request) => {
  try {
    // Check if user is authenticated
    if (!request.auth) {
      throw new Error("Authentication required");
    }

    const db = admin.firestore();
    const usersRef = db.collection("users");
    
    // Get all users
    const snapshot = await usersRef.get();
    
    const totalUsers = snapshot.size;
    const userStats = {
      total: totalUsers,
      byStatus: {},
      byMonth: {},
      recentUsers: []
    };

    // Process user data
    snapshot.forEach((doc) => {
      const userData = doc.data();
      const status = userData.status || "unknown";
      const createdAt = userData.createdAt ? userData.createdAt.toDate() : new Date();
      const monthKey = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, "0")}`;
      
      // Count by status
      userStats.byStatus[status] = (userStats.byStatus[status] || 0) + 1;
      
      // Count by month
      userStats.byMonth[monthKey] = (userStats.byMonth[monthKey] || 0) + 1;
      
      // Recent users (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      if (createdAt >= thirtyDaysAgo) {
        userStats.recentUsers.push({
          id: doc.id,
          email: userData.email || "N/A",
          company: userData.companyName || userData.firmName || "N/A",
          status: status,
          createdAt: createdAt.toISOString()
        });
      }
    });

    logger.info("User statistics retrieved", {
      totalUsers,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      stats: userStats
    };

  } catch (error) {
    logger.error("Get user stats error:", error);
    throw new Error(`Failed to get user statistics: ${error.message}`);
  }
});
