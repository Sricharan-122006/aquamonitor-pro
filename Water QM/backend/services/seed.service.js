const bcrypt = require('bcryptjs');
const {
  UserRepo,
  StationRepo,
  ReadingRepo,
  AlertRepo,
  ReportRepo,
  SubscriptionRepo,
  ThresholdRepo,
  ComplaintRepo,
  CommunityIssueRepo,
  CommunityNotificationRepo
} = require('../storage/repository');

async function seedInitialData() {
  const salt = await bcrypt.genSalt(10);
  const adminPassword = await bcrypt.hash('Admin@123', salt);
  const userPassword = await bcrypt.hash('User@123', salt);

  // 1. Seed Admin & Reference Users if Admin doesn't exist
  const adminUser = await UserRepo.findOne({ email: 'admin@aquamonitor.in' });
  if (!adminUser) {
    console.log('[Seed] Seeding Admin and Reference Users...');
    await UserRepo.create({
      name: 'Aqua Administrator',
      email: 'admin@aquamonitor.in',
      phone: '+91 98765 00000',
      organization: 'Punjab Water Board',
      password: adminPassword,
      role: 'ADMIN',
      plan: 'ENTERPRISE',
      emailAlerts: true,
      smsAlerts: true,
      theme: 'light',
      joined: '4/20/2026'
    });
  }

  const primaryUser = await UserRepo.findOne({ email: 'secretowars007@gmail.com' });
  if (!primaryUser) {
    await UserRepo.create({
      name: 'ZAM',
      email: 'secretowars007@gmail.com',
      phone: '+91 96385 27412',
      organization: 'ZAM Environmental',
      password: userPassword,
      role: 'USER',
      plan: 'FREE',
      emailAlerts: true,
      smsAlerts: false,
      theme: 'light',
      joined: '4/26/2026'
    });
  }

  const refUsers = [
    { name: 'anjali', email: 'anjali@gmail.com', joined: '4/26/2026' },
    { name: 'kirti', email: 'kirti@gmail.com', joined: '4/26/2026' },
    { name: 'prachi', email: 'prachi@gmail.com', joined: '4/26/2026' },
    { name: 'abc', email: 'abc@gmail.com', joined: '4/26/2026' },
    { name: 'xyz', email: 'xyz@gmail.com', joined: '4/26/2026' },
    { name: 'Puja', email: 'puja@gmail.com', joined: '4/26/2026' },
    { name: 'Priya', email: 'priya@gmail.com', joined: '4/26/2026' },
    { name: 'OMM PRAKASH DEY', email: 'ommprakashbitu18@gmail.com', joined: '4/26/2026' }
  ];

  for (const u of refUsers) {
    const exists = await UserRepo.findOne({ email: u.email });
    if (!exists) {
      await UserRepo.create({
        name: u.name,
        email: u.email,
        phone: '+91 98000 12345',
        organization: '—',
        password: userPassword,
        role: 'USER',
        plan: 'FREE',
        emailAlerts: true,
        smsAlerts: false,
        theme: 'light',
        joined: u.joined
      });
    }
  }

  // 2. Seed 10 River Monitoring Stations if missing
  const stationsCount = await StationRepo.countDocuments();
  if (stationsCount === 0) {
    console.log('[Seed] Seeding 10 River Monitoring Stations...');
    const stationsData = [
      {
        stationId: 'ST001',
        name: 'Kaveri',
        location: 'Karnataka',
        latitude: 12.42,
        longitude: 75.73,
        status: 'Safe',
        wqi: 100,
        latestReading: {
          ph: 7.2,
          turbidity: 14,
          temperature: 25,
          dissolvedOxygen: 8.0,
          tds: 160,
          conductivity: 240,
          timeString: '12:07:46 PM'
        }
      },
      {
        stationId: 'ST002',
        name: 'Yamuna',
        location: 'Delhi',
        latitude: 28.61,
        longitude: 77.23,
        status: 'Safe',
        wqi: 70,
        latestReading: {
          ph: 7.1,
          turbidity: 58,
          temperature: 18,
          dissolvedOxygen: 6.2,
          tds: 564,
          conductivity: 410,
          timeString: '10:33:04 PM'
        }
      },
      {
        stationId: 'ST003',
        name: 'Godavari',
        location: 'Nashik, Maharashtra',
        latitude: 19.99,
        longitude: 73.78,
        status: 'Safe',
        wqi: 90,
        latestReading: {
          ph: 7.3,
          turbidity: 55,
          temperature: 28,
          dissolvedOxygen: 7.8,
          tds: 320,
          conductivity: 380,
          timeString: '12:02:17 PM'
        }
      },
      {
        stationId: 'ST004',
        name: 'Saraswati',
        location: 'Kurukshetra, Haryana',
        latitude: 30.12,
        longitude: 76.87,
        status: 'Alert',
        wqi: 25,
        latestReading: {
          ph: 9.2,
          turbidity: 100,
          temperature: 26,
          dissolvedOxygen: 3.41,
          tds: 849.7,
          conductivity: 780,
          timeString: '3:04:34 PM'
        }
      },
      {
        stationId: 'ST005',
        name: 'Narmada',
        location: 'Jabalpur, Madhya Pradesh',
        latitude: 23.18,
        longitude: 79.98,
        status: 'Safe',
        wqi: 100,
        latestReading: {
          ph: 7.0,
          turbidity: 18,
          temperature: 24,
          dissolvedOxygen: 8.5,
          tds: 180,
          conductivity: 260,
          timeString: '7:25:20 PM'
        }
      },
      {
        stationId: 'ST006',
        name: 'Ganga',
        location: 'Varanasi, Uttar Pradesh',
        latitude: 25.31,
        longitude: 82.97,
        status: 'Safe',
        wqi: 95,
        latestReading: {
          ph: 7.4,
          turbidity: 28,
          temperature: 22,
          dissolvedOxygen: 7.9,
          tds: 210,
          conductivity: 310,
          timeString: '11:15:00 AM'
        }
      },
      {
        stationId: 'ST007',
        name: 'Damodar',
        location: 'Dhanbad, Jharkhand',
        latitude: 23.79,
        longitude: 86.43,
        status: 'Alert',
        wqi: 45,
        latestReading: {
          ph: 5.0,
          turbidity: 85,
          temperature: 27,
          dissolvedOxygen: 1.0,
          tds: 800,
          conductivity: 720,
          timeString: '1:12:34 PM'
        }
      },
      {
        stationId: 'ST008',
        name: 'Banas',
        location: 'Tonk, Rajasthan',
        latitude: 26.16,
        longitude: 75.78,
        status: 'Safe',
        wqi: 85,
        latestReading: {
          ph: 7.2,
          turbidity: 32,
          temperature: 23,
          dissolvedOxygen: 7.2,
          tds: 290,
          conductivity: 340,
          timeString: '09:40:12 AM'
        }
      },
      {
        stationId: 'ST009',
        name: 'Brahmaputra',
        location: 'Guwahati, Assam',
        latitude: 26.14,
        longitude: 91.73,
        status: 'Safe',
        wqi: 100,
        latestReading: {
          ph: 7.1,
          turbidity: 22,
          temperature: 21,
          dissolvedOxygen: 8.8,
          tds: 170,
          conductivity: 250,
          timeString: '08:22:45 AM'
        }
      },
      {
        stationId: 'ST010',
        name: 'Ravi River',
        location: 'Ludhiana, Punjab',
        latitude: 30.90,
        longitude: 75.85,
        status: 'Safe',
        wqi: 88,
        latestReading: {
          ph: 7.3,
          turbidity: 26,
          temperature: 20,
          dissolvedOxygen: 8.1,
          tds: 240,
          conductivity: 290,
          timeString: '11:58:14 AM'
        }
      }
    ];

    for (const s of stationsData) {
      await StationRepo.create(s);
    }

    // Seed Readings History (Past 30 days)
    const now = new Date();
    for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
      const readingDate = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
      for (const st of stationsData) {
        const variation = (Math.sin(dayOffset + st.latitude) * 0.2);
        const rPh = Number((st.latestReading.ph + variation).toFixed(2));
        const rTurb = Math.max(5, Math.round(st.latestReading.turbidity + variation * 10));
        const rTemp = Math.round(st.latestReading.temperature + variation * 2);
        const rDO = Number((st.latestReading.dissolvedOxygen - variation * 0.5).toFixed(2));
        const rTds = Math.round(st.latestReading.tds + variation * 20);

        await ReadingRepo.create({
          stationId: st.stationId,
          stationName: st.name,
          location: st.location,
          ph: rPh,
          turbidity: rTurb,
          temperature: rTemp,
          dissolvedOxygen: rDO,
          tds: rTds,
          conductivity: st.latestReading.conductivity,
          wqi: st.wqi,
          status: st.status,
          timestamp: readingDate,
          timeString: readingDate.toLocaleTimeString('en-US'),
          createdAt: readingDate
        });
      }
    }
  }

  // 3. Seed Alerts if missing
  const alertsCount = await AlertRepo.countDocuments();
  if (alertsCount === 0) {
    console.log('[Seed] Seeding 13 system alerts...');
    const alertsData = [
      {
        time: '3:04:34 PM',
        station: 'Saraswati',
        parameter: 'Dissolved Oxygen',
        value: '3.41 mg/L',
        threshold: '5 mg/L',
        severity: 'Critical',
        status: 'Active',
        message: 'DO: 3.41 mg/L is below minimum at Saraswati'
      },
      {
        time: '3:04:33 PM',
        station: 'Saraswati',
        parameter: 'TDS',
        value: '849.7 ppm',
        threshold: '500 ppm',
        severity: 'Critical',
        status: 'Active',
        message: 'TDS 849.7 ppm exceeds safe limit at Saraswati'
      },
      {
        time: '3:04:33 PM',
        station: 'Saraswati',
        parameter: 'Turbidity',
        value: '100 NTU',
        threshold: '50 NTU',
        severity: 'Critical',
        status: 'Active',
        message: 'Turbidity 100 NTU is elevated at Saraswati'
      },
      {
        time: '3:04:33 PM',
        station: 'Saraswati',
        parameter: 'pH',
        value: '9.2',
        threshold: '8.5',
        severity: 'Warning',
        status: 'Active',
        message: 'pH level 9.2 is outside safe range (6.5 - 8.5) at Saraswati'
      },
      {
        time: '1:12:35 PM',
        station: 'Damodar',
        parameter: 'Dissolved Oxygen',
        value: '1 mg/L',
        threshold: '5 mg/L',
        severity: 'Critical',
        status: 'Active',
        message: 'DO: 1.0 mg/L is critically low at Damodar'
      },
      {
        time: '1:12:34 PM',
        station: 'Damodar',
        parameter: 'pH',
        value: '1',
        threshold: '6.5',
        severity: 'Critical',
        status: 'Active',
        message: 'pH: 1 is critically acidic at Damodar'
      },
      {
        time: '1:12:34 PM',
        station: 'Damodar',
        parameter: 'TDS',
        value: '800 ppm',
        threshold: '500 ppm',
        severity: 'Critical',
        status: 'Active',
        message: 'TDS: 800 ppm exceeds safe limit at Damodar'
      },
      {
        time: '1:12:34 PM',
        station: 'Damodar',
        parameter: 'pH',
        value: '5',
        threshold: '6.5',
        severity: 'Warning',
        status: 'Active',
        message: 'pH level 5 is below safe minimum at Damodar'
      },
      {
        time: '11:58:14 AM',
        station: 'Ravi River',
        parameter: 'Dissolved Oxygen',
        value: '3 mg/L',
        threshold: '5 mg/L',
        severity: 'Critical',
        status: 'Active',
        message: 'DO: 3.0 mg/L is below minimum at Ravi River'
      },
      {
        time: '10:33:05 AM',
        station: 'Yamuna',
        parameter: 'Dissolved Oxygen',
        value: '5 mg/L',
        threshold: '5 mg/L',
        severity: 'Warning',
        status: 'Active',
        message: 'DO: 5.0 mg/L is borderline low at Yamuna'
      },
      {
        time: '10:33:04 AM',
        station: 'Yamuna',
        parameter: 'TDS',
        value: '564 ppm',
        threshold: '500 ppm',
        severity: 'Warning',
        status: 'Active',
        message: 'TDS: 564 ppm is elevated at Yamuna'
      },
      {
        time: '09:15:20 AM',
        station: 'Godavari',
        parameter: 'Turbidity',
        value: '55 NTU',
        threshold: '50 NTU',
        severity: 'Warning',
        status: 'Active',
        message: 'Turbidity: 55 NTU is slightly elevated at Godavari'
      },
      {
        time: '08:45:10 AM',
        station: 'Kaveri',
        parameter: 'Conductivity',
        value: '240 µS/cm',
        threshold: '800 µS/cm',
        severity: 'Info',
        status: 'Active',
        message: 'Routine calibration check completed successfully'
      }
    ];

    for (const a of alertsData) {
      await AlertRepo.create(a);
    }
  }

  // 4. Seed Default Thresholds if missing
  const threshCount = await ThresholdRepo.countDocuments();
  if (threshCount === 0) {
    await ThresholdRepo.create({
      phMin: 6.5,
      phMax: 8.5,
      turbidityMin: 0,
      turbidityMax: 100,
      tdsMin: 0,
      tdsMax: 500,
      doMin: 5.0,
      doMax: 12.0,
      tempMin: 10,
      tempMax: 25
    });
  }

  // 5. Seed Reports History if missing
  const reportCount = await ReportRepo.countDocuments();
  if (reportCount === 0) {
    await ReportRepo.create({
      title: 'Daily Report — Today',
      type: 'Daily',
      generatedDate: 'Today',
      generatedTime: 'Today 08:00',
      stations: 'All',
      status: 'Ready',
      planRequired: 'FREE',
      downloadUrl: '/reports_files/AquaMonitor_Daily_Sample.pdf'
    });

    await ReportRepo.create({
      title: 'Weekly Summary',
      type: 'Weekly',
      generatedDate: 'Last week',
      generatedTime: 'Last week',
      stations: 'All',
      status: 'Premium',
      planRequired: 'PRO',
      downloadUrl: ''
    });
  }

  // 6. Seed Sample Payment Record if missing
  const subCount = await SubscriptionRepo.countDocuments();
  if (subCount === 0) {
    await SubscriptionRepo.create({
      userId: 'usr_zam001',
      userEmail: 'secretowars007@gmail.com',
      plan: 'Pro Plan',
      amount: '₹499',
      currency: 'INR',
      orderId: 'order_N19FpP6ZQ03xQv',
      paymentId: 'pay_S19FpP6ZQ03xQv',
      status: 'paid',
      date: '4/26/2026'
    });
  }

  // 7. Seed Initial Complaints & Community Issues if missing
  const complaintCount = await ComplaintRepo.countDocuments();
  if (complaintCount === 0) {
    console.log('[Seed] Seeding Initial Complaints & Community Issues...');

    const seededComplaints = [
      {
        trackingId: 'CMP-1024',
        submitterName: 'Ramesh Sharma',
        submitterEmail: 'ramesh.sharma@example.com',
        submitterPhone: '+91 98765 43210',
        category: 'Pipeline Leakage',
        locality: 'Model Town',
        landmark: 'Near Central Water Tank',
        pincode: '141002',
        stationId: 'ST002',
        description: 'Water leaking through pavement near water tank, street getting flooded.',
        status: 'Submitted',
        priority: 'High',
        communityIssueRef: 'ISS-0001',
        auditLog: [
          {
            action: 'Complaint Registered',
            details: 'Individual complaint recorded via web portal.',
            actor: 'Ramesh Sharma',
            actorRole: 'CITIZEN',
            timestamp: new Date(Date.now() - 36 * 3600000).toISOString()
          },
          {
            action: 'Linked to Community Issue ISS-0001',
            details: 'Grouped under shared community issue "Water leakage report cluster". Individual tracking preserved.',
            actor: 'Aqua Administrator',
            actorRole: 'ADMIN',
            timestamp: new Date(Date.now() - 24 * 3600000).toISOString()
          }
        ]
      },
      {
        trackingId: 'CMP-1031',
        submitterName: 'Simran Kaur',
        submitterEmail: 'simran.k@example.com',
        submitterPhone: '+91 98112 34567',
        category: 'Pipeline Leakage',
        locality: 'Model Town',
        landmark: 'Main Market Road',
        pincode: '141002',
        stationId: 'ST002',
        description: 'Severe pipeline leakage under pedestrian sidewalk causing water accumulation.',
        status: 'Under Review',
        priority: 'High',
        communityIssueRef: 'ISS-0001',
        auditLog: [
          {
            action: 'Complaint Registered',
            details: 'Individual complaint recorded via web portal.',
            actor: 'Simran Kaur',
            actorRole: 'CITIZEN',
            timestamp: new Date(Date.now() - 30 * 3600000).toISOString()
          },
          {
            action: 'Linked to Community Issue ISS-0001',
            details: 'Grouped under shared community issue "Water leakage report cluster". Individual tracking preserved.',
            actor: 'Aqua Administrator',
            actorRole: 'ADMIN',
            timestamp: new Date(Date.now() - 24 * 3600000).toISOString()
          }
        ]
      },
      {
        trackingId: 'CMP-1042',
        submitterName: 'Amit Verma',
        submitterEmail: 'amit.v@example.com',
        submitterPhone: '+91 98223 45678',
        category: 'Pipeline Leakage',
        locality: 'Model Town',
        landmark: 'Sector 3 Crossing',
        pincode: '141002',
        stationId: 'ST002',
        description: 'Underground water pipe damaged during road repair work; continuous water gushing.',
        status: 'Submitted',
        priority: 'High',
        communityIssueRef: 'ISS-0001',
        auditLog: [
          {
            action: 'Complaint Registered',
            details: 'Individual complaint recorded via web portal.',
            actor: 'Amit Verma',
            actorRole: 'CITIZEN',
            timestamp: new Date(Date.now() - 26 * 3600000).toISOString()
          },
          {
            action: 'Linked to Community Issue ISS-0001',
            details: 'Grouped under shared community issue "Water leakage report cluster". Individual tracking preserved.',
            actor: 'Aqua Administrator',
            actorRole: 'ADMIN',
            timestamp: new Date(Date.now() - 24 * 3600000).toISOString()
          }
        ]
      },
      {
        trackingId: 'CMP-1055',
        submitterName: 'Gurpreet Singh',
        submitterEmail: 'gurpreet.s@example.com',
        submitterPhone: '+91 98334 56789',
        category: 'Odor / Discoloration',
        locality: 'Industrial Phase 1',
        landmark: 'Plot 42 Near Kaveri Junction',
        pincode: '141003',
        stationId: 'ST001',
        description: 'Tap water has noticeable yellowish tint and metallic odor since yesterday morning.',
        status: 'Under Review',
        priority: 'Medium',
        communityIssueRef: 'ISS-0002',
        auditLog: [
          {
            action: 'Complaint Registered',
            details: 'Individual complaint recorded via web portal.',
            actor: 'Gurpreet Singh',
            actorRole: 'CITIZEN',
            timestamp: new Date(Date.now() - 18 * 3600000).toISOString()
          },
          {
            action: 'Linked to Community Issue ISS-0002',
            details: 'Grouped under shared community issue "Pipeline inspection required".',
            actor: 'Aqua Administrator',
            actorRole: 'ADMIN',
            timestamp: new Date(Date.now() - 12 * 3600000).toISOString()
          }
        ]
      },
      {
        trackingId: 'CMP-1060',
        submitterName: 'Neha Patel',
        submitterEmail: 'neha.patel@example.com',
        submitterPhone: '+91 98445 67890',
        category: 'Odor / Discoloration',
        locality: 'Industrial Phase 1',
        landmark: 'Workers Colony Gate 2',
        pincode: '141003',
        stationId: 'ST001',
        description: 'Suspicious murky sediment and chemical smell observed in municipal supply lines.',
        status: 'Action in Progress',
        priority: 'Medium',
        communityIssueRef: 'ISS-0002',
        auditLog: [
          {
            action: 'Complaint Registered',
            details: 'Individual complaint recorded via web portal.',
            actor: 'Neha Patel',
            actorRole: 'CITIZEN',
            timestamp: new Date(Date.now() - 15 * 3600000).toISOString()
          },
          {
            action: 'Linked to Community Issue ISS-0002',
            details: 'Grouped under shared community issue "Pipeline inspection required".',
            actor: 'Aqua Administrator',
            actorRole: 'ADMIN',
            timestamp: new Date(Date.now() - 12 * 3600000).toISOString()
          }
        ]
      },
      {
        trackingId: 'CMP-1072',
        submitterName: 'Vikram Malhotra',
        submitterEmail: 'vikram.m@example.com',
        submitterPhone: '+91 98556 78901',
        category: 'Low Water Pressure',
        locality: 'Civil Lines',
        landmark: 'Officers Enclave',
        pincode: '141001',
        stationId: 'ST003',
        description: 'Water supply pressure has dropped significantly across block B residential units.',
        status: 'Submitted',
        priority: 'Low',
        communityIssueRef: null,
        auditLog: [
          {
            action: 'Complaint Registered',
            details: 'Complaint logged. Awaiting triage and clustering.',
            actor: 'Vikram Malhotra',
            actorRole: 'CITIZEN',
            timestamp: new Date(Date.now() - 8 * 3600000).toISOString()
          }
        ]
      },
      {
        trackingId: 'CMP-1080',
        submitterName: 'ZAM',
        submitterEmail: 'secretowars007@gmail.com',
        submitterPhone: '+91 96385 27412',
        category: 'Water Contamination',
        locality: 'Tagore Garden',
        landmark: 'Near Saraswati Feeder',
        pincode: '141004',
        stationId: 'ST004',
        description: 'Discolored canal water observed entering residential supply feeder.',
        status: 'Investigating',
        priority: 'High',
        communityIssueRef: null,
        auditLog: [
          {
            action: 'Complaint Registered',
            details: 'Submitted by registered citizen user.',
            actor: 'ZAM',
            actorRole: 'USER',
            timestamp: new Date(Date.now() - 4 * 3600000).toISOString()
          }
        ]
      }
    ];

    for (const comp of seededComplaints) {
      await ComplaintRepo.create(comp);
    }

    // Community Issues
    await CommunityIssueRepo.create({
      issueRef: 'ISS-0001',
      title: 'Water leakage report cluster',
      category: 'Pipeline Leakage',
      locality: 'Model Town',
      locationDetails: 'Sector 2 & Central Water Tank perimeter',
      stationId: 'ST002',
      description: 'Multiple citizen reports received indicating subterranean pipe ruptures and surface water logging in Model Town.',
      priority: 'High',
      status: 'Under Investigation',
      assignedTo: 'Unassigned',
      assignedTeam: 'Unassigned',
      linkedComplaintIds: ['CMP-1024', 'CMP-1031', 'CMP-1042'],
      linkedCount: 3,
      internalNotes: [
        {
          id: 'note-001',
          note: 'Initial engineering review suggests pressure surge from Sector 2 booster pump ruptured secondary distribution line.',
          author: 'Aqua Administrator',
          authorRole: 'ADMIN',
          createdAt: new Date(Date.now() - 20 * 3600000).toISOString()
        }
      ],
      publicUpdates: [
        {
          id: 'update-001',
          message: 'Municipal maintenance crew has been dispatched to Model Town to conduct acoustic leak detection.',
          publishedBy: 'Aqua Administrator',
          publishedAt: new Date(Date.now() - 16 * 3600000).toISOString()
        }
      ],
      activityTimeline: [
        {
          id: 'act-001',
          action: 'Issue Created',
          details: 'Community issue initialized by administrator following 3 concurrent leakage complaints.',
          actor: 'Aqua Administrator',
          actorRole: 'ADMIN',
          timestamp: new Date(Date.now() - 24 * 3600000).toISOString()
        },
        {
          id: 'act-002',
          action: 'Related Complaints Linked',
          details: '3 complaints (CMP-1024, CMP-1031, CMP-1042) linked to this common community issue.',
          actor: 'Aqua Administrator',
          actorRole: 'ADMIN',
          timestamp: new Date(Date.now() - 24 * 3600000).toISOString()
        },
        {
          id: 'act-003',
          action: 'Internal Note Added',
          details: 'Staff investigation note recorded.',
          actor: 'Aqua Administrator',
          actorRole: 'ADMIN',
          timestamp: new Date(Date.now() - 20 * 3600000).toISOString()
        },
        {
          id: 'act-004',
          action: 'Public Progress Update Published',
          details: 'Dispatched maintenance update shared with affected citizens.',
          actor: 'Aqua Administrator',
          actorRole: 'ADMIN',
          timestamp: new Date(Date.now() - 16 * 3600000).toISOString()
        }
      ],
      resolutionSummary: '',
      resolvedBy: '',
      resolvedAt: null,
      reopenHistory: []
    });

    await CommunityIssueRepo.create({
      issueRef: 'ISS-0002',
      title: 'Pipeline inspection required',
      category: 'Odor / Discoloration',
      locality: 'Industrial Phase 1',
      locationDetails: 'Kaveri Junction & Workers Colony Zone',
      stationId: 'ST001',
      description: 'Reports of metallic odor and yellowish tint in industrial area water feeder lines.',
      priority: 'Medium',
      status: 'Action in Progress',
      assignedTo: 'Municipal Pipeline Maintenance',
      assignedTeam: 'Municipal Pipeline Maintenance',
      linkedComplaintIds: ['CMP-1055', 'CMP-1060'],
      linkedCount: 2,
      internalNotes: [
        {
          id: 'note-002',
          note: 'Industrial backflow prevention valve test scheduled for 14:00 today.',
          author: 'Aqua Administrator',
          authorRole: 'ADMIN',
          createdAt: new Date(Date.now() - 10 * 3600000).toISOString()
        }
      ],
      publicUpdates: [
        {
          id: 'update-002',
          message: 'Flushing of distribution main underway. Water sample taken for quality verification.',
          publishedBy: 'Aqua Administrator',
          publishedAt: new Date(Date.now() - 6 * 3600000).toISOString()
        }
      ],
      activityTimeline: [
        {
          id: 'act-101',
          action: 'Issue Created',
          details: 'Issue created by administrator.',
          actor: 'Aqua Administrator',
          actorRole: 'ADMIN',
          timestamp: new Date(Date.now() - 12 * 3600000).toISOString()
        },
        {
          id: 'act-102',
          action: 'Assignment Changed',
          details: 'Assigned to Municipal Pipeline Maintenance team.',
          actor: 'Aqua Administrator',
          actorRole: 'ADMIN',
          timestamp: new Date(Date.now() - 11 * 3600000).toISOString()
        },
        {
          id: 'act-103',
          action: 'Status Transition to Action in Progress',
          details: 'Maintenance team on site flushing main conduit.',
          actor: 'Aqua Administrator',
          actorRole: 'ADMIN',
          timestamp: new Date(Date.now() - 8 * 3600000).toISOString()
        }
      ],
      resolutionSummary: '',
      resolvedBy: '',
      resolvedAt: null,
      reopenHistory: []
    });

    // Seed Initial Notifications
    await CommunityNotificationRepo.create({
      type: 'HIGH_PRIORITY',
      title: 'High Priority Issue Created: ISS-0001',
      message: 'Water leakage report cluster in Model Town is unassigned. Assigning maintenance team recommended.',
      issueRef: 'ISS-0001',
      priority: 'High',
      read: false
    });

    await CommunityNotificationRepo.create({
      type: 'NEW_COMPLAINT_LINKED',
      title: '3 Complaints Linked to ISS-0001',
      message: 'CMP-1024, CMP-1031, CMP-1042 successfully grouped.',
      issueRef: 'ISS-0001',
      priority: 'High',
      read: false
    });
  }
}

module.exports = seedInitialData;
