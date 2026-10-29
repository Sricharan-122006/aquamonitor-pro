const path = require('path');
const fs = require('fs');
const { ReportRepo, StationRepo } = require('../storage/repository');
const { generatePDFReport, generateDatasetPDFReport } = require('../services/pdf.service');

exports.getReportsList = async (req, res) => {
  try {
    const reports = await ReportRepo.find({}, { createdAt: -1 });
    const userPlan = req.user ? req.user.plan : 'FREE';

    return res.status(200).json({
      success: true,
      currentPlan: userPlan,
      reports
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error retrieving reports.' });
  }
};

exports.generateReport = async (req, res) => {
  try {
    const { type = 'Daily' } = req.body;
    const userPlan = req.user ? req.user.plan : 'FREE';
    const isPro = userPlan === 'PRO' || userPlan === 'ENTERPRISE' || req.user.role === 'ADMIN';

    // Enforcement: Weekly and Monthly require Pro Plan
    if ((type === 'Weekly' || type === 'Monthly') && !isPro) {
      return res.status(403).json({
        success: false,
        message: `${type} reports require an active Pro or Enterprise subscription. Please upgrade your plan to unlock advanced reports.`,
        upgradeRequired: true
      });
    }

    const stations = await StationRepo.find();
    const pdfResult = await generatePDFReport({
      type,
      stations,
      userPlan,
      userEmail: req.user.email
    });

    const newReport = await ReportRepo.create({
      title: `${type} Report — ${new Date().toLocaleDateString('en-US')}`,
      type,
      generatedDate: new Date().toLocaleDateString('en-US'),
      generatedTime: `Today ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
      stations: 'All',
      status: 'Ready',
      planRequired: type === 'Daily' ? 'FREE' : 'PRO',
      downloadUrl: pdfResult.downloadUrl
    });

    return res.status(201).json({
      success: true,
      message: `${type} report generated successfully.`,
      report: newReport,
      downloadUrl: pdfResult.downloadUrl
    });
  } catch (err) {
    console.error('Report generation error:', err);
    return res.status(500).json({ success: false, message: 'Server error generating PDF report.' });
  }
};

exports.downloadReport = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await ReportRepo.findById(id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report record not found.' });
    }

    const userPlan = req.user ? req.user.plan : 'FREE';
    const isPro = userPlan === 'PRO' || userPlan === 'ENTERPRISE' || req.user.role === 'ADMIN';

    if (report.planRequired === 'PRO' && !isPro) {
      return res.status(403).json({
        success: false,
        message: 'This report requires a Pro subscription to download.',
        upgradeRequired: true
      });
    }

    if (!report.downloadUrl) {
      // Re-generate if missing
      const stations = await StationRepo.find();
      const pdf = await generatePDFReport({
        type: report.type,
        stations,
        userPlan,
        userEmail: req.user.email
      });
      report.downloadUrl = pdf.downloadUrl;
      await ReportRepo.findByIdAndUpdate(id, { downloadUrl: pdf.downloadUrl });
    }

    const filePath = path.join(__dirname, '..', '..', 'public', report.downloadUrl.replace(/^\//, ''));
    if (fs.existsSync(filePath)) {
      return res.download(filePath);
    } else {
      // Generate dynamically and stream
      const stations = await StationRepo.find();
      const pdf = await generatePDFReport({
        type: report.type,
        stations,
        userPlan,
        userEmail: req.user.email
      });
      return res.download(pdf.filePath);
    }
  } catch (err) {
    console.error('Download report error:', err);
    return res.status(500).json({ success: false, message: 'Server error downloading report.' });
  }
};

exports.generateDatasetReport = async (req, res) => {
  try {
    const { datasetName = 'Water_Quality_Dataset.csv', summary = {}, samples = [] } = req.body;
    const userPlan = req.user ? req.user.plan : 'FREE';
    const userEmail = req.user ? req.user.email : 'guest@aquamonitor.in';

    if (!Array.isArray(samples) || samples.length === 0) {
      return res.status(400).json({ success: false, message: 'Dataset must contain at least one valid sample row.' });
    }

    const pdfResult = await generateDatasetPDFReport({
      datasetName,
      summary,
      samples,
      userPlan,
      userEmail
    });

    let newReport = null;
    if (req.user && req.user.email) {
      try {
        newReport = await ReportRepo.create({
          title: `Dataset Report — ${datasetName}`,
          type: 'Dataset Potability',
          generatedDate: new Date().toLocaleDateString('en-US'),
          generatedTime: `Today ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
          stations: `${samples.length} Samples`,
          status: 'Ready',
          planRequired: 'FREE',
          downloadUrl: pdfResult.downloadUrl
        });
      } catch (dbErr) {
        console.warn('Could not persist dataset report to database:', dbErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Dataset drinking safety report generated successfully.',
      downloadUrl: pdfResult.downloadUrl,
      fileName: pdfResult.fileName,
      report: newReport
    });
  } catch (err) {
    console.error('Dataset report generation error:', err);
    return res.status(500).json({ success: false, message: 'Server error generating dataset report: ' + err.message });
  }
};
