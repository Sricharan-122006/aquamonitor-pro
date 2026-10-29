const mongoose = require('mongoose');

const thresholdSchema = new mongoose.Schema({
  phMin: { type: Number, default: 6.5 },
  phMax: { type: Number, default: 8.5 },
  turbidityMin: { type: Number, default: 0 },
  turbidityMax: { type: Number, default: 100 },
  tdsMin: { type: Number, default: 0 },
  tdsMax: { type: Number, default: 500 },
  doMin: { type: Number, default: 5.0 },
  doMax: { type: Number, default: 12.0 },
  tempMin: { type: Number, default: 10 },
  tempMax: { type: Number, default: 25 },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Threshold || mongoose.model('Threshold', thresholdSchema);
