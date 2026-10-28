const mongoose = require('mongoose');

const timelineItemSchema = new mongoose.Schema({
  id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  action: { type: String, required: true },
  details: { type: String, default: '' },
  actor: { type: String, default: 'Administrator' },
  actorRole: { type: String, default: 'ADMIN' },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const internalNoteSchema = new mongoose.Schema({
  id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  note: { type: String, required: true, trim: true },
  author: { type: String, default: 'Administrator' },
  authorRole: { type: String, default: 'ADMIN' },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const publicUpdateSchema = new mongoose.Schema({
  id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  message: { type: String, required: true, trim: true },
  publishedBy: { type: String, default: 'Administrator' },
  publishedAt: { type: Date, default: Date.now }
}, { _id: false });

const reopenRecordSchema = new mongoose.Schema({
  reason: { type: String, required: true },
  reopenedBy: { type: String, default: 'Administrator' },
  reopenedAt: { type: Date, default: Date.now }
}, { _id: false });

const communityIssueSchema = new mongoose.Schema({
  issueRef: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true, trim: true },
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
  locationDetails: { type: String, default: '', trim: true },
  stationId: { type: String, default: '', trim: true },
  description: { type: String, required: true, trim: true },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium',
    index: true
  },
  status: {
    type: String,
    enum: [
      'New',
      'Under Investigation',
      'Action in Progress',
      'Awaiting Verification',
      'Resolved',
      'Closed',
      'Reopened'
    ],
    default: 'New',
    index: true
  },
  assignedTo: { type: String, default: 'Unassigned', index: true },
  assignedTeam: {
    type: String,
    default: 'Unassigned',
    enum: [
      'Unassigned',
      'Field Rapid Response Team',
      'Municipal Pipeline Maintenance',
      'Water Quality Lab Inspection',
      'District Health & Safety',
      'Civic Operations Cell'
    ]
  },
  linkedComplaintIds: { type: [String], default: [] },
  linkedCount: { type: Number, default: 0 },
  internalNotes: { type: [internalNoteSchema], default: [] },
  publicUpdates: { type: [publicUpdateSchema], default: [] },
  activityTimeline: { type: [timelineItemSchema], default: [] },
  resolutionSummary: { type: String, default: '' },
  resolvedBy: { type: String, default: '' },
  resolvedAt: { type: Date, default: null },
  reopenHistory: { type: [reopenRecordSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.CommunityIssue || mongoose.model('CommunityIssue', communityIssueSchema);
