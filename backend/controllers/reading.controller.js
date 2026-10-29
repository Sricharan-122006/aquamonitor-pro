const { ReadingRepo, StationRepo, AlertRepo } = require('../storage/repository');
const { calculateWQI } = require('../services/wqi.service');
const { sendAlertEmail } = require('../services/email.service');

exports.addReading = async (req, res) => {
  try {
    const {
      stationId,
      stationName,
      locationName,
      latitude,
      longitude,
      ph,
      turbidity,
      temperature,
      dissolvedOxygen,
      tds,
      conductivity
    } = req.body;

    if (!stationId || !stationName) {
      return res.status(400).json({ success: false, message: 'Station ID and Station Name are required.' });
    }

    const sId = stationId.toUpperCase().trim();
    const phVal = Number(ph);
    const turbVal = Number(turbidity);
    const tempVal = Number(temperature);
    const doVal = Number(dissolvedOxygen);
    const tdsVal = Number(tds);
    const condVal = conductivity !== undefined && conductivity !== '' ? Number(conductivity) : 250;

    if (isNaN(phVal) || isNaN(turbVal) || isNaN(tempVal) || isNaN(doVal) || isNaN(tdsVal)) {
      return res.status(400).json({ success: false, message: 'All primary sensor readings must be valid numeric values.' });
    }

    const { wqi, status } = calculateWQI({
      ph: phVal,
      turbidity: turbVal,
      temperature: tempVal,
      dissolvedOxygen: doVal,
      tds: tdsVal,
      conductivity: condVal
    });

    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US');

    // 1. Create historical reading record
    const newReading = await ReadingRepo.create({
      stationId: sId,
      stationName: stationName.trim(),
      location: locationName ? locationName.trim() : 'India',
      ph: phVal,
      turbidity: turbVal,
      temperature: tempVal,
      dissolvedOxygen: doVal,
      tds: tdsVal,
      conductivity: condVal,
      wqi,
      status,
      timestamp: now,
      timeString,
      recordedBy: req.user ? req.user.name : 'Admin'
    });

    // 2. Update or create the Station entity
    let station = await StationRepo.findOne({ stationId: sId });
    if (station) {
      await StationRepo.findByIdAndUpdate(station._id || station.id, {
        name: stationName.trim(),
        location: locationName ? locationName.trim() : station.location,
        latitude: latitude ? Number(latitude) : station.latitude,
        longitude: longitude ? Number(longitude) : station.longitude,
        status,
        wqi,
        latestReading: {
          ph: phVal,
          turbidity: turbVal,
          temperature: tempVal,
          dissolvedOxygen: doVal,
          tds: tdsVal,
          conductivity: condVal,
          timestamp: now,
          timeString
        }
      });
    } else {
      await StationRepo.create({
        stationId: sId,
        name: stationName.trim(),
        location: locationName ? locationName.trim() : 'India',
        latitude: latitude ? Number(latitude) : 20.59,
        longitude: longitude ? Number(longitude) : 78.96,
        status,
        wqi,
        latestReading: {
          ph: phVal,
          turbidity: turbVal,
          temperature: tempVal,
          dissolvedOxygen: doVal,
          tds: tdsVal,
          conductivity: condVal,
          timestamp: now,
          timeString
        }
      });
    }

    // 3. Alert generation if limits are exceeded
    const createdAlerts = [];
    if (phVal < 6.5 || phVal > 8.5) {
      createdAlerts.push({
        time: timeString,
        station: stationName.trim(),
        parameter: 'pH',
        value: phVal.toString(),
        threshold: '6.5 - 8.5',
        severity: phVal < 5.5 || phVal > 9.0 ? 'Critical' : 'Warning',
        message: `pH level ${phVal} is outside safe range (6.5 - 8.5) at ${stationName.trim()}`
      });
    }
    if (tdsVal > 500) {
      createdAlerts.push({
        time: timeString,
        station: stationName.trim(),
        parameter: 'TDS',
        value: `${tdsVal} ppm`,
        threshold: '500 ppm',
        severity: tdsVal > 750 ? 'Critical' : 'Warning',
        message: `TDS ${tdsVal} ppm exceeds safe limit at ${stationName.trim()}`
      });
    }
    if (turbVal > 50) {
      createdAlerts.push({
        time: timeString,
        station: stationName.trim(),
        parameter: 'Turbidity',
        value: `${turbVal} NTU`,
        threshold: '50 NTU',
        severity: turbVal > 80 ? 'Critical' : 'Warning',
        message: `Turbidity ${turbVal} NTU is elevated at ${stationName.trim()}`
      });
    }
    if (doVal < 5.0) {
      createdAlerts.push({
        time: timeString,
        station: stationName.trim(),
        parameter: 'Dissolved Oxygen',
        value: `${doVal} mg/L`,
        threshold: '5 mg/L',
        severity: doVal < 3.5 ? 'Critical' : 'Warning',
        message: `DO: ${doVal} mg/L is below minimum at ${stationName.trim()}`
      });
    }

    for (const alertItem of createdAlerts) {
      await AlertRepo.create({
        ...alertItem,
        status: 'Active',
        timestamp: now
      });
      // Try email notify admin in background
      sendAlertEmail({
        toEmail: process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@aquamonitor.in',
        ...alertItem
      }).catch(() => {});
    }

    return res.status(201).json({
      success: true,
      message: 'Water quality reading saved successfully.',
      reading: newReading,
      wqi,
      status,
      alertsTriggered: createdAlerts.length
    });
  } catch (err) {
    console.error('Add reading error:', err);
    return res.status(500).json({ success: false, message: 'Server error saving reading.' });
  }
};

exports.getLatestDashboardStats = async (req, res) => {
  try {
    const stations = await StationRepo.find();
    if (stations.length === 0) {
      return res.status(200).json({
        success: true,
        stats: { avgPh: 7.0, avgTurbidity: 20, avgTemp: 22, avgDO: 8.0, avgTds: 250, activeCount: 0 }
      });
    }

    let sumPh = 0, sumTurb = 0, sumTemp = 0, sumDO = 0, sumTds = 0, count = 0;
    stations.forEach(s => {
      const r = s.latestReading || {};
      if (r.ph) {
        sumPh += r.ph;
        sumTurb += r.turbidity || 0;
        sumTemp += r.temperature || 0;
        sumDO += r.dissolvedOxygen || 0;
        sumTds += r.tds || 0;
        count++;
      }
    });

    const activeCount = stations.length;
    const stats = {
      avgPh: count ? Number((sumPh / count).toFixed(1)) : 6.8,
      avgTurbidity: count ? Number((sumTurb / count).toFixed(1)) : 37.8,
      avgTemp: count ? Number((sumTemp / count).toFixed(1)) : 21.4,
      avgDO: count ? Number((sumDO / count).toFixed(1)) : 9.4,
      avgTds: count ? Number((sumTds / count).toFixed(1)) : 304.3,
      activeCount
    };

    return res.status(200).json({ success: true, stats });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error computing dashboard stats.' });
  }
};

exports.getReadingHistory = async (req, res) => {
  try {
    const { stationId, limit = 50 } = req.query;
    const query = {};
    if (stationId && stationId !== 'ALL') {
      query.stationId = stationId.toUpperCase();
    }

    const readings = await ReadingRepo.find(query, { timestamp: -1 });
    return res.status(200).json({
      success: true,
      count: readings.length,
      data: readings.slice(0, Number(limit))
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error retrieving readings history.' });
  }
};

exports.updateReading = async (req, res) => {
  try {
    const { id } = req.params;
    const { ph, turbidity, temperature, dissolvedOxygen, tds, conductivity } = req.body;

    const reading = await ReadingRepo.findById(id);
    if (!reading) {
      return res.status(404).json({ success: false, message: 'Reading record not found.' });
    }

    const phVal = ph !== undefined ? Number(ph) : reading.ph;
    const turbVal = turbidity !== undefined ? Number(turbidity) : reading.turbidity;
    const tempVal = temperature !== undefined ? Number(temperature) : reading.temperature;
    const doVal = dissolvedOxygen !== undefined ? Number(dissolvedOxygen) : reading.dissolvedOxygen;
    const tdsVal = tds !== undefined ? Number(tds) : reading.tds;
    const condVal = conductivity !== undefined ? Number(conductivity) : reading.conductivity;

    const { wqi, status } = calculateWQI({
      ph: phVal,
      turbidity: turbVal,
      temperature: tempVal,
      dissolvedOxygen: doVal,
      tds: tdsVal,
      conductivity: condVal
    });

    const updated = await ReadingRepo.findByIdAndUpdate(id, {
      ph: phVal,
      turbidity: turbVal,
      temperature: tempVal,
      dissolvedOxygen: doVal,
      tds: tdsVal,
      conductivity: condVal,
      wqi,
      status
    }, { new: true });

    return res.status(200).json({
      success: true,
      message: 'Reading updated successfully.',
      reading: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error updating reading.' });
  }
};

exports.deleteReading = async (req, res) => {
  try {
    const { id } = req.params;
    const removed = await ReadingRepo.findByIdAndDelete(id);
    if (!removed) {
      return res.status(404).json({ success: false, message: 'Reading not found.' });
    }
    return res.status(200).json({ success: true, message: 'Reading deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error deleting reading.' });
  }
};
