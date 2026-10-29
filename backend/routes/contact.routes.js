const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contact.controller');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

router.post('/', contactController.submitContactMessage);
router.get('/', authMiddleware, adminMiddleware, contactController.getAdminMessages);
router.put('/:id/read', authMiddleware, adminMiddleware, contactController.markMessageAsRead);

module.exports = router;
