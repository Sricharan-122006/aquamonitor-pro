const { StationRepo, ReadingRepo, AlertRepo } = require('../storage/repository');
const { calculateWQI } = require('../services/wqi.service');

exports.getAllStations = async (req, res) => {
  try {
    const stations = await StationRepo.find({}, { name: 1 });
    return res.status(200).json({ success: true, count: stations.length, data: stations });
  } catch (err) {
    console.error('Error fetching stations:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving stations.' });
  }
};

exports.getStationById = async (req, res) => {
  try {
    const { id } = req.params;
    let station = await StationRepo.findOne({ stationId: id.toUpperCase() });
    if (!station) {
      station = await StationRepo.findById(id);
    }
    if (!station) {
      return res.status(404).json({ success: false, message: 'Monitoring station not found.' });
    }

    const readings = await ReadingRepo.find(
      { stationId: station.stationId },
      { timestamp: -1 }
    );

    return res.status(200).json({
      success: true,
      data: station,
      history: readings.slice(0, 50)
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error retrieving station details.' });
  }
};

exports.createStation = async (req, res) => {
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
    const existing = await StationRepo.findOne({ stationId: sId });
    if (existing) {
      return res.status(400).json({ success: false, message: `Station with ID ${sId} already exists.` });
    }

    const phVal = Number(ph) || 7.0;
    const turbVal = Number(turbidity) || 20;
    const tempVal = Number(temperature) || 24;
    const doVal = Number(dissolvedOxygen) || 7.5;
    const tdsVal = Number(tds) || 250;
    const condVal = Number(conductivity) || 300;

    const { wqi, status } = calculateWQI({
      ph: phVal,
      turbidity: turbVal,
      temperature: tempVal,
      dissolvedOxygen: doVal,
      tds: tdsVal,
      conductivity: condVal
    });

    const now = new Date();
    const newStation = await StationRepo.create({
      stationId: sId,
      name: stationName.trim(),
      location: locationName ? locationName.trim() : 'India',
      latitude: Number(latitude) || 20.59,
      longitude: Number(longitude) || 78.96,
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
        timeString: now.toLocaleTimeString('en-US')
      }
    });

    // Also record first reading in history
    await ReadingRepo.create({
      stationId: sId,
      stationName: newStation.name,
      location: newStation.location,
      ph: phVal,
      turbidity: turbVal,
      temperature: tempVal,
      dissolvedOxygen: doVal,
      tds: tdsVal,
      conductivity: condVal,
      wqi,
      status,
      timestamp: now,
      timeString: now.toLocaleTimeString('en-US'),
      recordedBy: req.user.name || 'Admin'
    });

    // Check if alert should be created
    if (status === 'Alert' || status === 'Caution') {
      await AlertRepo.create({
        time: now.toLocaleTimeString('en-US'),
        station: newStation.name,
        parameter: phVal < 6.5 || phVal > 8.5 ? 'pH' : tdsVal > 500 ? 'TDS' : 'Water Quality Index',
        value: `${wqi} (WQI)`,
        threshold: 'Safe >= 70',
        severity: status === 'Alert' ? 'Critical' : 'Warning',
        status: 'Active',
        message: `Station ${newStation.name} initialized with ${status} status (WQI ${wqi})`
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Monitoring station created successfully.',
      data: newStation
    });
  } catch (err) {
    console.error('Create station error:', err);
    return res.status(500).json({ success: false, message: 'Server error creating monitoring station.' });
  }
};

exports.updateStation = async (req, res) => {
  try {
    const { id } = req.params;
    let station = await StationRepo.findOne({ stationId: id.toUpperCase() });
    if (!station) {
      station = await StationRepo.findById(id);
    }
    if (!station) {
      return res.status(404).json({ success: false, message: 'Station not found.' });
    }

    const {
      name,
      location,
      latitude,
      longitude,
      ph,
      turbidity,
      temperature,
      dissolvedOxygen,
      tds,
      conductivity
    } = req.body;

    const update = {};
    if (name) update.name = name.trim();
    if (location) update.location = location.trim();
    if (latitude !== undefined) update.latitude = Number(latitude);
    if (longitude !== undefined) update.longitude = Number(longitude);

    if (ph !== undefined || turbidity !== undefined || tds !== undefined) {
      const cur = station.latestReading || {};
      const phVal = ph !== undefined ? Number(ph) : cur.ph || 7.0;
      const turbVal = turbidity !== undefined ? Number(turbidity) : cur.turbidity || 20;
      const tempVal = temperature !== undefined ? Number(temperature) : cur.temperature || 24;
      const doVal = dissolvedOxygen !== undefined ? Number(dissolvedOxygen) : cur.dissolvedOxygen || 7.5;
      const tdsVal = tds !== undefined ? Number(tds) : cur.tds || 250;
      const condVal = conductivity !== undefined ? Number(conductivity) : cur.conductivity || 300;

      const { wqi, status } = calculateWQI({
        ph: phVal,
        turbidity: turbVal,
        temperature: tempVal,
        dissolvedOxygen: doVal,
        tds: tdsVal,
        conductivity: condVal
      });

      const now = new Date();
      update.status = status;
      update.wqi = wqi;
      update.latestReading = {
        ph: phVal,
        turbidity: turbVal,
        temperature: tempVal,
        dissolvedOxygen: doVal,
        tds: tdsVal,
        conductivity: condVal,
        timestamp: now,
        timeString: now.toLocaleTimeString('en-US')
      };

      // Add a history reading entry
      await ReadingRepo.create({
        stationId: station.stationId,
        stationName: update.name || station.name,
        location: update.location || station.location,
        ph: phVal,
        turbidity: turbVal,
        temperature: tempVal,
        dissolvedOxygen: doVal,
        tds: tdsVal,
        conductivity: condVal,
        wqi,
        status,
        timestamp: now,
        timeString: now.toLocaleTimeString('en-US'),
        recordedBy: req.user.name || 'Admin'
      });
    }

    const updated = await StationRepo.findByIdAndUpdate(station._id || station.id, update, { new: true });

    return res.status(200).json({
      success: true,
      message: 'Station updated successfully.',
      data: updated
    });
  } catch (err) {
    console.error('Update station error:', err);
    return res.status(500).json({ success: false, message: 'Server error updating station.' });
  }
};

exports.deleteStation = async (req, res) => {
  try {
    const { id } = req.params;
    let station = await StationRepo.findOne({ stationId: id.toUpperCase() });
    if (!station) {
      station = await StationRepo.findById(id);
    }
    if (!station) {
      return res.status(404).json({ success: false, message: 'Station not found.' });
    }

    await StationRepo.findByIdAndDelete(station._id || station.id);
    await ReadingRepo.deleteMany({ stationId: station.stationId });

    return res.status(200).json({
      success: true,
      message: `Station ${station.name} (${station.stationId}) and its historical readings have been deleted.`
    });
  } catch (err) {
    console.error('Delete station error:', err);
    return res.status(500).json({ success: false, message: 'Server error deleting station.' });
  }
};
