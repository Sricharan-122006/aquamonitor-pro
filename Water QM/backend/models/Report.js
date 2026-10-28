const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ['Daily', 'Weekly', 'Monthly'], required: true },
  generatedDate: { type: String, default: () => new Date().toLocaleDateString('en-US') },
  generatedTime: { type: String, default: 'Today 08:00' },
  stations: { type: String, default: 'All' },
  status: { type: String, enum: ['Ready', 'Processing', 'Premium'], default: 'Ready' },
  planRequired: { type: String, enum: ['FREE', 'PRO'], default: 'FREE' },
  downloadUrl: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Report || mongoose.model('Report', reportSchema);
