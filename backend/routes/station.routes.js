const express = require('express');
const router = express.Router();
const stationController = require('../controllers/station.controller');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

router.get('/', stationController.getAllStations);
router.get('/:id', stationController.getStationById);

// Admin-Only Reading / Station Management
router.post('/', authMiddleware, adminMiddleware, stationController.createStation);
router.put('/:id', authMiddleware, adminMiddleware, stationController.updateStation);
router.delete('/:id', authMiddleware, adminMiddleware, stationController.deleteStation);

module.exports = router;
