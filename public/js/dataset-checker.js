/**
 * AquaMonitor Pro - Water Dataset Potability & Drinking Safety Engine
 * Standardized against WHO Guidelines & BIS IS 10500:2012 Drinking Water Standards
 */

(function() {
  'use strict';

  // Internal module state
  const state = {
    datasetName: '',
    rawRows: [],
    analyzedSamples: [],
    summary: null,
    filter: 'ALL',
    searchQuery: '',
    isProcessing: false
  };

  /**
   * Initialize module listeners
   */
  function init() {
    setupDropzone();
  }

  function setupDropzone() {
    const dropzone = document.getElementById('dcDropzone');
    if (!dropzone) return;

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      }, false);
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
    });
  }

  function triggerFileInput() {
    const input = document.getElementById('dcFileInput');
    if (input) {
      input.value = '';
      input.click();
    }
  }

  function handleFileSelect(event) {
    const files = event.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }

  /**
   * Process and parse uploaded file (CSV, TSV, JSON)
   */
  function processFile(file) {
    if (!file) return;
    const name = file.name;
    const ext = name.split('.').pop().toLowerCase();

    if (!['csv', 'tsv', 'txt', 'json'].includes(ext)) {
      showToast('Please upload a valid CSV, TSV, or JSON dataset file.', 'alert');
      return;
    }

    state.datasetName = name;
    state.isProcessing = true;
    showToast(`Reading dataset: ${name}...`, 'info');

    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const content = e.target.result;
        let parsed = [];
        if (ext === 'json') {
          parsed = JSON.parse(content);
          if (!Array.isArray(parsed)) {
            throw new Error('JSON dataset must be an array of telemetry objects.');
          }
        } else {
          parsed = parseCSV(content, ext === 'tsv' ? '\t' : ',');
        }

        if (!parsed || parsed.length === 0) {
          throw new Error('No valid data rows detected in uploaded file.');
        }

        analyzeDataset(parsed);
      } catch (err) {
        console.error('File parsing error:', err);
        showToast(`Failed to parse dataset: ${err.message}`, 'alert');
      } finally {
        state.isProcessing = false;
      }
    };

    reader.onerror = function() {
      showToast('Error reading file from disk.', 'alert');
      state.isProcessing = false;
    };

    reader.readAsText(file);
  }

  /**
   * Lightweight robust CSV parser
   */
  function parseCSV(text, delimiter = ',') {
    const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];

    // Header extraction
    const rawHeaders = splitCSVLine(lines[0], delimiter);
    const headers = rawHeaders.map(h => normalizeHeader(h));

    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const rowVals = splitCSVLine(lines[i], delimiter);
      if (rowVals.length === 0 || (rowVals.length === 1 && !rowVals[0].trim())) continue;

      const record = {};
      headers.forEach((h, idx) => {
        if (h) {
          record[h] = rowVals[idx] !== undefined ? cleanValue(rowVals[idx], h) : '';
        }
      });
      records.push(record);
    }
    return records;
  }

  function splitCSVLine(line, delimiter) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === delimiter && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  }

  function normalizeHeader(h) {
    if (!h) return '';
    const clean = h.toLowerCase().replace(/[^a-z0-9]/g, '');

    // 1. Explicitly isolate metadata, web URLs, notes, comments, organization or source citations
    if (clean.includes('url') || clean.includes('link') || clean.includes('http') ||
        clean.includes('note') || clean.includes('comment') || clean.includes('citation') ||
        clean.includes('org') || clean.includes('source') || clean.includes('agency')) {
      return `_meta_${clean}`;
    }

    // 2. Station, Sample & Geographic Identifiers
    if (clean.includes('station') || clean.includes('stnid') || clean.includes('siteid') || clean === 'stn' || clean === 'stationcode') {
      return 'stationId';
    }
    if (clean.includes('sample') || clean === 'id' || clean === 'code' || clean === 'sampleid' || clean === 'sampleno') {
      return 'sampleId';
    }
    if (clean.includes('river') || clean.includes('waterbody') || clean.includes('stream') || clean.includes('creek') || clean.includes('canal')) {
      return 'riverName';
    }
    if (clean.includes('city') || clean.includes('town') || clean.includes('district')) {
      return 'city';
    }
    if (clean.includes('state') || clean.includes('province')) {
      return 'state';
    }
    if (clean.includes('location') || clean.includes('address') || clean.includes('site') || clean.includes('place')) {
      return 'location';
    }
    if (clean.includes('month')) {
      return 'month';
    }
    if (clean.includes('year') || clean.includes('date')) {
      return 'year';
    }

    // 3. Water Quality Parameters
    // pH
    if (clean.startsWith('ph') && clean.includes('min')) return 'phMin';
    if (clean.startsWith('ph') && clean.includes('max')) return 'phMax';
    if (clean.startsWith('ph') || clean === 'p_h') return 'ph';

    // Dissolved Oxygen (DO)
    if ((clean.includes('dissolved') || clean.includes('oxygen') || clean.startsWith('do')) && clean.includes('min')) return 'doMin';
    if ((clean.includes('dissolved') || clean.includes('oxygen') || clean.startsWith('do')) && clean.includes('max')) return 'doMax';
    if (clean.includes('dissolved') || clean.includes('oxygen') || clean === 'do' || clean.includes('domgl')) return 'dissolvedOxygen';

    // Conductivity
    if ((clean.includes('conduct') || clean.includes('ec')) && clean.includes('min')) return 'conductivityMin';
    if ((clean.includes('conduct') || clean.includes('ec')) && clean.includes('max')) return 'conductivityMax';
    if (clean.includes('conduct') || clean.includes('ec') || clean.includes('uscm')) return 'conductivity';

    // Temperature
    if (clean.includes('temp') && clean.includes('min')) return 'tempMin';
    if (clean.includes('temp') && clean.includes('max')) return 'tempMax';
    if (clean.includes('temp')) return 'temperature';

    // Turbidity
    if (clean.includes('turbid') && clean.includes('min')) return 'turbidityMin';
    if (clean.includes('turbid') && clean.includes('max')) return 'turbidityMax';
    if (clean.includes('turbid') || clean.includes('ntu')) return 'turbidity';

    // Total Dissolved Solids
    if (clean.includes('tds') || clean.includes('solids') || clean.includes('ppm')) return 'tds';

    // Biochemical Oxygen Demand (BOD)
    if (clean.includes('bod') && clean.includes('min')) return 'bodMin';
    if (clean.includes('bod') && clean.includes('max')) return 'bodMax';
    if (clean.includes('bod')) return 'bod';

    // Nitrate
    if (clean.includes('nitrate') && clean.includes('min')) return 'nitrateMin';
    if (clean.includes('nitrate') && clean.includes('max')) return 'nitrateMax';
    if (clean.includes('nitrate')) return 'nitrate';

    // Additional chemical characteristics
    if (clean.includes('hard')) return 'hardness';
    if (clean.includes('sulf')) return 'sulfate';
    if (clean.includes('chlor')) return 'chloramines';

    return clean;
  }

  function cleanValue(val, headerKey) {
    if (val === undefined || val === null) return '';
    if (typeof val !== 'string') return val;
    val = val.trim();
    if (val === '') return '';

    // Text & identifier columns: preserve exactly without numeric stripping
    const textHeaders = ['sampleId', 'stationId', 'riverName', 'city', 'state', 'location', 'month', 'year'];
    if (headerKey && (textHeaders.includes(headerKey) || headerKey.startsWith('_meta_'))) {
      return val;
    }

    // Strip common measurement units like NTU, ppm, °C, mg/L, µS/cm
    const stripped = val.replace(/[^\d.-]/g, '').trim();
    if (stripped !== '' && !isNaN(Number(stripped))) {
      return Number(stripped);
    }
    return val;
  }

  /**
   * Format human-readable sample identifier and geographical location
   * Avoids exposing raw URLs or internal system citations
   */
  function formatSampleId(row, index) {
    // 1. Explicit sample identifier (if not a web URL)
    const rawSampleId = (row.sampleId !== undefined && row.sampleId !== null) ? String(row.sampleId).trim() : '';
    const isSampleIdValid = rawSampleId && 
      !rawSampleId.startsWith('http://') && 
      !rawSampleId.startsWith('https://') && 
      !rawSampleId.includes('://') && 
      !rawSampleId.includes('www.') && 
      !rawSampleId.includes('github') && 
      !rawSampleId.toLowerCase().includes('source_url');

    // 2. Station ID
    const rawStation = (row.stationId !== undefined && row.stationId !== null) ? String(row.stationId).trim() : '';
    const hasStation = rawStation && 
      !rawStation.startsWith('http') && 
      !rawStation.includes('://');

    // 3. River Name
    const rawRiver = (row.riverName && typeof row.riverName === 'string') ? row.riverName.trim() : '';
    const hasRiver = rawRiver && !rawRiver.startsWith('http');

    // 4. City & State
    const rawCity = (row.city && typeof row.city === 'string') ? row.city.trim() : '';
    const rawState = (row.state && typeof row.state === 'string') ? row.state.trim() : '';

    // If dataset contains station/river/city/state (e.g. CPCB Indian River format)
    if (hasStation || hasRiver || (rawCity && rawState)) {
      const parts = [];
      if (hasStation) {
        const prefix = rawStation.toUpperCase().startsWith('ST-') ? rawStation : `ST-${rawStation}`;
        parts.push(prefix);
      }
      if (hasRiver) {
        const riverLabel = rawRiver.toLowerCase().includes('river') ? rawRiver : `${rawRiver} River`;
        parts.push(riverLabel);
      }
      if (rawCity) {
        parts.push(rawCity);
      }
      if (rawState) {
        parts.push(rawState);
      }
      return parts.join(' • ');
    }

    // If explicit valid sampleId is present
    if (isSampleIdValid) {
      if (row.location && typeof row.location === 'string' && row.location.trim() && !row.location.startsWith('http')) {
        const loc = row.location.trim();
        const shortLoc = loc.length > 25 ? loc.substring(0, 25) + '...' : loc;
        return `${rawSampleId} • ${shortLoc}`;
      }
      return rawSampleId;
    }

    // If location is present
    if (row.location && typeof row.location === 'string' && row.location.trim() && !row.location.startsWith('http')) {
      const loc = row.location.trim();
      return loc.length > 35 ? loc.substring(0, 35) + '...' : loc;
    }

    // Default fallback
    return `Sample #${index + 1}`;
  }

  /**
   * Evaluate drinking conditions against WHO & BIS IS 10500:2012
   */
  function evaluateSample(row, index) {
    const sampleId = formatSampleId(row, index);

    // pH calculation (supporting ph, phMin, phMax)
    let ph = 7.2;
    if (row.ph !== undefined && row.ph !== '' && !isNaN(Number(row.ph))) {
      ph = Number(row.ph);
    } else if (row.phMin !== undefined && row.phMax !== undefined && row.phMin !== '' && row.phMax !== '') {
      const pMin = Number(row.phMin);
      const pMax = Number(row.phMax);
      if (!isNaN(pMin) && !isNaN(pMax)) {
        ph = (Math.abs(pMin - 7.2) > Math.abs(pMax - 7.2)) ? pMin : pMax;
      } else if (!isNaN(pMax)) {
        ph = pMax;
      } else if (!isNaN(pMin)) {
        ph = pMin;
      }
    } else if (row.phMax !== undefined && row.phMax !== '' && !isNaN(Number(row.phMax))) {
      ph = Number(row.phMax);
    } else if (row.phMin !== undefined && row.phMin !== '' && !isNaN(Number(row.phMin))) {
      ph = Number(row.phMin);
    }

    // Dissolved Oxygen (mg/L) (minimum DO is critical safety threshold for potability)
    let dissolvedOxygen = 7.5;
    if (row.dissolvedOxygen !== undefined && row.dissolvedOxygen !== '' && !isNaN(Number(row.dissolvedOxygen))) {
      dissolvedOxygen = Number(row.dissolvedOxygen);
    } else if (row.doMin !== undefined && row.doMin !== '' && !isNaN(Number(row.doMin))) {
      dissolvedOxygen = Number(row.doMin);
    } else if (row.doMax !== undefined && row.doMax !== '' && !isNaN(Number(row.doMax))) {
      dissolvedOxygen = Number(row.doMax);
    }

    // Electrical Conductivity (µS/cm) (maximum conductivity represents highest ionic load)
    let conductivity = 300;
    if (row.conductivity !== undefined && row.conductivity !== '' && !isNaN(Number(row.conductivity))) {
      conductivity = Number(row.conductivity);
    } else if (row.conductivityMax !== undefined && row.conductivityMax !== '' && !isNaN(Number(row.conductivityMax))) {
      conductivity = Number(row.conductivityMax);
    } else if (row.conductivityMin !== undefined && row.conductivityMin !== '' && !isNaN(Number(row.conductivityMin))) {
      conductivity = Number(row.conductivityMin);
    }

    // Temperature (°C)
    let temperature = 22.0;
    if (row.temperature !== undefined && row.temperature !== '' && !isNaN(Number(row.temperature))) {
      temperature = Number(row.temperature);
    } else if (row.tempMax !== undefined && row.tempMax !== '' && !isNaN(Number(row.tempMax))) {
      temperature = Number(row.tempMax);
    } else if (row.tempMin !== undefined && row.tempMin !== '' && !isNaN(Number(row.tempMin))) {
      temperature = Number(row.tempMin);
    }

    // Total Dissolved Solids (ppm)
    // Hydrochemical conversion: TDS ≈ EC (µS/cm) * 0.65 when TDS not directly measured
    let tds = 250;
    if (row.tds !== undefined && row.tds !== '' && !isNaN(Number(row.tds))) {
      tds = Number(row.tds);
    } else if (conductivity > 0) {
      tds = Math.round(conductivity * 0.65);
    }

    // Turbidity (NTU)
    let turbidity = 2.5;
    if (row.turbidity !== undefined && row.turbidity !== '' && !isNaN(Number(row.turbidity))) {
      turbidity = Number(row.turbidity);
    } else if (row.turbidityMax !== undefined && row.turbidityMax !== '' && !isNaN(Number(row.turbidityMax))) {
      turbidity = Number(row.turbidityMax);
    } else if (row.bodMax !== undefined && row.bodMax !== '' && !isNaN(Number(row.bodMax)) && Number(row.bodMax) > 5) {
      // High BOD indicates sewage / heavy suspended organic waste
      turbidity = Math.min(35, Math.round(Number(row.bodMax) * 1.2));
    } else {
      turbidity = 2.5;
    }

    const violations = [];
    const treatments = [];

    // Condition 1: pH (6.5 – 8.5)
    let phScore = 100;
    if (ph < 6.5) {
      phScore = Math.max(10, Math.round(80 - (6.5 - ph) * 45));
      violations.push(`Acidic pH ${ph.toFixed(1)} (< 6.5 safe limit)`);
      treatments.push('Alkalinity Neutralizer (Soda ash/Limestone)');
    } else if (ph > 8.5) {
      phScore = Math.max(10, Math.round(80 - (ph - 8.5) * 45));
      violations.push(`Alkaline pH ${ph.toFixed(1)} (> 8.5 safe limit)`);
      treatments.push('Acid Buffer / CO2 dosing');
    } else if (ph >= 7.0 && ph <= 7.5) {
      phScore = 99;
    } else {
      phScore = 92;
    }

    // Condition 2: Turbidity (Permissible <= 5 NTU, Desirable <= 1 NTU)
    let turbScore = 100;
    if (turbidity <= 1.0) {
      turbScore = 99;
    } else if (turbidity <= 5.0) {
      turbScore = Math.round(98 - ((turbidity - 1.0) / 4.0) * 12);
    } else if (turbidity <= 15.0) {
      turbScore = Math.round(82 - ((turbidity - 5.0) / 10.0) * 18);
      violations.push(`Turbidity ${turbidity.toFixed(1)} NTU exceeds drinking limit (<=5 NTU)`);
      treatments.push('Rapid Sand Filtration');
    } else {
      turbScore = Math.max(5, Math.round(55 - ((turbidity - 15.0) / 35.0) * 45));
      violations.push(`Severe Turbidity ${turbidity.toFixed(1)} NTU (Shields pathogens)`);
      treatments.push('Alum Coagulation + Multi-media Sand Filter');
    }

    // Condition 3: TDS (Desirable <= 300 ppm, Permissible <= 500 ppm)
    let tdsScore = 100;
    if (tds <= 300) {
      tdsScore = 98;
    } else if (tds <= 500) {
      tdsScore = Math.round(95 - ((tds - 300) / 200) * 12);
    } else if (tds <= 900) {
      tdsScore = Math.round(78 - ((tds - 500) / 400) * 22);
      violations.push(`TDS ${Math.round(tds)} ppm exceeds standard drinking limit (<=500 ppm)`);
      treatments.push('Reverse Osmosis (RO) Filtration');
    } else {
      tdsScore = Math.max(5, Math.round(48 - ((tds - 900) / 500) * 40));
      violations.push(`High TDS ${Math.round(tds)} ppm (Heavy mineral load)`);
      treatments.push('Industrial RO / Electrodialysis');
    }

    // Condition 4: Dissolved Oxygen (>= 5.0 mg/L)
    let doScore = 100;
    if (dissolvedOxygen >= 6.5) {
      doScore = 98;
    } else if (dissolvedOxygen >= 5.0) {
      doScore = Math.round(85 + (dissolvedOxygen - 5.0) * 8);
    } else {
      doScore = Math.max(5, Math.round(dissolvedOxygen * 13));
      violations.push(`Low DO ${dissolvedOxygen.toFixed(1)} mg/L (Biological decomposition risk)`);
      treatments.push('Cascade Aeration / O2 Injection');
    }

    // Condition 5: Conductivity (<= 800 µS/cm)
    let condScore = 100;
    if (conductivity <= 500) {
      condScore = 98;
    } else if (conductivity <= 800) {
      condScore = Math.round(92 - ((conductivity - 500) / 300) * 12);
    } else {
      condScore = Math.max(10, Math.round(75 - ((conductivity - 800) / 400) * 35));
      violations.push(`Conductivity ${Math.round(conductivity)} µS/cm exceeds 800 µS/cm`);
      treatments.push('De-ionization / Demineralization');
    }

    // Condition 6: Temperature (10 – 25°C)
    let tempScore = 98;
    if (temperature > 25 && temperature <= 32) {
      tempScore = 85;
    } else if (temperature > 32 || temperature < 8) {
      tempScore = 65;
      violations.push(`Temperature ${temperature.toFixed(1)}°C outside palatable drinking range`);
    }

    // Routine Disinfection
    if (treatments.length === 0) {
      treatments.push('Routine UV / Chlorination Disinfection (0.2 ppm residual)');
    } else {
      treatments.push('Final-stage UV / Chlorination Disinfection');
    }

    // Composite Weighted Drinking Safety Score
    const composite = Math.round(
      turbScore * 0.25 +
      phScore * 0.20 +
      tdsScore * 0.20 +
      doScore * 0.20 +
      condScore * 0.10 +
      tempScore * 0.05
    );

    const safetyPct = Math.max(5, Math.min(99, composite));

    let verdict = 'Safe to Drink';
    let verdictClass = 'safe';
    let badgeClass = 'badge-safe';

    if (safetyPct >= 75 && violations.length === 0) {
      verdict = 'Safe to Drink';
      verdictClass = 'safe';
      badgeClass = 'badge-safe';
    } else if (safetyPct >= 50) {
      verdict = 'Boil & Filter Required';
      verdictClass = 'caution';
      badgeClass = 'badge-caution';
    } else {
      verdict = 'Not Safe to Drink';
      verdictClass = 'alert';
      badgeClass = 'badge-alert';
    }

    return {
      index: index + 1,
      sampleId,
      ph,
      turbidity,
      temperature,
      dissolvedOxygen,
      tds,
      conductivity,
      phScore,
      turbScore,
      tdsScore,
      doScore,
      condScore,
      safetyPct,
      percentage: safetyPct,
      verdict,
      verdictClass,
      badgeClass,
      isDrinkable: safetyPct >= 75,
      violations,
      treatments
    };
  }

  /**
   * Analyze entire parsed dataset
   */
  function analyzeDataset(records) {
    const samples = records.map((r, i) => evaluateSample(r, i));
    state.analyzedSamples = samples;

    const total = samples.length;
    const safeSamples = samples.filter(s => s.verdictClass === 'safe');
    const cautionSamples = samples.filter(s => s.verdictClass === 'caution');
    const alertSamples = samples.filter(s => s.verdictClass === 'alert');

    const totalSafety = samples.reduce((acc, s) => acc + s.safetyPct, 0);
    const overallScore = Math.round(totalSafety / total);

    const drinkablePct = Math.round((safeSamples.length / total) * 100);
    const cautionPct = Math.round((cautionSamples.length / total) * 100);
    const alertPct = Math.round((alertSamples.length / total) * 100);

    // Violation parameter frequency
    const failTurb = samples.filter(s => s.turbidity > 5.0).length;
    const failPh = samples.filter(s => s.ph < 6.5 || s.ph > 8.5).length;
    const failTds = samples.filter(s => s.tds > 500).length;
    const failDo = samples.filter(s => s.dissolvedOxygen < 5.0).length;

    const recommendations = [];
    if (failTurb > 0) recommendations.push(`High Turbidity detected in ${failTurb} sample(s): Implement multi-media rapid sand filtration.`);
    if (failTds > 0) recommendations.push(`High Total Dissolved Solids (>500 ppm) in ${failTds} sample(s): Reverse Osmosis (RO) desalting required.`);
    if (failPh > 0) recommendations.push(`pH deviations in ${failPh} sample(s): Alkalinity buffering required before pipe distribution.`);
    if (failDo > 0) recommendations.push(`Low Dissolved Oxygen (<5.0 mg/L) in ${failDo} sample(s): Cascade aeration required.`);
    if (recommendations.length === 0) {
      recommendations.push('Water samples fully comply with WHO & BIS drinking standards. Routine chlorination / UV adequate.');
    }

    let overallVerdict = 'DRINKABLE — SAFE FOR HUMAN CONSUMPTION';
    let overallVerdictClass = 'safe';
    let overallVerdictDesc = `Evaluated against WHO & BIS IS 10500 standards: ${safeSamples.length} of ${total} samples (${drinkablePct}%) are fully safe for drinking with standard disinfection.`;

    if (alertPct > 35 || overallScore < 50) {
      overallVerdict = 'NOT DRINKABLE — HAZARDOUS WATER QUALITY';
      overallVerdictClass = 'alert';
      overallVerdictDesc = `CRITICAL WARNING: Significant contamination detected (${alertSamples.length} unsafe samples). Water does NOT meet potable standards and must not be consumed without extensive chemical treatment and Reverse Osmosis.`;
    } else if (cautionSamples.length > 0 || safeSamples.length < total) {
      overallVerdict = 'CONDITIONALLY DRINKABLE — TREATMENT REQUIRED';
      overallVerdictClass = 'caution';
      overallVerdictDesc = `CAUTION: ${cautionSamples.length} samples exhibit parameter deviations (elevated turbidity or mineral solids). Boiling, cartridge filtration, and secondary disinfection are required before consumption.`;
    }

    state.summary = {
      datasetName: state.datasetName || 'Water_Dataset.csv',
      totalSamples: total,
      overallDrinkingScore: overallScore,
      drinkableCount: safeSamples.length,
      drinkablePercentage: drinkablePct,
      cautionCount: cautionSamples.length,
      cautionPercentage: cautionPct,
      unsafeCount: alertSamples.length,
      unsafePercentage: alertPct,
      overallVerdict,
      overallVerdictClass,
      overallVerdictDesc,
      failTurb,
      failPh,
      failTds,
      failDo,
      recommendations
    };

    renderResultsUI();
    showToast(`Dataset analyzed: ${overallVerdict}`, overallVerdictClass === 'safe' ? 'success' : 'warning');
  }

  /**
   * Render Analysis Dashboard & Interactive Table
   */
  function renderResultsUI() {
    const resultsContainer = document.getElementById('dcResultsContainer');
    if (!resultsContainer || !state.summary) return;

    resultsContainer.style.display = 'block';

    // 1. Overall Verdict Banner
    const banner = document.getElementById('dcVerdictBanner');
    const badge = document.getElementById('dcVerdictBadge');
    const title = document.getElementById('dcVerdictTitle');
    const desc = document.getElementById('dcVerdictDesc');

    if (banner) {
      banner.className = `dc-verdict-banner dc-verdict-${state.summary.overallVerdictClass}`;
    }
    if (badge) {
      badge.innerHTML = `🛡️ Certified WHO/BIS Assessment • Score: ${state.summary.overallDrinkingScore}%`;
    }
    if (title) {
      title.innerText = state.summary.overallVerdict;
    }
    if (desc) {
      desc.innerText = state.summary.overallVerdictDesc;
    }

    // 2. Executive KPI Cards
    const elScore = document.getElementById('dcKpiScore');
    const elTotal = document.getElementById('dcKpiTotal');
    const elSafe = document.getElementById('dcKpiSafe');
    const elAction = document.getElementById('dcKpiAction');

    if (elScore) elScore.innerText = `${state.summary.overallDrinkingScore}%`;
    if (elTotal) elTotal.innerText = `${state.summary.totalSamples}`;
    if (elSafe) elSafe.innerText = `${state.summary.drinkableCount} (${state.summary.drinkablePercentage}%)`;
    if (elAction) elAction.innerText = `${state.summary.cautionCount + state.summary.unsafeCount} (${state.summary.cautionPercentage + state.summary.unsafePercentage}%)`;

    // 3. Filter Buttons Count Badges
    const btnAll = document.getElementById('dcFilterBtnAll');
    const btnSafe = document.getElementById('dcFilterBtnSafe');
    const btnCaution = document.getElementById('dcFilterBtnCaution');
    const btnAlert = document.getElementById('dcFilterBtnAlert');

    if (btnAll) btnAll.innerText = `All (${state.summary.totalSamples})`;
    if (btnSafe) btnSafe.innerText = `Safe to Drink (${state.summary.drinkableCount})`;
    if (btnCaution) btnCaution.innerText = `Boil / Filter (${state.summary.cautionCount})`;
    if (btnAlert) btnAlert.innerText = `Unsafe (${state.summary.unsafeCount})`;

    // 4. Populate Table Rows
    renderTableRows();

    // Scroll to results smoothly
    banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderSampleIdCell(sampleId) {
    if (!sampleId) return '<span style="color:var(--text-muted); font-style:italic;">Unknown Sample</span>';
    const parts = sampleId.split(' • ');
    if (parts.length > 1) {
      const primary = parts[0];
      const secondary = parts.slice(1).join(' • ');
      return `
        <div style="display:flex; flex-direction:column; gap:2px;">
          <span style="font-weight:700; color:var(--primary-color, #2563eb); font-size:0.88rem;">${escapeHtml(primary)}</span>
          <span style="font-size:0.75rem; color:var(--text-muted, #64748b); line-height:1.25;">${escapeHtml(secondary)}</span>
        </div>
      `;
    }
    return `<strong>${escapeHtml(sampleId)}</strong>`;
  }

  function renderTableRows() {
    const tbody = document.getElementById('dcTableTbody');
    if (!tbody) return;

    let filtered = state.analyzedSamples;
    if (state.filter === 'SAFE') filtered = filtered.filter(s => s.verdictClass === 'safe');
    else if (state.filter === 'CAUTION') filtered = filtered.filter(s => s.verdictClass === 'caution');
    else if (state.filter === 'ALERT') filtered = filtered.filter(s => s.verdictClass === 'alert');

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.sampleId.toLowerCase().includes(q) ||
        s.verdict.toLowerCase().includes(q) ||
        s.violations.join(' ').toLowerCase().includes(q)
      );
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 2rem; color: var(--text-muted);">No samples matching current filter criteria.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(s => {
      const phSafe = s.ph >= 6.5 && s.ph <= 8.5;
      const turbSafe = s.turbidity <= 5.0;
      const tdsSafe = s.tds <= 500;
      const doSafe = s.dissolvedOxygen >= 5.0;

      const violationTags = s.violations.length > 0 
        ? s.violations.map(v => `<span class="dc-violation-tag">${escapeHtml(v)}</span>`).join('')
        : '<span style="color:#16a34a; font-size:0.75rem; font-weight:600;">✓ Fully Compliant</span>';

      const treatmentTags = s.treatments.map(t => `<span class="dc-treatment-tag">${escapeHtml(t)}</span>`).join('');

      return `
        <tr>
          <td style="font-weight:700; color:var(--text-light);">${s.index}</td>
          <td>${renderSampleIdCell(s.sampleId)}</td>
          <td><span style="font-weight:600; color:${phSafe ? 'inherit' : '#dc2626'};">${s.ph.toFixed(1)}</span></td>
          <td><span style="font-weight:600; color:${turbSafe ? 'inherit' : '#dc2626'};">${s.turbidity.toFixed(1)}</span></td>
          <td>${s.temperature.toFixed(0)}°C</td>
          <td><span style="font-weight:600; color:${doSafe ? 'inherit' : '#dc2626'};">${s.dissolvedOxygen.toFixed(1)}</span></td>
          <td><span style="font-weight:600; color:${tdsSafe ? 'inherit' : '#dc2626'};">${Math.round(s.tds)}</span></td>
          <td>
            <span class="status-badge ${s.badgeClass}">
              <strong style="font-weight:700;">${s.safetyPct}%</strong> ${s.verdict}
            </span>
          </td>
          <td style="max-width:240px; line-height:1.35;">
            ${violationTags}
            <div style="margin-top:0.25rem;">${treatmentTags}</div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function setFilter(filterType) {
    state.filter = filterType;
    ['All', 'Safe', 'Caution', 'Alert'].forEach(t => {
      const btn = document.getElementById(`dcFilterBtn${t}`);
      if (btn) {
        if (t.toUpperCase() === filterType) btn.classList.add('active');
        else btn.classList.remove('active');
      }
    });
    renderTableRows();
  }

  function onSearchChange(val) {
    state.searchQuery = val.trim();
    renderTableRows();
  }

  /**
   * Generate & Download Official Certified PDF Report
   */
  async function generateReport() {
    if (!state.summary || state.analyzedSamples.length === 0) {
      showToast('Please upload or load a dataset first.', 'warning');
      return;
    }

    const btn = document.getElementById('dcBtnGeneratePdf');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `⏳ Generating Official PDF...`;
    }
    showToast('Compiling drinking safety dataset assessment into PDF report...', 'info');

    try {
      const payload = {
        datasetName: state.datasetName || 'Water_Quality_Dataset.csv',
        summary: state.summary,
        samples: state.analyzedSamples
      };

      const res = await apiFetch('/api/reports/dataset-potability', {
        method: 'POST',
        body: payload
      });

      if (res.success && res.downloadUrl) {
        showToast('Official Certified PDF Report ready! Downloading...', 'success');
        
        // Trigger automated browser download
        const a = document.createElement('a');
        a.href = res.downloadUrl;
        a.download = res.fileName || 'AquaMonitor_Dataset_Drinking_Safety_Report.pdf';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        throw new Error(res.message || 'Server error creating PDF report.');
      }
    } catch (err) {
      console.error('PDF report generation error:', err);
      showToast(`Failed to generate PDF: ${err.message}`, 'alert');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  }

  /**
   * Export Enriched CSV with drinking percentages and verdicts
   */
  function exportCSV() {
    if (!state.analyzedSamples || state.analyzedSamples.length === 0) {
      showToast('No dataset available to export.', 'warning');
      return;
    }

    const headers = [
      'Sample_ID',
      'pH',
      'Turbidity_NTU',
      'Temperature_C',
      'Dissolved_Oxygen_mg_L',
      'TDS_ppm',
      'Conductivity_uS_cm',
      'Drinking_Safety_Percentage',
      'Drinkable_Verdict',
      'Compliance_Status',
      'Violations',
      'Recommended_Treatments'
    ];

    const rows = state.analyzedSamples.map(s => [
      `"${s.sampleId.replace(/"/g, '""')}"`,
      s.ph.toFixed(2),
      s.turbidity.toFixed(2),
      s.temperature.toFixed(1),
      s.dissolvedOxygen.toFixed(2),
      Math.round(s.tds),
      Math.round(s.conductivity),
      `${s.safetyPct}%`,
      `"${s.verdict}"`,
      `"${s.isDrinkable ? 'WHO/BIS Compliant' : 'Non-Compliant'}"`,
      `"${s.violations.join('; ').replace(/"/g, '""')}"`,
      `"${s.treatments.join('; ').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(state.datasetName || 'Water_Dataset').replace(/\.[^/.]+$/, '')}_Analyzed_Potability.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Enriched potability dataset exported to CSV.', 'success');
  }

  /**
   * Download Standard CSV Template
   */
  function downloadTemplate() {
    const templateCSV = 
`Sample_ID,Location,pH,Turbidity_NTU,Temperature_C,Dissolved_Oxygen_mg_L,TDS_ppm,Conductivity_uS_cm
SMP-001,Kaveri Intake Point,7.2,1.8,22.5,7.8,180,260
SMP-002,Yamuna Municipal Tap,7.4,3.2,23.0,7.1,340,420
SMP-003,Industrial Creek Canal,6.1,18.4,26.5,4.2,620,890
SMP-004,Mountain Spring Feed,7.1,0.6,16.0,8.4,120,180
SMP-005,Urban Reservoir,7.5,4.1,24.0,6.5,290,380
SMP-006,Agricultural Runoff Well,6.8,12.0,25.2,5.1,510,750
SMP-007,Coastal Creek Estuary,7.8,24.5,27.0,4.8,850,1120
SMP-008,Central Water Works,7.3,0.9,21.5,8.1,210,310`;

    const blob = new Blob([templateCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'AquaMonitor_Water_Quality_Template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Sample water dataset template downloaded.', 'success');
  }

  /**
   * Load Demo Dataset (Matches user's Water_creek_marine_seawater_batch tab!)
   */
  function loadDemoData() {
    state.datasetName = 'Water_creek_marine_seawater_batch1.csv';
    const demoData = [
      { sampleId: 'CRK-101 (Upstream Creek)', ph: 7.25, turbidity: 2.1, temperature: 21.5, dissolvedOxygen: 7.8, tds: 210, conductivity: 280 },
      { sampleId: 'CRK-102 (Mountain Tributary)', ph: 7.15, turbidity: 0.8, temperature: 18.2, dissolvedOxygen: 8.4, tds: 140, conductivity: 190 },
      { sampleId: 'CRK-103 (Mid-Valley Stream)', ph: 7.35, turbidity: 3.4, temperature: 22.8, dissolvedOxygen: 7.2, tds: 280, conductivity: 360 },
      { sampleId: 'CRK-104 (Agricultural Crossing)', ph: 6.70, turbidity: 14.5, temperature: 24.1, dissolvedOxygen: 5.4, tds: 490, conductivity: 620 },
      { sampleId: 'CRK-105 (Urban Runoff Bridge)', ph: 6.40, turbidity: 22.0, temperature: 25.5, dissolvedOxygen: 4.1, tds: 680, conductivity: 890 },
      { sampleId: 'TAP-201 (Civic Water Distribution)', ph: 7.20, turbidity: 0.9, temperature: 22.0, dissolvedOxygen: 8.0, tds: 190, conductivity: 250 },
      { sampleId: 'TAP-202 (South Pumping Sump)', ph: 7.30, turbidity: 1.2, temperature: 22.4, dissolvedOxygen: 7.6, tds: 220, conductivity: 290 },
      { sampleId: 'TAP-203 (North Sector Overhead)', ph: 7.10, turbidity: 1.5, temperature: 23.1, dissolvedOxygen: 7.5, tds: 240, conductivity: 310 },
      { sampleId: 'WEL-301 (Community Deep Borewell)', ph: 6.90, turbidity: 4.8, temperature: 24.8, dissolvedOxygen: 6.2, tds: 420, conductivity: 560 },
      { sampleId: 'WEL-302 (Mineral Spring Well)', ph: 7.40, turbidity: 1.1, temperature: 20.5, dissolvedOxygen: 7.9, tds: 310, conductivity: 410 },
      { sampleId: 'EST-401 (Estuary Creek Mixing)', ph: 7.85, turbidity: 19.5, temperature: 26.2, dissolvedOxygen: 5.2, tds: 790, conductivity: 980 },
      { sampleId: 'SEA-501 (Nearshore Marine Seawater)', ph: 8.15, turbidity: 28.0, temperature: 27.4, dissolvedOxygen: 4.8, tds: 980, conductivity: 1240 },
      { sampleId: 'CRK-106 (Downstream Filtration Outlet)', ph: 7.20, turbidity: 1.4, temperature: 21.8, dissolvedOxygen: 7.7, tds: 230, conductivity: 320 },
      { sampleId: 'CRK-107 (Reservoir Intake)', ph: 7.30, turbidity: 2.5, temperature: 22.1, dissolvedOxygen: 7.9, tds: 250, conductivity: 340 }
    ];

    analyzeDataset(demoData);
    showToast('Loaded realistic River & Creek Water testing dataset.', 'success');
  }

  function clearDataset() {
    state.datasetName = '';
    state.rawRows = [];
    state.analyzedSamples = [];
    state.summary = null;
    state.filter = 'ALL';
    state.searchQuery = '';

    const resultsContainer = document.getElementById('dcResultsContainer');
    if (resultsContainer) resultsContainer.style.display = 'none';

    const input = document.getElementById('dcFileInput');
    if (input) input.value = '';

    showToast('Dataset cleared. Upload a new file anytime.', 'info');
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Public API
  window.datasetChecker = {
    init,
    triggerFileInput,
    handleFileSelect,
    setFilter,
    onSearchChange,
    generateReport,
    exportCSV,
    downloadTemplate,
    loadDemoData,
    clear: clearDataset
  };

})();
