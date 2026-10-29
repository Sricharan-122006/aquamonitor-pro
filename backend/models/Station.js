const mongoose = require('mongoose');

const stationSchema = new mongoose.Schema({
  stationId: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  location: { type: String, required: true, trim: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  status: { type: String, enum: ['Safe', 'Caution', 'Alert'], default: 'Safe' },
  wqi: { type: Number, default: 100 },
  latestReading: {
    ph: Number,
    turbidity: Number,
    temperature: Number,
    dissolvedOxygen: Number,
    tds: Number,
    conductivity: Number,
    timestamp: { type: Date, default: Date.now },
    timeString: String
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Station || mongoose.model('Station', stationSchema);
