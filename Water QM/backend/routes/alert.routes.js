const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alert.controller');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

router.get('/', alertController.getAllAlerts);
router.post('/thresholds', authMiddleware, adminMiddleware, alertController.updateThresholds);
router.put('/:id/resolve', authMiddleware, alertController.resolveAlert);
router.delete('/:id', authMiddleware, adminMiddleware, alertController.dismissAlert);

module.exports = router;
