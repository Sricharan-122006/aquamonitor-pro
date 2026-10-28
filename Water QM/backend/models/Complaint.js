const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  details: { type: String, default: '' },
  actor: { type: String, default: 'System' },
  actorRole: { type: String, default: 'CITIZEN' },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const complaintSchema = new mongoose.Schema({
  trackingId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, default: null, index: true },
  submitterName: { type: String, required: true, trim: true },
  submitterEmail: { type: String, required: true, lowercase: true, trim: true },
  submitterPhone: { type: String, required: true, trim: true },
  category: {
    type: String,
    required: true,
    enum: [
      'Pipeline Leakage',
      'Water Contamination',
      'Low Water Pressure',
      'Odor / Discoloration',
      'Supply Disruption',
      'Sensor Calibration / Wrong Reading',
      'Other'
    ]
  },
  locality: { type: String, required: true, trim: true },
  landmark: { type: String, default: '', trim: true },
  pincode: { type: String, default: '', trim: true },
  stationId: { type: String, default: '', trim: true },
  description: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['Submitted', 'Under Review', 'Investigating', 'Action in Progress', 'Resolved', 'Closed'],
    default: 'Submitted',
    index: true
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  communityIssueRef: { type: String, default: null, index: true },
  auditLog: { type: [auditLogSchema], default: [] },
  resolutionSummary: { type: String, default: '' },
  resolvedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Complaint || mongoose.model('Complaint', complaintSchema);
