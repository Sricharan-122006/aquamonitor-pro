const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');

router.get('/', analyticsController.getAnalyticsData);
router.get('/predict', analyticsController.getPredictionInsights);

module.exports = router;
