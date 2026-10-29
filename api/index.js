/**
 * AquaMonitor Pro - Vercel Serverless Function Adapter
 * Exports the Express application directly to Vercel's serverless runtime.
 */

const app = require('../server');

module.exports = app;
