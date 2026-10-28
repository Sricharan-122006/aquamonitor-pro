const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  time: { type: String, default: () => new Date().toLocaleTimeString('en-US') },
  station: { type: String, required: true },
  parameter: { type: String, required: true },
  value: { type: String, required: true },
  threshold: { type: String, required: true },
  severity: { type: String, enum: ['Critical', 'Warning', 'Info'], default: 'Warning' },
  status: { type: String, enum: ['Active', 'Resolved', 'Dismissed'], default: 'Active' },
  message: { type: String },
  timestamp: { type: Date, default: Date.now },
  resolvedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Alert || mongoose.model('Alert', alertSchema);
