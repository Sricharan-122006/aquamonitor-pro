const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  emailForwarded: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  dateString: { type: String, default: () => new Date().toLocaleString('en-US') }
});

module.exports = mongoose.models.Contact || mongoose.model('Contact', contactSchema);
