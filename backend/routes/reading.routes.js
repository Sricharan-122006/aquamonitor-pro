const express = require('express');
const router = express.Router();
const readingController = require('../controllers/reading.controller');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

router.get('/latest', readingController.getLatestDashboardStats);
router.get('/history', readingController.getReadingHistory);

// Admin-Only Reading operations
router.post('/', authMiddleware, adminMiddleware, readingController.addReading);
router.put('/:id', authMiddleware, adminMiddleware, readingController.updateReading);
router.delete('/:id', authMiddleware, adminMiddleware, readingController.deleteReading);

module.exports = router;
