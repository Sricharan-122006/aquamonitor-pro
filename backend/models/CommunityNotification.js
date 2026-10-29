const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'NEW_ISSUE',
      'HIGH_PRIORITY',
      'UNASSIGNED',
      'STATUS_CHANGE',
      'NEW_COMPLAINT_LINKED',
      'ISSUE_REOPENED',
      'RESOLUTION_CONFIRMED'
    ]
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  issueRef: { type: String, default: null, index: true },
  complaintTrackingId: { type: String, default: null },
  priority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
  read: { type: Boolean, default: false, index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.CommunityNotification || mongoose.model('CommunityNotification', notificationSchema);
