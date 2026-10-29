const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const authMiddleware = require('../middleware/auth');

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = { plan: 'FREE', role: 'USER', email: 'guest@aquamonitor.in', name: 'Citizen / Guest' };
    return next();
  }
  return authMiddleware(req, res, next);
};

router.get('/', authMiddleware, reportController.getReportsList);
router.post('/generate', authMiddleware, reportController.generateReport);
router.post('/dataset-potability', optionalAuth, reportController.generateDatasetReport);
router.get('/download/:id', authMiddleware, reportController.downloadReport);

module.exports = router;
