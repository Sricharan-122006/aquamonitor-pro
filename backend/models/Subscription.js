const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  userEmail: { type: String, required: true },
  plan: { type: String, required: true },
  amount: { type: String, required: true },
  currency: { type: String, default: 'INR' },
  orderId: { type: String, required: true },
  paymentId: { type: String, default: '' },
  status: { type: String, enum: ['created', 'paid', 'failed'], default: 'created' },
  date: { type: String, default: () => new Date().toLocaleDateString('en-US') },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
