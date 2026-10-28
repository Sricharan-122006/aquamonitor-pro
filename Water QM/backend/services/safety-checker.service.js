/**
 * Safety Checker Service - Real Postal PIN Code Lookup & Segregated Demo Data
 * 
 * Strict architectural rule:
 * Real postal location data is fetched directly from the Indian Postal PIN API.
 * Water quality readings, sample counts, histories, and laboratories are
 * strictly simulated demonstration data and marked with dataSource: "DEMO".
 */

const https = require('https');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DEMO_BOOKINGS_FILE = path.join(DATA_DIR, 'demo_bookings.json');

// Ensure demo bookings storage file exists
function loadDemoBookings() {
  try {
    if (fs.existsSync(DEMO_BOOKINGS_FILE)) {
      return JSON.parse(fs.readFileSync(DEMO_BOOKINGS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading demo_bookings.json:', err.message);
  }
  return [];
}

function saveDemoBookings(bookings) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DEMO_BOOKINGS_FILE, JSON.stringify(bookings, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving demo_bookings.json:', err.message);
  }
}

/**
 * 1. Fetch Real Postal Location Data from India Post PIN API
 */
async function lookupPostalPincode(pincode, retryCount = 1) {
  const pin = String(pincode || '').trim();

  if (!/^\d{6}$/.test(pin)) {
    const error = new Error('Please enter a valid six-digit PIN code.');
    error.statusCode = 400;
    throw error;
  }

  const url = `https://api.postalpincode.in/pincode/${pin}`;

  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      const responseData = await new Promise((resolve, reject) => {
        const options = {
          timeout: 8000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AquaMonitorPro/2.0',
            'Accept': 'application/json, text/plain, */*'
          }
        };

        const req = https.get(url, options, (res) => {
          let rawData = '';
          res.on('data', chunk => { rawData += chunk; });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(rawData);
              resolve(parsed);
            } catch (e) {
              reject(new Error('Unexpected postal API response format'));
            }
          });
        });

        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Postal API request timed out'));
        });

        req.on('error', (err) => {
          reject(err);
        });
      });

      if (!Array.isArray(responseData) || responseData.length === 0) {
        const error = new Error('We could not verify this PIN code right now. Please try again.');
        error.statusCode = 502;
        throw error;
      }

      const result = responseData[0];

      if (result.Status !== 'Success' || !Array.isArray(result.PostOffice) || result.PostOffice.length === 0) {
        const error = new Error('We could not find a postal location for this PIN code. Please check and try again.');
        error.statusCode = 404;
        throw error;
      }

      // Extract real postal information only
      const postOffices = result.PostOffice.map(po => ({
        name: po.Name,
        branchType: po.BranchType || 'Sub Post Office',
        deliveryStatus: po.DeliveryStatus || 'Delivery',
        circle: po.Circle,
        district: po.District,
        division: po.Division,
        region: po.Region,
        block: po.Block,
        state: po.State,
        country: po.Country || 'India',
        pincode: po.Pincode || pin
      }));

      const primaryPO = postOffices[0];

      return {
        pincode: pin,
        state: primaryPO.state,
        district: primaryPO.district,
        postOffices,
        totalOffices: postOffices.length,
        dataSource: 'INDIA_POST_LIVE_API',
        isVerifiedPostalLocation: true
      };
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 400) {
        throw err;
      }
      if (attempt < retryCount) {
        await new Promise(r => setTimeout(r, 400));
        continue;
      }
      console.error(`Postal lookup failed for PIN ${pin}:`, err.message);
      const error = new Error('We could not verify this PIN code right now. Please try again.');
      error.statusCode = 502;
      throw error;
    }
  }
}

/**
 * 2. Get Demonstration Water Quality Dashboard Data
 * Strictly marked with dataSource: "DEMO"
 */
function getDemoWaterQualityData(pincode, selectedPostOffice = '') {
  const pin = String(pincode || '509001').trim();
  const poName = selectedPostOffice || 'Local Area';

  return {
    disclaimer: 'DEMO DATA — NOT A REAL WATER SAFETY ASSESSMENT. The following water-quality information is simulated for demonstration purposes only.',
    pincode: pin,
    selectedLocality: poName,
    dataSource: 'DEMO',
    
    // Overview Metric Cards
    overview: {
      dataSource: 'DEMO',
      demonstrationStatus: 'Safe',
      statusLabel: '92% Safe to Drink',
      drinkingSafetyPercentage: 92,
      statusDescription: 'Based on sample demo data',
      sampleCount: 5,
      lastSampleTested: '12 Aug 2024',
      parameters: {
        ph: {
          value: 7.2,
          unit: '',
          safeRange: '6.5 – 8.5',
          status: 'Normal',
          badgeClass: 'badge-safe'
        },
        tds: {
          value: 420,
          unit: 'mg/L',
          safeRange: '0 – 500',
          status: 'Normal',
          badgeClass: 'badge-safe'
        },
        temperature: {
          value: 24.5,
          unit: '°C',
          safeRange: '10 – 25',
          status: 'Normal',
          badgeClass: 'badge-safe'
        },
        turbidity: {
          value: 1.8,
          unit: 'NTU',
          safeRange: '0 – 5',
          status: 'Normal',
          badgeClass: 'badge-safe'
        }
      }
    },

    // Testing History (Demo Records)
    history: [
      {
        id: 1,
        sampleId: 'SMP-2024-0812',
        sampleDate: '12 Aug 2024',
        sourceStation: `${poName} PH`,
        ph: 7.2,
        tds: 420,
        temp: 24.5,
        turbidity: 1.8,
        status: '94% Safe to Drink',
        badgeClass: 'badge-safe',
        dataSource: 'DEMO'
      },
      {
        id: 2,
        sampleId: 'SMP-2024-0510',
        sampleDate: '10 May 2024',
        sourceStation: 'Public Tap',
        ph: 7.4,
        tds: 380,
        temp: 23.8,
        turbidity: 2.1,
        status: '96% Safe to Drink',
        badgeClass: 'badge-safe',
        dataSource: 'DEMO'
      },
      {
        id: 3,
        sampleId: 'SMP-2024-0215',
        sampleDate: '15 Feb 2024',
        sourceStation: 'Borewell 1',
        ph: 6.8,
        tds: 520,
        temp: 25.1,
        turbidity: 3.5,
        status: '74% Boil/Filter',
        badgeClass: 'badge-caution',
        dataSource: 'DEMO'
      },
      {
        id: 4,
        sampleId: 'SMP-2023-1120',
        sampleDate: '20 Nov 2023',
        sourceStation: 'Community Well',
        ph: 7.1,
        tds: 410,
        temp: 24.0,
        turbidity: 2.0,
        status: '93% Safe to Drink',
        badgeClass: 'badge-safe',
        dataSource: 'DEMO'
      }
    ],

    // pH Trend Graph Points (Nov 23, Feb 24, May 24, Aug 24)
    trendData: [
      { label: 'Nov 23', ph: 7.1 },
      { label: 'Feb 24', ph: 6.8 },
      { label: 'May 24', ph: 7.4 },
      { label: 'Aug 24', ph: 7.2 }
    ],

    // Nearby Laboratories (Demo Listings)
    laboratories: [
      {
        id: 'LAB-001',
        name: 'Mahabubnagar Govt. Lab',
        type: 'Government Laboratory',
        typeIcon: '🏛️',
        distance: '12 km (approx.)',
        distanceNote: 'Simulated demo distance',
        isDemo: true,
        dataSource: 'DEMO',
        address: 'District Water Testing Centre, Station Road, Mahabubnagar',
        accreditation: 'State Public Health Division (Demo)',
        parameters: ['pH', 'TDS', 'Bacteria', 'Chemical'],
        turnaroundTime: '24-48 Hours',
        description: 'Demonstration profile of a district-level government water testing facility equipped for bacteriological and physico-chemical evaluation.'
      },
      {
        id: 'LAB-002',
        name: 'Sri Sai Water Testing Lab',
        type: 'Private Laboratory',
        typeIcon: '🏢',
        distance: '18 km (approx.)',
        distanceNote: 'Simulated demo distance',
        isDemo: true,
        dataSource: 'DEMO',
        address: 'Near Old Bus Stand, Market Area, Mahabubnagar',
        accreditation: 'Certified Environmental Testing (Demo)',
        parameters: ['pH', 'TDS', 'Heavy Metals'],
        turnaroundTime: '12-24 Hours',
        description: 'Demonstration profile of an environmental laboratory offering advanced multi-element heavy metal spectrometry and drinking water potability checks.'
      },
      {
        id: 'LAB-003',
        name: 'Telangana Enviro Lab',
        type: 'NABL Accredited (Demo)',
        typeIcon: '📜',
        distance: '25 km (approx.)',
        distanceNote: 'Simulated demo distance',
        isDemo: true,
        dataSource: 'DEMO',
        address: 'Industrial Development Area, Phase 2, Jadcherla - Mahabubnagar Highway',
        accreditation: 'NABL ISO/IEC 17025 Compliant (Demo Simulation)',
        parameters: ['pH', 'TDS', 'Bacteria', 'Chemical'],
        turnaroundTime: '24 Hours',
        description: 'Demonstration listing for an accredited environmental testing lab providing comprehensive IS 10500 compliance testing for municipal & groundwater.'
      }
    ]
  };
}

/**
 * 3. Handle Demo Booking of Water Test
 * Segregated in demo_bookings.json so real data is never corrupted
 */
function createDemoBooking(payload) {
  const {
    fullName,
    phone,
    pincode,
    postalLocation,
    waterSource,
    preferredDate,
    testingType,
    labId,
    labName,
    notes
  } = payload;

  if (!fullName || !fullName.trim()) {
    const error = new Error('Please enter your full name.');
    error.statusCode = 400;
    throw error;
  }

  const cleanPhone = String(phone || '').replace(/\D/g, '');
  if (cleanPhone.length < 10) {
    const error = new Error('Please enter a valid 10-digit phone number.');
    error.statusCode = 400;
    throw error;
  }

  if (!pincode || !/^\d{6}$/.test(String(pincode).trim())) {
    const error = new Error('Please provide a valid 6-digit PIN code.');
    error.statusCode = 400;
    throw error;
  }

  if (!waterSource || !waterSource.trim()) {
    const error = new Error('Please select a water source type.');
    error.statusCode = 400;
    throw error;
  }

  if (!preferredDate) {
    const error = new Error('Please select a preferred testing date.');
    error.statusCode = 400;
    throw error;
  }

  const referenceCode = `DEMO-BK-${Math.floor(100000 + Math.random() * 900000)}`;

  const demoBooking = {
    id: crypto.randomUUID(),
    bookingReference: referenceCode,
    isDemo: true,
    dataSource: 'DEMO',
    fullName: fullName.trim(),
    phone: cleanPhone,
    pincode: String(pincode).trim(),
    postalLocation: postalLocation || 'Verified Postal Area',
    waterSource: waterSource.trim(),
    preferredDate,
    testingType: testingType || 'Comprehensive Drinking Water Test',
    labId: labId || 'LAB-001',
    labName: labName || 'Mahabubnagar Govt. Lab',
    notes: (notes || '').trim(),
    createdAt: new Date().toISOString(),
    demoNotice: 'Demo booking only. No real laboratory appointment has been created.'
  };

  const bookings = loadDemoBookings();
  bookings.unshift(demoBooking);
  saveDemoBookings(bookings.slice(0, 100)); // Keep latest 100 demo records

  return demoBooking;
}

module.exports = {
  lookupPostalPincode,
  getDemoWaterQualityData,
  createDemoBooking
};
