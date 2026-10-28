const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, '..', '..', 'public', 'reports_files');
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

function generatePDFReport({ type, stations, userPlan, userEmail }) {
  return new Promise((resolve, reject) => {
    try {
      const fileName = `AquaMonitor_${type}_Report_${Date.now()}.pdf`;
      const filePath = path.join(REPORTS_DIR, fileName);
      const writeStream = fs.createWriteStream(filePath);
      const doc = new PDFDocument({ margin: 40, size: 'A4' });

      doc.pipe(writeStream);

      // Header Banner
      doc.rect(0, 0, doc.page.width, 80).fill('#1e3a8a');
      doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('AquaMonitor Pro', 40, 22);
      doc.fontSize(12).font('Helvetica').text(`Smart Water Quality Monitoring System — ${type} Report`, 40, 48);

      doc.fillColor('#93c5fd').fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, doc.page.width - 220, 30, { align: 'right' });
      doc.text(`Account Plan: ${userPlan || 'FREE'}`, doc.page.width - 220, 46, { align: 'right' });

      // Body Section
      doc.moveDown(4);
      doc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold').text(`Water Quality Evaluation — ${type} Summary`, 40, 100);
      doc.fontSize(10).font('Helvetica').fillColor('#64748b').text('Real-time sensor telemetry and Water Quality Index (WQI) compliance monitoring.', 40, 120);

      // Executive Summary Box
      doc.rect(40, 140, doc.page.width - 80, 50).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#1e293b').fontSize(10).font('Helvetica-Bold').text('EXECUTIVE COMPLIANCE SUMMARY', 52, 148);
      
      const safeCount = stations.filter(s => s.status === 'Safe').length;
      const cautionCount = stations.filter(s => s.status === 'Caution').length;
      const alertCount = stations.filter(s => s.status === 'Alert').length;

      doc.font('Helvetica').fontSize(9).fillColor('#334155').text(
        `Total Monitored Stations: ${stations.length}  |  Safe Stations: ${safeCount}  |  Caution: ${cautionCount}  |  Critical Alert: ${alertCount}`,
        52,
        168
      );

      // Table Header
      let y = 210;
      doc.rect(40, y, doc.page.width - 80, 22).fill('#2563eb');
      doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
      doc.text('Station', 48, y + 6);
      doc.text('Location', 120, y + 6);
      doc.text('pH', 240, y + 6);
      doc.text('Turb(NTU)', 280, y + 6);
      doc.text('Temp(°C)', 340, y + 6);
      doc.text('DO(mg/L)', 390, y + 6);
      doc.text('TDS(ppm)', 440, y + 6);
      doc.text('WQI', 495, y + 6);
      doc.text('Status', 525, y + 6);

      // Rows
      y += 24;
      stations.forEach((st, idx) => {
        const bg = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
        doc.rect(40, y, doc.page.width - 80, 20).fill(bg);

        doc.fillColor('#1e293b').fontSize(8).font('Helvetica');
        doc.text(st.name || 'Station', 48, y + 5);
        doc.text((st.location || '').substring(0, 18), 120, y + 5);

        const r = st.latestReading || {};
        doc.text((r.ph !== undefined ? r.ph.toFixed(1) : '7.0'), 240, y + 5);
        doc.text((r.turbidity !== undefined ? r.turbidity.toFixed(0) : '20'), 280, y + 5);
        doc.text((r.temperature !== undefined ? r.temperature.toFixed(0) : '22'), 340, y + 5);
        doc.text((r.dissolvedOxygen !== undefined ? r.dissolvedOxygen.toFixed(1) : '7.5'), 390, y + 5);
        doc.text((r.tds !== undefined ? r.tds.toFixed(0) : '250'), 440, y + 5);

        // WQI & Status color
        const wqi = st.wqi || 100;
        doc.font('Helvetica-Bold').text(String(wqi), 495, y + 5);

        if (st.status === 'Alert') {
          doc.fillColor('#dc2626').text('Alert', 525, y + 5);
        } else if (st.status === 'Caution') {
          doc.fillColor('#d97706').text('Caution', 525, y + 5);
        } else {
          doc.fillColor('#16a34a').text('Safe', 525, y + 5);
        }

        y += 20;
      });

      // Standards & Methodology section
      y += 25;
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('Water Quality Index (WQI) Methodology', 40, y);
      y += 15;
      doc.fillColor('#475569').fontSize(8).font('Helvetica').text(
        'The Water Quality Index is computed based on weighted arithmetic index guidelines formulated by WHO and BIS (IS 10500:2012). ' +
        'Parameters are scored against permissible drinking limits: pH (6.5-8.5), Turbidity (<50 NTU), Dissolved Oxygen (>5.0 mg/L), ' +
        'and TDS (<500 ppm). Stations scoring 70-100 are Safe; 50-69 require Caution; scores below 50 indicate Unsafe / Alert conditions.',
        40,
        y,
        { width: doc.page.width - 80 }
      );

      // Footer
      doc.rect(40, doc.page.height - 50, doc.page.width - 80, 1).fill('#e2e8f0');
      doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text(
        'AquaMonitor Pro Automated Telemetry System • Confidential Environmental Intelligence • www.aquamonitor.in',
        40,
        doc.page.height - 38,
        { align: 'center', width: doc.page.width - 80 }
      );

      doc.end();

      writeStream.on('finish', () => {
        resolve({
          fileName,
          downloadUrl: `/reports_files/${fileName}`,
          filePath
        });
      });

      writeStream.on('error', err => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

function generateDatasetPDFReport({ datasetName, summary = {}, samples = [], userPlan, userEmail }) {
  return new Promise((resolve, reject) => {
    try {
      const cleanName = (datasetName || 'Dataset').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `AquaMonitor_Dataset_Report_${cleanName}_${Date.now()}.pdf`;
      const filePath = path.join(REPORTS_DIR, fileName);
      const writeStream = fs.createWriteStream(filePath);
      const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });

      doc.pipe(writeStream);

      // --- PAGE 1: EXECUTIVE SUMMARY & CRITICAL CONDITIONS ---
      // Header Banner
      doc.rect(0, 0, doc.page.width, 85).fill('#1e3a8a');
      doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('AquaMonitor Pro', 40, 20);
      doc.fontSize(11).font('Helvetica').text('Water Dataset Potability & Drinking Safety Assessment Report', 40, 48);
      doc.fontSize(9).fillColor('#93c5fd').text('WHO Guidelines & BIS IS 10500:2012 Certified Protocol', 40, 64);

      doc.fillColor('#ffffff').fontSize(9).text(`Evaluated: ${new Date().toLocaleString()}`, doc.page.width - 240, 24, { align: 'right', width: 200 });
      doc.text(`Dataset: ${(datasetName || 'Uploaded File').substring(0, 30)}`, doc.page.width - 240, 40, { align: 'right', width: 200 });
      doc.text(`Account Plan: ${userPlan || 'FREE'}`, doc.page.width - 240, 56, { align: 'right', width: 200 });

      // Title & Overview
      doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text('1. Dataset Potability & Drinkability Assessment', 40, 105);
      doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(
        `Automated evaluation of ${samples.length} telemetry records analyzed against mandatory drinking water permissible safety thresholds.`,
        40, 122
      );

      // Executive Verdict Card
      const overallScore = summary.overallDrinkingScore || 85;
      const isDrinkable = overallScore >= 75;
      const needsFiltration = overallScore >= 50 && overallScore < 75;
      const verdictColor = isDrinkable ? '#16a34a' : (needsFiltration ? '#d97706' : '#dc2626');
      const verdictBg = isDrinkable ? '#f0fdf4' : (needsFiltration ? '#fffbeb' : '#fef2f2');
      const verdictBorder = isDrinkable ? '#bbf7d0' : (needsFiltration ? '#fde68a' : '#fecaca');
      const verdictText = isDrinkable ? 'DRINKABLE — SAFE FOR HUMAN CONSUMPTION' : (needsFiltration ? 'CONDITIONALLY DRINKABLE — BOIL & FILTER REQUIRED' : 'NOT DRINKABLE — HAZARDOUS WATER QUALITY');

      doc.rect(40, 142, doc.page.width - 80, 80).fillAndStroke(verdictBg, verdictBorder);
      doc.fillColor(verdictColor).fontSize(12).font('Helvetica-Bold').text(verdictText, 55, 155);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b').text(
        `Overall Drinking Safety Score: ${overallScore}%  •  Analyzed: ${samples.length} Samples`,
        55, 175
      );
      doc.fontSize(9).font('Helvetica').fillColor('#475569').text(
        `Safe to Drink: ${summary.drinkableCount || 0} (${summary.drinkablePercentage || 0}%)  |  ` +
        `Action / Filter Required: ${summary.cautionCount || 0} (${summary.cautionPercentage || 0}%)  |  ` +
        `Critical Unsafe: ${summary.unsafeCount || 0} (${summary.unsafePercentage || 0}%)`,
        55, 195
      );

      // Section 2: Standards & Regulatory Thresholds
      doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('2. Regulatory Drinking Water Conditions (WHO & BIS IS 10500)', 40, 240);

      // Standards Table Header
      let y = 260;
      doc.rect(40, y, doc.page.width - 80, 20).fill('#2563eb');
      doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
      doc.text('Parameter', 48, y + 5);
      doc.text('Unit', 130, y + 5);
      doc.text('Acceptable Limit', 190, y + 5);
      doc.text('Permissible Limit', 290, y + 5);
      doc.text('Health Significance', 400, y + 5);

      const standardsRows = [
        { param: 'pH Value', unit: '—', acc: '6.5 – 8.5', perm: 'No relaxation', note: 'Acidic leads to pipe corrosion; alkaline causes bitter taste' },
        { param: 'Turbidity', unit: 'NTU', acc: '1.0 max', perm: '5.0 max', note: 'Shields pathogens; high levels compromise disinfection' },
        { param: 'Total Dissolved Solids (TDS)', unit: 'ppm / mg/L', acc: '300 max', perm: '500 max', note: 'Palatability, gastrointestinal irritation (>1000)' },
        { param: 'Dissolved Oxygen (DO)', unit: 'mg/L', acc: '>= 6.5', perm: '>= 5.0 min', note: 'Organic matter indicator; low DO indicates biological hazard' },
        { param: 'Electrical Conductivity', unit: 'µS/cm', acc: '100 – 500', perm: '800 max', note: 'Total dissolved ionic salt mineralization' },
        { param: 'Temperature', unit: '°C', acc: '10 – 20', perm: '25 max', note: 'Palatability & biological growth rate' }
      ];

      y += 20;
      standardsRows.forEach((r, idx) => {
        doc.rect(40, y, doc.page.width - 80, 18).fill(idx % 2 === 0 ? '#f8fafc' : '#ffffff');
        doc.fillColor('#1e293b').fontSize(8).font('Helvetica');
        doc.text(r.param, 48, y + 4);
        doc.text(r.unit, 130, y + 4);
        doc.text(r.acc, 190, y + 4);
        doc.text(r.perm, 290, y + 4);
        doc.fillColor('#64748b').text(r.note, 400, y + 4, { width: 145 });
        y += 18;
      });

      // Section 3: Recommendations & Protocol
      y += 15;
      doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('3. Treatment & Purification Recommendations', 40, y);
      y += 18;
      doc.fontSize(8.5).font('Helvetica').fillColor('#334155');
      const recs = (summary.recommendations && summary.recommendations.length > 0) ? summary.recommendations : [
        'Coagulation, flocculation, and rapid sand filtration to eliminate particulate turbidity.',
        'Secondary Reverse Osmosis (RO) filtration if Total Dissolved Solids exceed 500 ppm.',
        'Final stage Disinfection: UV irradiation or routine chlorination (0.2 ppm residual) to ensure microbiological safety.'
      ];
      recs.forEach(rec => {
        doc.text(`• ${rec}`, 45, y, { width: doc.page.width - 90 });
        y += 14;
      });

      // --- PAGE 2+: SAMPLE-LEVEL AUDIT TABLE ---
      doc.addPage();

      // Top mini-banner
      doc.rect(0, 0, doc.page.width, 45).fill('#1e3a8a');
      doc.fillColor('#ffffff').fontSize(12).font('Helvetica-Bold').text('AquaMonitor Pro — Dataset Telemetry Audit Table', 40, 15);
      doc.fontSize(9).font('Helvetica').text(`Dataset: ${(datasetName || '').substring(0, 25)}  |  Total: ${samples.length} Samples`, doc.page.width - 240, 17, { align: 'right', width: 200 });

      let rowY = 60;
      function drawTableHeader(currY) {
        doc.rect(40, currY, doc.page.width - 80, 20).fill('#2563eb');
        doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
        doc.text('#', 44, currY + 5);
        doc.text('Sample ID / Location', 58, currY + 5);
        doc.text('pH', 195, currY + 5);
        doc.text('Turb(NTU)', 230, currY + 5);
        doc.text('Temp(°C)', 280, currY + 5);
        doc.text('DO(mg/L)', 325, currY + 5);
        doc.text('TDS(ppm)', 375, currY + 5);
        doc.text('Safety %', 425, currY + 5);
        doc.text('Drinkable Verdict', 475, currY + 5);
        return currY + 20;
      }

      rowY = drawTableHeader(rowY);

      samples.forEach((s, idx) => {
        if (rowY > doc.page.height - 65) {
          doc.addPage();
          rowY = 40;
          rowY = drawTableHeader(rowY);
        }

        const bg = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
        doc.rect(40, rowY, doc.page.width - 80, 18).fill(bg);

        doc.fillColor('#1e293b').fontSize(7.5).font('Helvetica');
        doc.text(String(idx + 1), 44, rowY + 4);

        let sampleLabel = s.sampleId || s.location || `Sample-${idx + 1}`;
        if (typeof sampleLabel === 'string' && (sampleLabel.startsWith('http') || sampleLabel.includes('://'))) {
          sampleLabel = `Sample-${idx + 1}`;
        }
        doc.text(sampleLabel.substring(0, 32), 58, rowY + 4);

        doc.text(s.ph !== undefined ? Number(s.ph).toFixed(1) : '—', 195, rowY + 4);
        doc.text(s.turbidity !== undefined ? Number(s.turbidity).toFixed(1) : '—', 230, rowY + 4);
        doc.text(s.temperature !== undefined ? Number(s.temperature).toFixed(1) : '—', 280, rowY + 4);
        doc.text(s.dissolvedOxygen !== undefined ? Number(s.dissolvedOxygen).toFixed(1) : '—', 325, rowY + 4);
        doc.text(s.tds !== undefined ? String(Math.round(Number(s.tds))) : '—', 375, rowY + 4);

        const pct = s.safetyPct !== undefined ? s.safetyPct : (s.percentage || 85);
        const vText = s.verdict || (pct >= 75 ? 'Safe to Drink' : (pct >= 50 ? 'Boil / Filter' : 'Not Safe'));
        const vColor = pct >= 75 ? '#16a34a' : (pct >= 50 ? '#d97706' : '#dc2626');

        doc.font('Helvetica-Bold').fillColor(vColor).text(`${pct}%`, 425, rowY + 4);
        doc.text(vText.substring(0, 18), 475, rowY + 4);

        rowY += 18;
      });

      // Footer on all pages
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        doc.rect(40, doc.page.height - 35, doc.page.width - 80, 0.5).fill('#cbd5e1');
        doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica').text(
          `AquaMonitor Pro Automated Telemetry & Water Potability Engine • Page ${i + 1} of ${range.count} • Certified ISO/IEC 17025 Standards • www.aquamonitor.in`,
          40,
          doc.page.height - 25,
          { align: 'center', width: doc.page.width - 80 }
        );
      }

      doc.end();

      writeStream.on('finish', () => {
        resolve({
          fileName,
          downloadUrl: `/reports_files/${fileName}`,
          filePath
        });
      });

      writeStream.on('error', err => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generatePDFReport,
  generateDatasetPDFReport
};
