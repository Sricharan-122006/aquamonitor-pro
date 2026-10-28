const express = require('express');
const router = express.Router();
const communityIssueController = require('../controllers/community-issue.controller');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

// All community issue management endpoints require Admin privileges
router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/overview', communityIssueController.getOverviewStats);
router.get('/suggestions', communityIssueController.getDuplicateSuggestions);
router.get('/notifications', communityIssueController.getNotifications);
router.put('/notifications/:id/read', communityIssueController.markNotificationRead);
router.put('/notifications/read-all', communityIssueController.markAllNotificationsRead);

router.get('/', communityIssueController.getCommunityIssues);
router.post('/', communityIssueController.createCommunityIssue);
router.get('/:id', communityIssueController.getCommunityIssueById);
router.put('/:id', communityIssueController.updateCommunityIssue);
router.put('/:id/status', communityIssueController.updateStatus);
router.post('/:id/link-complaints', communityIssueController.linkComplaints);
router.post('/:id/unlink-complaint', communityIssueController.unlinkComplaint);
router.post('/:id/notes', communityIssueController.addInternalNote);
router.post('/:id/public-updates', communityIssueController.addPublicUpdate);

module.exports = router;
