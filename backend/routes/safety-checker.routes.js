const express = require('express');
const router = express.Router();
const safetyCheckerController = require('../controllers/safety-checker.controller');

// Real Postal PIN Code Lookup
router.get('/lookup/:pincode', safetyCheckerController.lookupPin);

// Simulated Water Quality & Lab Data
router.get('/data/:pincode', safetyCheckerController.getDashboardData);

// Simulated Water Test Booking
router.post('/book', safetyCheckerController.bookTest);

module.exports = router;
