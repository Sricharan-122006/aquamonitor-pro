const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscription.controller');
const authMiddleware = require('../middleware/auth');

router.post('/create-order', authMiddleware, subscriptionController.createOrder);
router.post('/verify-payment', authMiddleware, subscriptionController.verifyPayment);
router.get('/history', authMiddleware, subscriptionController.getPaymentHistory);

module.exports = router;
