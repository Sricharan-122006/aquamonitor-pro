const { AlertRepo, ThresholdRepo } = require('../storage/repository');

exports.getAllAlerts = async (req, res) => {
  try {
    const alerts = await AlertRepo.find({}, { timestamp: -1 });

    let criticalCount = 0;
    let warningCount = 0;
    let infoCount = 0;

    alerts.forEach(a => {
      if (a.severity === 'Critical') criticalCount++;
      else if (a.severity === 'Warning') warningCount++;
      else if (a.severity === 'Info') infoCount++;
    });

    const thresholdDoc = await ThresholdRepo.findOne() || {
      phMin: 6.5,
      phMax: 8.5,
      turbidityMin: 0,
      turbidityMax: 100,
      tdsMin: 0,
      tdsMax: 500,
      doMin: 5.0,
      doMax: 12.0
    };

    return res.status(200).json({
      success: true,
      total: alerts.length,
      summary: {
        critical: criticalCount,
        warning: warningCount,
        info: infoCount
      },
      channels: {
        email: { name: 'Email Alerts (Nodemailer)', status: 'Active', badgeClass: 'badge-success' },
        sms: { name: 'SMS Alerts (Twilio)', status: 'Configure in .env', badgeClass: 'badge-warning' },
        push: { name: 'Push Notifications', status: 'Pro Plan', badgeClass: 'badge-info' }
      },
      thresholds: thresholdDoc,
      alerts
    });
  } catch (err) {
    console.error('Error fetching alerts:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving alerts.' });
  }
};

exports.updateThresholds = async (req, res) => {
  try {
    const { phMin, phMax, turbidityMin, turbidityMax, tdsMin, tdsMax, doMin, doMax } = req.body;

    let threshold = await ThresholdRepo.findOne();
    const update = {
      phMin: Number(phMin) || 6.5,
      phMax: Number(phMax) || 8.5,
      turbidityMin: Number(turbidityMin) || 0,
      turbidityMax: Number(turbidityMax) || 100,
      tdsMin: Number(tdsMin) || 0,
      tdsMax: Number(tdsMax) || 500,
      doMin: Number(doMin) || 5.0,
      doMax: Number(doMax) || 12.0,
      updatedAt: new Date().toISOString()
    };

    if (threshold) {
      threshold = await ThresholdRepo.findByIdAndUpdate(threshold._id || threshold.id, update, { new: true });
    } else {
      threshold = await ThresholdRepo.create(update);
    }

    return res.status(200).json({
      success: true,
      message: 'Alert thresholds updated successfully.',
      data: threshold
    });
  } catch (err) {
    console.error('Update thresholds error:', err);
    return res.status(500).json({ success: false, message: 'Server error updating thresholds.' });
  }
};

exports.resolveAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const alert = await AlertRepo.findById(id);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found.' });
    }

    const updated = await AlertRepo.findByIdAndUpdate(id, {
      status: 'Resolved',
      resolvedAt: new Date().toISOString()
    }, { new: true });

    return res.status(200).json({
      success: true,
      message: 'Alert marked as resolved.',
      alert: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error resolving alert.' });
  }
};

exports.dismissAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const alert = await AlertRepo.findById(id);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found.' });
    }

    await AlertRepo.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Alert dismissed successfully.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error dismissing alert.' });
  }
};
