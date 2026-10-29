const express = require('express');
const router = express.Router();
const complaintController = require('../controllers/complaint.controller');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

// Optional auth helper: if token present, sets req.user without rejecting unauthenticated users
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      await authMiddleware(req, res, () => next());
      return;
    } catch (e) {}
  }
  next();
};

// Public submission and tracking
router.post('/', optionalAuth, complaintController.submitComplaint);
router.get('/track/:trackingId', complaintController.trackComplaintPublic);

// Authenticated user complaints
router.get('/my', authMiddleware, complaintController.getMyComplaints);

// Admin-only management endpoints
router.get('/', authMiddleware, adminMiddleware, complaintController.getAllComplaints);
router.get('/:id', authMiddleware, complaintController.getComplaintById);
router.put('/:id/status', authMiddleware, adminMiddleware, complaintController.updateComplaintStatus);

module.exports = router;
