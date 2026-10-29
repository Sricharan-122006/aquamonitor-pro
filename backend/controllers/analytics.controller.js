const { ReadingRepo, StationRepo } = require('../storage/repository');
const { predictPotability, generateForecast } = require('../services/ai-prediction.service');

exports.getAnalyticsData = async (req, res) => {
  try {
    const { river = 'ALL', range = '7d' } = req.query;

    let days = 7;
    if (range === '30d') days = 30;
    if (range === '3m') days = 90;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build query
    const query = {
      timestamp: { $gte: startDate.toISOString() }
    };
    if (river && river !== 'ALL' && river !== 'All Rivers') {
      query.stationName = river;
    }

    const readings = await ReadingRepo.find(query, { timestamp: 1 });
    const stations = await StationRepo.find();

    // Group dates for bar chart (e.g. 10-21 .. 10-27)
    const dateMap = {};
    const riverList = ['Banas', 'Damodar', 'Brahmaputra', 'Godavari', 'Saraswati', 'Kaveri', 'Narmada', 'Ganga', 'Yamuna', 'Ravi River'];

    // Generate dates array
    const labels = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const key = `${m}-${day}`;
      labels.push(key);
      dateMap[key] = {};
    }

    readings.forEach(r => {
      const d = new Date(r.timestamp);
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const key = `${m}-${day}`;
      if (dateMap[key]) {
        dateMap[key][r.stationName] = r.ph;
      }
    });

    // Compute distribution (Safe, Caution, Alert)
    let safeCount = 0, cautionCount = 0, alertCount = 0;
    stations.forEach(s => {
      if (s.status === 'Safe') safeCount++;
      else if (s.status === 'Caution') cautionCount++;
      else alertCount++;
    });

    // Multi-parameter Trend data points
    const trendPoints = labels.map(dateKey => {
      let sumTemp = 0, sumDO = 0, sumTds = 0, c = 0;
      const dayReadings = readings.filter(r => {
        const d = new Date(r.timestamp);
        return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === dateKey;
      });

      dayReadings.forEach(dr => {
        sumTemp += dr.temperature || 0;
        sumDO += dr.dissolvedOxygen || 0;
        sumTds += (dr.tds || 0) / 10; // Scaled for chart visual matching TDS/10
        c++;
      });

      return {
        date: dateKey,
        temp: c ? Number((sumTemp / c).toFixed(1)) : 22,
        do: c ? Number((sumDO / c).toFixed(1)) : 7.8,
        tdsScaled: c ? Number((sumTds / c).toFixed(1)) : 26.5
      };
    });

    return res.status(200).json({
      success: true,
      selectedRiver: river,
      selectedRange: range,
      labels,
      dateMap,
      rivers: riverList,
      distribution: {
        safe: safeCount,
        caution: cautionCount,
        alert: alertCount,
        total: stations.length
      },
      multiParamTrend: trendPoints
    });
  } catch (err) {
    console.error('Analytics error:', err);
    return res.status(500).json({ success: false, message: 'Server error computing analytics data.' });
  }
};

exports.getPredictionInsights = async (req, res) => {
  try {
    const { stationName = 'Kaveri' } = req.query;

    let station = await StationRepo.findOne({ name: stationName });
    if (!station) {
      station = await StationRepo.findOne();
    }

    const current = station && station.latestReading ? station.latestReading : {
      ph: 7.2,
      turbidity: 20,
      temperature: 24,
      dissolvedOxygen: 7.8,
      tds: 250,
      conductivity: 300
    };

    const potabilityResult = predictPotability(current);
    const forecast = generateForecast(current, 7);

    return res.status(200).json({
      success: true,
      stationName: station ? station.name : stationName,
      currentTelemetry: current,
      aiEvaluation: potabilityResult,
      sevenDayForecast: forecast
    });
  } catch (err) {
    console.error('Prediction error:', err);
    return res.status(500).json({ success: false, message: 'Server error generating predictions.' });
  }
};
