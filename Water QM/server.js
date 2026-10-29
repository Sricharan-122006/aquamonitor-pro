require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const connectDB = require('./backend/config/db');
const seedInitialData = require('./backend/services/seed.service');

// Import Route Handlers
const authRoutes = require('./backend/routes/auth.routes');
const stationRoutes = require('./backend/routes/station.routes');
const readingRoutes = require('./backend/routes/reading.routes');
const analyticsRoutes = require('./backend/routes/analytics.routes');
const alertRoutes = require('./backend/routes/alert.routes');
const reportRoutes = require('./backend/routes/report.routes');
const subscriptionRoutes = require('./backend/routes/subscription.routes');
const contactRoutes = require('./backend/routes/contact.routes');
const userRoutes = require('./backend/routes/user.routes');
const safetyCheckerRoutes = require('./backend/routes/safety-checker.routes');
const complaintRoutes = require('./backend/routes/complaint.routes');
const communityIssueRoutes = require('./backend/routes/community-issue.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Restore original client URI from Vercel Edge proxy/rewrite headers
app.use((req, res, next) => {
  const originalUri = req.headers['x-forwarded-uri'] || 
                      req.headers['x-matched-path'] || 
                      req.originalUrl || 
                      req.url;

  if (originalUri && originalUri !== req.url) {
    req.url = originalUri;
  }
  next();
});

// Serverless cold-start lifecycle initialization
let isDbInitialized = false;
let initDbPromise = null;

async function serverlessInitMiddleware(req, res, next) {
  if (!isDbInitialized) {
    if (!initDbPromise) {
      initDbPromise = (async () => {
        try {
          await connectDB();
          await seedInitialData();
          isDbInitialized = true;
        } catch (err) {
          console.error('[Serverless Init Error]', err);
        }
      })();
    }
    await initDbPromise;
  }
  next();
}
app.use(serverlessInitMiddleware);

// Serve Static Frontend Assets (with no-cache headers for instant updates)
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
}));
const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const REPORTS_DIR = isServerless 
  ? path.join('/tmp', 'reports_files')
  : path.join(__dirname, 'public', 'reports_files');
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}
app.use('/reports_files', express.static(REPORTS_DIR));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/readings', readingRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/users', userRoutes);
app.use('/api/safety-checker', safetyCheckerRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/community-issues', communityIssueRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    system: 'AquaMonitor Pro',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// Single Page Application Fallback
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send('AquaMonitor Pro Backend Running.');
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.stack || err.message);
  res.status(500).json({
    success: false,
    message: 'Internal server error occurred.',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Server Initialization
async function startServer() {
  try {
    await connectDB();
    await seedInitialData();
    isDbInitialized = true;

    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🌊 AquaMonitor Pro Server running on http://localhost:${PORT}`);
      console.log(`📡 REST API mounted at http://localhost:${PORT}/api/`);
      console.log(`🚀 Ready for user and administrator connections.`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('Fatal startup error:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
