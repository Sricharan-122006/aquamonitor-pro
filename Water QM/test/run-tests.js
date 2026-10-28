/**
 * AquaMonitor Pro - Comprehensive Automated Test Suite
 * Validating Authentication, Role-based Access, Reading CRUD,
 * Analytics, Alerts, Reports, Payments, and User Administration.
 */

const assert = require('assert');
const http = require('http');
const app = require('../server');
const seedInitialData = require('../backend/services/seed.service');

let server;
const PORT = 5099;
const BASE_URL = `http://localhost:${PORT}`;

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const fetchOptions = {
    method: options.method || 'GET',
    headers
  };

  if (options.body) {
    fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  const res = await fetch(url, fetchOptions);
  let json = null;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = { raw: text };
  }

  return {
    status: res.status,
    data: json,
    headers: res.headers
  };
}

async function runAllTests() {
  console.log('===============================================================');
  console.log('🧪 Starting AquaMonitor Pro Full Automated Test Suite');
  console.log('===============================================================');

  await seedInitialData();

  // Start test server instance
  server = app.listen(PORT);
  await new Promise(r => setTimeout(r, 1000));

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  let userToken = '';
  let adminToken = '';
  let testStationId = `ST_TEST_${Date.now().toString().slice(-4)}`;
  let testUserId = '';
  let testContactId = '';
  let testOrderId = '';

  // 1. Health check
  await test('Server Health Check (/api/health)', async () => {
    const res = await request('/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'healthy');
  });

  // 2. User Registration & Validation
  await test('User Registration: Rejects empty name', async () => {
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: { name: '', email: 'test@example.com', phone: '1234567890', password: 'password123' }
    });
    assert.strictEqual(res.status, 400);
  });

  await test('User Registration: Rejects password < 6 chars', async () => {
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: { name: 'Alice', email: 'alice@example.com', phone: '1234567890', password: '123' }
    });
    assert.strictEqual(res.status, 400);
  });

  await test('User Registration: Successful account creation', async () => {
    const testEmail = `user_${Date.now()}@example.com`;
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Test Citizen',
        email: testEmail,
        phone: '+91 91234 56789',
        organization: 'EcoWatch',
        password: 'ValidPassword@123'
      }
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.token);
    assert.strictEqual(res.data.user.role, 'USER');
    assert.strictEqual(res.data.user.plan, 'FREE');
    userToken = res.data.token;
    testUserId = res.data.user.id;
  });

  // 3. User Login & Admin Login
  await test('User Login: Rejects invalid password', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'secretowars007@gmail.com', password: 'WrongPassword' }
    });
    assert.strictEqual(res.status, 401);
  });

  await test('Admin Login: Authenticates seed Admin credentials', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@aquamonitor.in', password: 'Admin@123', loginType: 'ADMIN' }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.user.role, 'ADMIN');
    adminToken = res.data.token;
  });

  await test('Admin Login: Blocks normal user from Admin tab login', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'secretowars007@gmail.com', password: 'User@123', loginType: 'ADMIN' }
    });
    assert.strictEqual(res.status, 403);
  });

  // 4. Role Authorization: Reading & Station Security
  await test('Security: Regular user CANNOT add reading (POST /api/readings)', async () => {
    const res = await request('/api/readings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        stationId: testStationId,
        stationName: 'Unauthorized River',
        ph: 7.2,
        turbidity: 20,
        temperature: 24,
        dissolvedOxygen: 8.0,
        tds: 200
      }
    });
    assert.strictEqual(res.status, 403);
  });

  await test('Security: Unauthenticated request CANNOT add reading', async () => {
    const res = await request('/api/readings', {
      method: 'POST',
      body: { stationId: 'ST_NOAUTH', stationName: 'River', ph: 7 }
    });
    assert.strictEqual(res.status, 401);
  });

  // 5. Admin Reading & Station CRUD
  await test('Admin: Create Station & Add Reading (POST /api/readings)', async () => {
    const res = await request('/api/readings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        stationId: testStationId,
        stationName: 'Beas River',
        locationName: 'Manali, Himachal Pradesh',
        latitude: 32.24,
        longitude: 77.18,
        ph: 7.4,
        turbidity: 18,
        temperature: 15,
        dissolvedOxygen: 9.2,
        tds: 140,
        conductivity: 210
      }
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.reading.stationName, 'Beas River');
    assert.ok(res.data.wqi >= 80);
  });

  await test('Station Listing: New station appears in GET /api/stations', async () => {
    const res = await request('/api/stations');
    assert.strictEqual(res.status, 200);
    const found = res.data.data.find(s => s.stationId === testStationId);
    assert.ok(found, 'Newly created station should be present in station list');
    assert.strictEqual(found.name, 'Beas River');
  });

  await test('Admin: Edit Station Reading (PUT /api/stations/:id)', async () => {
    const res = await request(`/api/stations/${testStationId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        ph: 8.1,
        turbidity: 25,
        tds: 190
      }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.latestReading.ph, 8.1);
  });

  // 6. Analytics & Filters
  await test('Analytics: Fetches multi-parameter telemetry (/api/analytics)', async () => {
    const res = await request('/api/analytics?river=ALL&range=7d');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data.labels));
    assert.ok(res.data.distribution);
  });

  await test('Analytics: Filter by specific river (/api/analytics?river=Kaveri)', async () => {
    const res = await request('/api/analytics?river=Kaveri&range=30d');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.selectedRiver, 'Kaveri');
    assert.strictEqual(res.data.selectedRange, '30d');
  });

  await test('AI Prediction: Potability calculation & 7-day forecast (/api/analytics/predict)', async () => {
    const res = await request('/api/analytics/predict?stationName=Kaveri');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.aiEvaluation.classification);
    assert.ok(Array.isArray(res.data.sevenDayForecast));
    assert.strictEqual(res.data.sevenDayForecast.length, 7);
  });

  // 7. Alert Center & Thresholds
  await test('Alerts: Fetch all alerts (/api/alerts)', async () => {
    const res = await request('/api/alerts');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.total >= 10);
    assert.ok(res.data.summary.critical >= 1);
  });

  await test('Admin: Update Alert Thresholds (/api/alerts/thresholds)', async () => {
    const res = await request('/api/alerts/thresholds', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        phMin: 6.8,
        phMax: 8.2,
        turbidityMin: 0,
        turbidityMax: 80,
        tdsMin: 0,
        tdsMax: 450,
        doMin: 5.5,
        doMax: 12.0
      }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.phMin, 6.8);
  });

  // 8. Reports & Subscription Gating
  await test('Reports: Free user can generate Daily Report (/api/reports/generate)', async () => {
    const res = await request('/api/reports/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { type: 'Daily' }
    });
    assert.strictEqual(res.status, 201);
    assert.ok(res.data.downloadUrl);
  });

  await test('Security: Free user BLOCKED from generating Weekly Report', async () => {
    const res = await request('/api/reports/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { type: 'Weekly' }
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.upgradeRequired, true);
  });

  // 9. Premium Plans & Razorpay Workflow
  await test('Payment: Initiate Razorpay Order (/api/subscriptions/create-order)', async () => {
    const res = await request('/api/subscriptions/create-order', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { plan: 'Pro', amount: 499 }
    });
    assert.strictEqual(res.status, 201);
    assert.ok(res.data.orderId);
    testOrderId = res.data.orderId;
  });

  await test('Payment: Verify transaction and upgrade account to PRO (/api/subscriptions/verify-payment)', async () => {
    const res = await request('/api/subscriptions/verify-payment', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        orderId: testOrderId,
        paymentId: 'pay_TEST_SUCCESS_123',
        plan: 'PRO'
      }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.plan, 'PRO');
    assert.strictEqual(res.data.subscription.status, 'paid');
  });

  await test('Reports: Upgraded Pro user CAN now generate Weekly Report', async () => {
    const res = await request('/api/reports/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { type: 'Weekly' }
    });
    assert.strictEqual(res.status, 201);
    assert.ok(res.data.downloadUrl);
  });

  // 10. Contact Us & Admin Inbox
  await test('Contact: Submit message (/api/contact)', async () => {
    const res = await request('/api/contact', {
      method: 'POST',
      body: {
        name: 'Zameer',
        email: 'zameer@example.com',
        subject: 'Query',
        message: 'Could you please verify sensor calibration at Saraswati station?'
      }
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.data.read, false);
    testContactId = res.data.data._id || res.data.data.id;
  });

  await test('Admin: Contact inbox lists message as unread (/api/contact)', async () => {
    const res = await request('/api/contact', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);
    const msg = res.data.messages.find(m => (m._id || m.id) === testContactId);
    assert.ok(msg, 'Submitted message should be in admin inbox');
    assert.strictEqual(msg.read, false);
  });

  await test('Admin: Mark message as read (/api/contact/:id/read)', async () => {
    const res = await request(`/api/contact/${testContactId}/read`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.messageData.read, true);
  });

  // 11. Admin User Management & Role Promotion
  await test('Admin: User list retrieval (/api/users)', async () => {
    const res = await request('/api/users', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.users.length >= 8);
  });

  await test('Admin: Promote user to Administrator (/api/users/:id/make-admin)', async () => {
    const res = await request(`/api/users/${testUserId}/make-admin`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.user.role, 'ADMIN');
  });

  await test('Clean up: Admin delete test station', async () => {
    const res = await request(`/api/stations/${testStationId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);
  });

  // 12. Hardware Simulation Lab Route & Static Assets Verification
  await test('Hardware Lab: Direct route access (/hardware-lab)', async () => {
    const res = await request('/hardware-lab');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.raw.includes('view-hardware-lab'));
    assert.ok(res.data.raw.includes('hardwareLabCanvasContainer'));
    assert.ok(res.data.raw.includes('JalSaathi Hardware Simulation Lab'));
  });

  await test('Hardware Lab: Static 3D Engine script served (/js/hardware-lab.js)', async () => {
    const res = await request('/js/hardware-lab.js');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.raw.includes('initHardwareLab'));
    assert.ok(res.data.raw.includes('ESP-WROOM-32'));
  });

  await test('Hardware Lab: Stylesheet served (/css/hardware-lab.css)', async () => {
    const res = await request('/css/hardware-lab.css');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.raw.includes('.hardware-lab-container'));
  });

  await test('Hardware Lab: Three.js and OrbitControls modules served locally', async () => {
    const res1 = await request('/js/vendor/three.module.js');
    assert.strictEqual(res1.status, 200);
    const res2 = await request('/js/vendor/OrbitControls.js');
    assert.strictEqual(res2.status, 200);
  });

  // 13. Safety Checker Route, API & Demo Integration Verification
  await test('Safety Checker: Direct route access (/safety-checker)', async () => {
    const res = await request('/safety-checker');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.raw.includes('view-safety-checker'));
    assert.ok(res.data.raw.includes('Safety Checker'));
    assert.ok(res.data.raw.includes('scPinInput'));
    assert.ok(res.data.raw.includes('DEMO DATA — NOT A REAL WATER SAFETY ASSESSMENT'));
  });

  await test('Safety Checker: Static engine script served (/js/safety-checker.js)', async () => {
    const res = await request('/js/safety-checker.js');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.raw.includes('window.safetyChecker'));
    assert.ok(res.data.raw.includes('performLookup'));
  });

  await test('Safety Checker: Stylesheet served (/css/safety-checker.css)', async () => {
    const res = await request('/css/safety-checker.css');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.raw.includes('.safety-checker-container'));
  });

  await test('Safety Checker: Valid 6-digit postal PIN lookup (/api/safety-checker/lookup/509001)', async () => {
    const res = await request('/api/safety-checker/lookup/509001');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.pincode, '509001');
    assert.strictEqual(res.data.data.state, 'Telangana');
    assert.ok(res.data.data.postOffices && res.data.data.postOffices.length > 0);
    assert.strictEqual(res.data.data.dataSource, 'INDIA_POST_LIVE_API');
  });

  await test('Safety Checker: Reject invalid PIN format (/api/safety-checker/lookup/123)', async () => {
    const res = await request('/api/safety-checker/lookup/123');
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);
    assert.strictEqual(res.data.message, 'Please enter a valid six-digit PIN code.');
  });

  await test('Safety Checker: Reject non-existent postal PIN (/api/safety-checker/lookup/999999)', async () => {
    const res = await request('/api/safety-checker/lookup/999999');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.data.success, false);
    assert.strictEqual(res.data.message, 'We could not find a postal location for this PIN code. Please check and try again.');
  });

  await test('Safety Checker: Fetch demonstration dashboard data (/api/safety-checker/data/509001)', async () => {
    const res = await request('/api/safety-checker/data/509001');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.dataSource, 'DEMO');
    assert.strictEqual(res.data.data.overview.demonstrationStatus, 'Safe');
    assert.strictEqual(res.data.data.history.length, 4);
    assert.strictEqual(res.data.data.laboratories.length, 3);
  });

  await test('Safety Checker: Submit demo test booking (POST /api/safety-checker/book)', async () => {
    const res = await request('/api/safety-checker/book', {
      method: 'POST',
      body: {
        fullName: 'Zameer Ahmed',
        phone: '9876543210',
        pincode: '509001',
        postalLocation: 'Amistapur, Mahabubnagar, Telangana',
        waterSource: 'Borewell Water',
        preferredDate: '2026-11-10',
        notes: 'Testing for TDS and heavy metals'
      }
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.booking.isDemo, true);
    assert.strictEqual(res.data.booking.dataSource, 'DEMO');
    assert.ok(res.data.booking.bookingReference.startsWith('DEMO-BK-'));
    assert.ok(res.data.confirmationNotice.includes('Demo booking only. No real laboratory appointment has been created.'));
  });

  await test('Safety Checker: Validate required phone on booking (POST /api/safety-checker/book)', async () => {
    const res = await request('/api/safety-checker/book', {
      method: 'POST',
      body: {
        fullName: 'Zameer Ahmed',
        phone: '123',
        pincode: '509001',
        waterSource: 'Tap',
        preferredDate: '2026-11-10'
      }
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);
    assert.strictEqual(res.data.message, 'Please enter a valid 10-digit phone number.');
  });

  // ===============================================================
  // COMMUNITY WATER ISSUE TRACKING & COMPLAINT TESTS
  // ===============================================================
  let createdTrackingId = '';
  let createdIssueRef = '';
  let createdIssueId = '';

  await test('Complaint: Validate required fields on submission', async () => {
    const res = await request('/api/complaints', {
      method: 'POST',
      body: { submitterName: '', submitterEmail: 'bad-email', submitterPhone: '' }
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);
  });

  await test('Complaint: Successfully submit citizen complaint with tracking ID generation', async () => {
    const res = await request('/api/complaints', {
      method: 'POST',
      body: {
        submitterName: 'Priya Sharma',
        submitterEmail: 'priya.sharma@example.com',
        submitterPhone: '+91 98765 11111',
        category: 'Pipeline Leakage',
        locality: 'Model Town',
        landmark: 'Opposite Community Hall',
        pincode: '141002',
        description: 'Underground pipeline rupture leaking continuous clean water onto street.'
      }
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.trackingId.startsWith('CMP-'));
    createdTrackingId = res.data.trackingId;
  });

  await test('Complaint: Public tracking by tracking ID (privacy protected)', async () => {
    const res = await request(`/api/complaints/track/${createdTrackingId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.trackingId, createdTrackingId);
    assert.strictEqual(res.data.data.locality, 'Model Town');
    assert.strictEqual(res.data.data.status, 'Submitted');
    // Verify privacy: Submitter phone and email MUST NOT be exposed in public tracker
    assert.strictEqual(res.data.data.submitterPhone, undefined);
    assert.strictEqual(res.data.data.submitterEmail, undefined);
  });

  await test('Security: Regular user CANNOT access admin community issues endpoints', async () => {
    // Login as fresh regular citizen user (role: USER)
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'secretowars007@gmail.com', password: 'User@123' }
    });
    const regularToken = loginRes.data.token;

    const res = await request('/api/community-issues/overview', {
      headers: { Authorization: `Bearer ${regularToken}` }
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.success, false);
  });

  await test('Security: Unauthenticated request CANNOT access community issues', async () => {
    const res = await request('/api/community-issues');
    assert.strictEqual(res.status, 401);
  });

  await test('Community Issues: Fetch live overview statistics (Admin)', async () => {
    const res = await request('/api/community-issues/overview', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(typeof res.data.stats.totalIssues === 'number');
    assert.ok(res.data.stats.totalIssues >= 2);
    assert.ok(typeof res.data.stats.underInvestigation === 'number');
    assert.ok(typeof res.data.stats.actionInProgress === 'number');
    assert.ok(res.data.stats.thresholds.inactivityHours === 48);
  });

  await test('Community Issues: List issues with search and filtering (Admin)', async () => {
    const res = await request('/api/community-issues?locality=Model Town', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.issues.length >= 1);
    assert.strictEqual(res.data.issues[0].locality, 'Model Town');
  });

  await test('Community Issues: Create new community issue and link initial complaint (Admin)', async () => {
    const res = await request('/api/community-issues', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        title: 'Model Town Water Main Rupture',
        category: 'Pipeline Leakage',
        locality: 'Model Town',
        locationDetails: 'Sector 4 Community Hall area',
        description: 'Cluster of pipeline breakages causing localized flooding and pressure collapse.',
        priority: 'High',
        assignedTeam: 'Field Rapid Response Team',
        initialNote: 'Ground inspection scheduled for 10:00 AM.',
        initialComplaintIds: [createdTrackingId]
      }
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.issue.issueRef.startsWith('ISS-'));
    createdIssueRef = res.data.issue.issueRef;
    createdIssueId = res.data.issue._id;
    assert.strictEqual(res.data.issue.linkedCount, 1);
    assert.strictEqual(res.data.issue.assignedTeam, 'Field Rapid Response Team');
  });

  await test('Integrity: Verify linked complaint preserves individual tracking ID and records link audit', async () => {
    const res = await request(`/api/complaints/track/${createdTrackingId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.trackingId, createdTrackingId);
    assert.ok(res.data.data.communityIssue !== null);
    assert.strictEqual(res.data.data.communityIssue.issueRef, createdIssueRef);
  });

  await test('Duplicate Detection: Suggest matching complaints based on signals', async () => {
    const res = await request(`/api/community-issues/suggestions?issueId=${createdIssueId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.suggestions));
    // Each suggestion must contain explainable reasons and confidence
    if (res.data.suggestions.length > 0) {
      assert.ok(res.data.suggestions[0].reasons.length > 0);
      assert.ok(['High', 'Medium', 'Low'].includes(res.data.suggestions[0].confidence));
    }
  });

  await test('Community Issues: Link additional complaint and prevent duplicate linking', async () => {
    // 1. Link CMP-1072
    const linkRes = await request(`/api/community-issues/${createdIssueId}/link-complaints`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { complaintIds: ['CMP-1072'] }
    });
    assert.strictEqual(linkRes.status, 200);
    assert.strictEqual(linkRes.data.success, true);
    assert.strictEqual(linkRes.data.issue.linkedCount, 2);

    // 2. Attempt duplicate link of same complaint (MUST be rejected)
    const dupRes = await request(`/api/community-issues/${createdIssueId}/link-complaints`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { complaintIds: ['CMP-1072'] }
    });
    assert.strictEqual(dupRes.status, 400);
    assert.strictEqual(dupRes.data.success, false);
    assert.ok(dupRes.data.message.includes('already linked'));
  });

  await test('Community Issues: Unlink complaint with mandatory reason and preserve standalone record', async () => {
    // 1. Missing reason must be rejected
    const failRes = await request(`/api/community-issues/${createdIssueId}/unlink-complaint`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { complaintId: 'CMP-1072', reason: '' }
    });
    assert.strictEqual(failRes.status, 400);

    // 2. Valid unlink with reason
    const okRes = await request(`/api/community-issues/${createdIssueId}/unlink-complaint`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        complaintId: 'CMP-1072',
        reason: 'Investigated and determined to be isolated internal building plumbing issue, unrelated to main water conduit.'
      }
    });
    assert.strictEqual(okRes.status, 200);
    assert.strictEqual(okRes.data.success, true);
    assert.strictEqual(okRes.data.issue.linkedCount, 1);

    // 3. Verify complaint CMP-1072 retained its independent tracking and has audit log
    const compRes = await request('/api/complaints/track/CMP-1072');
    assert.strictEqual(compRes.status, 200);
    assert.strictEqual(compRes.data.data.communityIssue, null);
    const unlinkedAudit = compRes.data.data.auditLog.find(a => a.action.includes('Unlinked'));
    assert.ok(unlinkedAudit !== undefined);
  });

  await test('Workflow: Status transitions and resolution requirement', async () => {
    // 1. Transition New -> Under Investigation
    const step1 = await request(`/api/community-issues/${createdIssueId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'Under Investigation' }
    });
    assert.strictEqual(step1.status, 200);
    assert.strictEqual(step1.data.issue.status, 'Under Investigation');

    // 2. Reject resolution without required resolution summary
    const step2Fail = await request(`/api/community-issues/${createdIssueId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'Resolved', resolutionSummary: '' }
    });
    assert.strictEqual(step2Fail.status, 400);

    // 3. Mark Resolved with valid summary
    const step2Ok = await request(`/api/community-issues/${createdIssueId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        status: 'Resolved',
        resolutionSummary: 'Main feeder conduit valve replaced and pressure tested at 4.2 bar. Full flow restored.'
      }
    });
    assert.strictEqual(step2Ok.status, 200);
    assert.strictEqual(step2Ok.data.issue.status, 'Resolved');

    // 4. Reopen issue requires reason
    const reopenFail = await request(`/api/community-issues/${createdIssueId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'Reopened', reopenReason: '' }
    });
    assert.strictEqual(reopenFail.status, 400);

    const reopenOk = await request(`/api/community-issues/${createdIssueId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        status: 'Reopened',
        reopenReason: 'Secondary micro-leak reported 15 meters downstream.'
      }
    });
    assert.strictEqual(reopenOk.status, 200);
    assert.strictEqual(reopenOk.data.issue.status, 'Reopened');
  });

  await test('Privacy: Internal notes are strictly staff-only and NOT visible in public tracking', async () => {
    // Add internal note
    const noteRes = await request(`/api/community-issues/${createdIssueId}/notes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { note: 'CONFIDENTIAL: Contractor penalized for negligence during trench excavation.' }
    });
    assert.strictEqual(noteRes.status, 201);

    // Verify public tracking DOES NOT show this internal note
    const trackRes = await request(`/api/complaints/track/${createdTrackingId}`);
    assert.strictEqual(trackRes.status, 200);
    const textTrack = JSON.stringify(trackRes.data);
    assert.ok(!textTrack.includes('CONFIDENTIAL: Contractor penalized'));
  });

  await test('Public Updates: Shared with affected complainants and visible in public tracking', async () => {
    // Add public update
    const pubRes = await request(`/api/community-issues/${createdIssueId}/public-updates`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { message: 'Repairs completed on main line. Secondary line flushing in progress.' }
    });
    assert.strictEqual(pubRes.status, 201);

    // Verify public tracking DOES display this published update
    const trackRes = await request(`/api/complaints/track/${createdTrackingId}`);
    assert.strictEqual(trackRes.status, 200);
    assert.ok(trackRes.data.data.communityIssue.publicUpdates.some(u => u.message.includes('Repairs completed on main line')));
  });

  await test('Notifications: Retrieve and manage real persisted notifications (Admin)', async () => {
    const res = await request('/api/community-issues/notifications', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.notifications));
    assert.ok(res.data.notifications.length > 0);

    const firstId = res.data.notifications[0]._id;
    const readRes = await request(`/api/community-issues/notifications/${firstId}/read`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(readRes.status, 200);
    assert.strictEqual(readRes.data.notification.read, true);
  });

  await test('Direct Route Access: Community Issues page works on direct load (/community-issues)', async () => {
    const res = await request('/community-issues');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.raw.includes('view-community-issues'));
    assert.ok(res.data.raw.includes('Issue Overview'));
  });

  await test('Direct Route Access: Citizen Complaints page works on direct load (/complaints)', async () => {
    const res = await request('/complaints');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.raw.includes('view-complaints'));
    assert.ok(res.data.raw.includes('Citizen Water Complaints'));
  });

  // 17. Dataset Potability & Drinking Safety Checker
  await test('Dataset Checker: Direct route access (/dataset-checker)', async () => {
    const res = await request('/dataset-checker');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.raw.includes('view-dataset-checker'));
    assert.ok(res.data.raw.includes('Water Dataset Potability'));
  });

  await test('Dataset Checker: Static engine script served (/js/dataset-checker.js)', async () => {
    const res = await request('/js/dataset-checker.js');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.raw.includes('datasetChecker'));
  });

  await test('Dataset Checker: Stylesheet served (/css/dataset-checker.css)', async () => {
    const res = await request('/css/dataset-checker.css');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.raw.includes('.dc-dropzone'));
  });

  await test('Dataset Checker: Generate Certified PDF Report (POST /api/reports/dataset-potability)', async () => {
    const payload = {
      datasetName: 'Water_creek_marine_seawater_batch1.csv',
      summary: {
        totalSamples: 3,
        overallDrinkingScore: 84,
        drinkableCount: 2,
        drinkablePercentage: 67,
        cautionCount: 1,
        cautionPercentage: 33,
        unsafeCount: 0,
        unsafePercentage: 0,
        overallVerdict: 'CONDITIONALLY DRINKABLE — TREATMENT REQUIRED',
        overallVerdictDesc: 'CAUTION: Sample contains elevated turbidity.'
      },
      samples: [
        { sampleId: 'CRK-101', ph: 7.2, turbidity: 1.8, temperature: 22, dissolvedOxygen: 7.8, tds: 210, safetyPct: 96, verdict: 'Safe to Drink' },
        { sampleId: 'CRK-102', ph: 7.4, turbidity: 3.2, temperature: 23, dissolvedOxygen: 7.1, tds: 240, safetyPct: 92, verdict: 'Safe to Drink' },
        { sampleId: 'CRK-103', ph: 6.8, turbidity: 14.5, temperature: 25, dissolvedOxygen: 5.4, tds: 490, safetyPct: 65, verdict: 'Boil & Filter Required' }
      ]
    };

    const res = await request('/api/reports/dataset-potability', {
      method: 'POST',
      body: payload
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.downloadUrl);
    assert.ok(res.data.downloadUrl.endsWith('.pdf'));
  });

  // Final summary
  console.log('===============================================================');
  console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('===============================================================');

  server.close();
  setTimeout(() => process.exit(failed > 0 ? 1 : 0), 500);
}

runAllTests().catch(err => {
  console.error('Test Runner Exception:', err);
  if (server) server.close();
  process.exit(1);
});
