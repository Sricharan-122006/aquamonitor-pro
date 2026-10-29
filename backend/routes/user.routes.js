const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

router.get('/', authMiddleware, adminMiddleware, userController.getAllUsers);
router.put('/:id/make-admin', authMiddleware, adminMiddleware, userController.makeAdmin);

module.exports = router;
