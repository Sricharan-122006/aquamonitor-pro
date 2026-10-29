/**
 * Safety Checker Controller
 */

const safetyCheckerService = require('../services/safety-checker.service');

async function lookupPin(req, res, next) {
  try {
    const { pincode } = req.params;
    const result = await safetyCheckerService.lookupPostalPincode(pincode);
    return res.status(200).json({
      success: true,
      message: 'Location verified successfully.',
      data: result
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'We could not verify this PIN code right now. Please try again.'
    });
  }
}

async function getDashboardData(req, res, next) {
  try {
    const { pincode } = req.params;
    const { postOffice } = req.query;
    const demoData = safetyCheckerService.getDemoWaterQualityData(pincode, postOffice);
    return res.status(200).json({
      success: true,
      data: demoData
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to retrieve water quality data.'
    });
  }
}

async function bookTest(req, res, next) {
  try {
    const booking = safetyCheckerService.createDemoBooking(req.body);
    return res.status(201).json({
      success: true,
      message: 'Demo booking created successfully.',
      confirmationNotice: 'Demo booking only. No real laboratory appointment has been created.',
      booking
    });
  } catch (err) {
    return res.status(err.statusCode || 400).json({
      success: false,
      message: err.message || 'Failed to process booking request.'
    });
  }
}

module.exports = {
  lookupPin,
  getDashboardData,
  bookTest
};
