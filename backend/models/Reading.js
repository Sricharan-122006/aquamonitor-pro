const mongoose = require('mongoose');

const readingSchema = new mongoose.Schema({
  stationId: { type: String, required: true, uppercase: true, trim: true },
  stationName: { type: String, required: true, trim: true },
  location: { type: String, required: true, trim: true },
  ph: { type: Number, required: true },
  turbidity: { type: Number, required: true },
  temperature: { type: Number, required: true },
  dissolvedOxygen: { type: Number, required: true },
  tds: { type: Number, required: true },
  conductivity: { type: Number, default: 250 },
  wqi: { type: Number, required: true },
  status: { type: String, enum: ['Safe', 'Caution', 'Alert'], default: 'Safe' },
  timestamp: { type: Date, default: Date.now },
  timeString: { type: String, default: () => new Date().toLocaleTimeString('en-US') },
  recordedBy: { type: String, default: 'Sensor/Admin' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Reading || mongoose.model('Reading', readingSchema);
