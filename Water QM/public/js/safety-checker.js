/**
 * Safety Checker Frontend Engine
 * Real Postal Location Lookup via India Post API (Backend proxy + Direct Browser Fallback)
 * Demonstration Water Quality, Testing History, Labs, and Demo Booking
 */

(function () {
  'use strict';

  // Local state for Safety Checker
  const scState = {
    currentPincode: '509001',
    verifiedLocation: null,
    selectedPostOffice: null,
    demoDashboard: null,
    isSearching: false,
    selectedLabForBooking: null,
    allLabs: []
  };

  /**
   * Initialize Safety Checker view
   */
  function init() {
    setupEventListeners();
    const pinInput = document.getElementById('scPinInput');
    if (pinInput && !pinInput.value) {
      pinInput.value = '509001';
    }

    // Set today as minimum date for preferred testing date
    const dateInput = document.getElementById('scBookingDate');
    if (dateInput && !dateInput.value) {
      const today = new Date().toISOString().split('T')[0];
      dateInput.min = today;
      dateInput.value = today;
    }

    // Auto-search default PIN if not already loaded
    if (!scState.verifiedLocation && pinInput && pinInput.value === '509001') {
      performLookup('509001');
    } else if (scState.verifiedLocation) {
      renderLocationDetails();
      drawPhTrendChart();
    }
  }

  function setupEventListeners() {
    const searchForm = document.getElementById('scSearchForm');
    if (searchForm && !searchForm._hasListener) {
      searchForm.addEventListener('submit', handleSearchSubmit);
      searchForm._hasListener = true;
    }

    const pinInput = document.getElementById('scPinInput');
    if (pinInput && !pinInput._hasInputListener) {
      pinInput.addEventListener('input', (e) => {
        // Enforce digits only and max 6 digits
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
      });
      pinInput._hasInputListener = true;
    }

    const bookingForm = document.getElementById('scBookingForm');
    if (bookingForm && !bookingForm._hasListener) {
      bookingForm.addEventListener('submit', handleBookingSubmit);
      bookingForm._hasListener = true;
    }

    // Redraw chart on window resize
    window.addEventListener('resize', () => {
      if (document.getElementById('view-safety-checker')?.classList.contains('active-view')) {
        drawPhTrendChart();
      }
    });
  }

  /**
   * Handle Search Form Submission
   */
  async function handleSearchSubmit(e) {
    if (e) e.preventDefault();
    const pinInput = document.getElementById('scPinInput');
    const pincode = pinInput ? pinInput.value.trim() : '';

    if (!pincode || pincode.length !== 6 || !/^\d{6}$/.test(pincode)) {
      showStatusMessage('Please enter a valid six-digit PIN code.', 'error');
      return;
    }

    await performLookup(pincode);
  }

  /**
   * Perform live PIN lookup with graceful fallback
   */
  async function performLookup(pincode) {
    if (scState.isSearching) return;
    scState.isSearching = true;

    const searchBtn = document.getElementById('scSearchBtn');
    const searchBtnText = document.getElementById('scSearchBtnText');
    const searchSpinner = document.getElementById('scSearchSpinner');

    if (searchBtn) searchBtn.disabled = true;
    if (searchBtnText) searchBtnText.innerText = 'Verifying...';
    if (searchSpinner) searchSpinner.style.display = 'inline-block';
    hideStatusMessage();

    try {
      let verifiedData = null;

      // Strategy 1: Attempt through backend proxy
      try {
        const res = await fetch(`/api/safety-checker/lookup/${pincode}`);
        const text = await res.text();

        // Check if response is valid JSON rather than SPA fallback HTML
        if (text && !text.trim().startsWith('<')) {
          const parsed = JSON.parse(text);
          if (res.ok && parsed.success && parsed.data) {
            verifiedData = parsed.data;
          } else if (res.status === 404 || parsed.message?.includes('could not find a postal location')) {
            throw new Error('We could not find a postal location for this PIN code. Please check and try again.');
          } else if (parsed.message) {
            throw new Error(parsed.message);
          }
        }
      } catch (proxyErr) {
        // If it was an explicit 404/validation message, propagate it
        if (proxyErr.message && !proxyErr.message.includes('JSON')) {
          throw proxyErr;
        }
        console.warn('Backend proxy unavailable or returned non-JSON, falling back to direct India Post API...');
      }

      // Strategy 2: Direct browser call to India Post API if proxy was bypassed or returned HTML
      if (!verifiedData) {
        try {
          const directRes = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
          const directJson = await directRes.json();

          if (Array.isArray(directJson) && directJson.length > 0) {
            const root = directJson[0];
            if (root.Status === 'Success' && Array.isArray(root.PostOffice) && root.PostOffice.length > 0) {
              const postOffices = root.PostOffice.map(po => ({
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
                pincode: po.Pincode || pincode
              }));

              verifiedData = {
                pincode: pincode,
                state: postOffices[0].state,
                district: postOffices[0].district,
                postOffices,
                totalOffices: postOffices.length,
                dataSource: 'INDIA_POST_LIVE_API',
                isVerifiedPostalLocation: true
              };
            } else if (root.Status === 'Error' || !root.PostOffice) {
              throw new Error('We could not find a postal location for this PIN code. Please check and try again.');
            }
          }
        } catch (directErr) {
          if (directErr.message && !directErr.message.includes('JSON')) {
            throw directErr;
          }
          throw new Error('We could not verify this PIN code right now. Please try again.');
        }
      }

      if (!verifiedData) {
        throw new Error('We could not verify this PIN code right now. Please try again.');
      }

      scState.currentPincode = pincode;
      scState.verifiedLocation = verifiedData;
      scState.selectedPostOffice = verifiedData.postOffices[0]?.name || '';

      showStatusMessage('Location verified successfully.', 'success');

      // Load demonstration water quality dashboard
      await loadDemoDashboard(pincode, scState.selectedPostOffice);

      // Render location details & show dashboard
      renderLocationDetails();
      showDashboardSections();

    } catch (err) {
      console.error('Postal lookup error:', err);
      const friendlyMsg = (err.message && !err.message.includes('JSON') && !err.message.includes('<'))
        ? err.message
        : 'We could not verify this PIN code right now. Please try again.';
      showStatusMessage(friendlyMsg, 'error');
      hideDashboardSections();
    } finally {
      scState.isSearching = false;
      if (searchBtn) searchBtn.disabled = false;
      if (searchBtnText) searchBtnText.innerText = 'Search';
      if (searchSpinner) searchSpinner.style.display = 'none';
    }
  }

  /**
   * Load Demonstration Dashboard Data
   */
  async function loadDemoDashboard(pincode, postOffice) {
    let dashboardData = null;

    try {
      const query = postOffice ? `?postOffice=${encodeURIComponent(postOffice)}` : '';
      const res = await fetch(`/api/safety-checker/data/${pincode}${query}`);
      const text = await res.text();
      if (text && !text.trim().startsWith('<')) {
        const parsed = JSON.parse(text);
        if (parsed.success && parsed.data) {
          dashboardData = parsed.data;
        }
      }
    } catch (err) {
      console.warn('Failed to load demo data from backend, utilizing segregated client fixture:', err);
    }

    // Fallback to client-side demonstration fixture if backend returned HTML
    if (!dashboardData) {
      dashboardData = getFallbackDemoFixture(pincode, postOffice);
    }

    scState.demoDashboard = dashboardData;
    scState.allLabs = dashboardData.laboratories || [];
    renderOverviewMetrics(dashboardData.overview);
    renderTestingHistory(dashboardData.history);
    renderLaboratories(dashboardData.laboratories);
    setTimeout(drawPhTrendChart, 50);
  }

  /**
   * Segregated Client Demonstration Fixture
   */
  function getFallbackDemoFixture(pincode, postOffice) {
    const loc = postOffice || 'Local Area';
    return {
      disclaimer: 'DEMO DATA — NOT A REAL WATER SAFETY ASSESSMENT. The following water-quality information is simulated for demonstration purposes only.',
      pincode: pincode,
      selectedLocality: loc,
      dataSource: 'DEMO',
      overview: {
        dataSource: 'DEMO',
        demonstrationStatus: 'Safe',
        statusLabel: '92% Safe to Drink',
        statusDescription: 'Based on sample demo data',
        sampleCount: 5,
        lastSampleTested: '12 Aug 2024',
        parameters: {
          ph: { value: 7.2, safeRange: '6.5 – 8.5', status: 'Normal', badgeClass: 'badge-safe' },
          tds: { value: 420, safeRange: '0 – 500', status: 'Normal', badgeClass: 'badge-safe' },
          temperature: { value: 24.5, safeRange: '10 – 25', status: 'Normal', badgeClass: 'badge-safe' },
          turbidity: { value: 1.8, safeRange: '0 – 5', status: 'Normal', badgeClass: 'badge-safe' }
        }
      },
      history: [
        { id: 1, sampleId: 'SMP-2024-0812', sampleDate: '12 Aug 2024', sourceStation: `${loc} PH`, ph: 7.2, tds: 420, temp: 24.5, turbidity: 1.8, status: '94% Safe to Drink', badgeClass: 'badge-safe', dataSource: 'DEMO' },
        { id: 2, sampleId: 'SMP-2024-0510', sampleDate: '10 May 2024', sourceStation: 'Public Tap', ph: 7.4, tds: 380, temp: 23.8, turbidity: 2.1, status: '96% Safe to Drink', badgeClass: 'badge-safe', dataSource: 'DEMO' },
        { id: 3, sampleId: 'SMP-2024-0215', sampleDate: '15 Feb 2024', sourceStation: 'Borewell 1', ph: 6.8, tds: 520, temp: 25.1, turbidity: 3.5, status: '74% Boil/Filter', badgeClass: 'badge-caution', dataSource: 'DEMO' },
        { id: 4, sampleId: 'SMP-2023-1120', sampleDate: '20 Nov 2023', sourceStation: 'Community Well', ph: 7.1, tds: 410, temp: 24.0, turbidity: 2.0, status: '93% Safe to Drink', badgeClass: 'badge-safe', dataSource: 'DEMO' }
      ],
      trendData: [
        { label: 'Nov 23', ph: 7.1 },
        { label: 'Feb 24', ph: 6.8 },
        { label: 'May 24', ph: 7.4 },
        { label: 'Aug 24', ph: 7.2 }
      ],
      laboratories: [
        {
          id: 'LAB-001',
          name: 'Mahabubnagar Govt. Lab',
          type: 'Government Laboratory',
          typeIcon: '🏛️',
          distance: '12 km (approx.)',
          isDemo: true,
          dataSource: 'DEMO',
          address: 'District Water Testing Centre, Station Road, Mahabubnagar',
          accreditation: 'State Public Health Division (Demo)',
          parameters: ['pH', 'TDS', 'Bacteria', 'Chemical'],
          description: 'Demonstration profile of a district-level government water testing facility equipped for bacteriological and physico-chemical evaluation.'
        },
        {
          id: 'LAB-002',
          name: 'Sri Sai Water Testing Lab',
          type: 'Private Laboratory',
          typeIcon: '🏢',
          distance: '18 km (approx.)',
          isDemo: true,
          dataSource: 'DEMO',
          address: 'Near Old Bus Stand, Market Area, Mahabubnagar',
          accreditation: 'Certified Environmental Testing (Demo)',
          parameters: ['pH', 'TDS', 'Heavy Metals'],
          description: 'Demonstration profile of an environmental laboratory offering advanced multi-element heavy metal spectrometry and drinking water potability checks.'
        },
        {
          id: 'LAB-003',
          name: 'Telangana Enviro Lab',
          type: 'NABL Accredited (Demo)',
          typeIcon: '📜',
          distance: '25 km (approx.)',
          isDemo: true,
          dataSource: 'DEMO',
          address: 'Industrial Development Area, Phase 2, Jadcherla - Mahabubnagar Highway',
          accreditation: 'NABL ISO/IEC 17025 Compliant (Demo Simulation)',
          parameters: ['pH', 'TDS', 'Bacteria', 'Chemical'],
          description: 'Demonstration listing for an accredited environmental testing lab providing comprehensive IS 10500 compliance testing for municipal & groundwater.'
        }
      ]
    };
  }

  /**
   * Render Location Details (Real Data)
   */
  function renderLocationDetails() {
    const loc = scState.verifiedLocation;
    if (!loc) return;

    const locCard = document.getElementById('scLocationCard');
    if (locCard) locCard.style.display = 'block';

    const pinEl = document.getElementById('scLocPincode');
    const stateEl = document.getElementById('scLocState');
    const districtEl = document.getElementById('scLocDistrict');
    const poSelect = document.getElementById('scLocPostOfficeSelect');
    const subtitleEl = document.getElementById('scLocSubtitle');

    if (pinEl) pinEl.innerText = loc.pincode;
    if (stateEl) stateEl.innerText = loc.state;
    if (districtEl) districtEl.innerText = loc.district;
    if (subtitleEl) subtitleEl.innerText = `PIN code ${loc.pincode} is a valid Indian postal location.`;

    if (poSelect && loc.postOffices) {
      poSelect.innerHTML = loc.postOffices.map(po => {
        const isSelected = po.name === scState.selectedPostOffice ? 'selected' : '';
        return `<option value="${escapeHtml(po.name)}" ${isSelected}>${escapeHtml(po.name)} (${po.branchType})</option>`;
      }).join('');

      poSelect.onchange = (e) => {
        scState.selectedPostOffice = e.target.value;
        loadDemoDashboard(loc.pincode, scState.selectedPostOffice);
      };
    }
  }

  /**
   * Render Overview Metrics Cards
   */
  function renderOverviewMetrics(overview) {
    if (!overview) return;

    // Status card
    const statusVal = document.getElementById('scStatusValue');
    const lastTested = document.getElementById('scLastSampleDate');
    const totalSamples = document.getElementById('scTotalSamples');

    if (statusVal) statusVal.innerText = overview.statusLabel || 'Safe';
    if (lastTested) lastTested.innerText = overview.lastSampleTested || '12 Aug 2024';
    if (totalSamples) totalSamples.innerText = overview.sampleCount || '5';

    // Parameters
    const p = overview.parameters || {};
    if (p.ph) {
      const phVal = document.getElementById('scMetricPhVal');
      const phRange = document.getElementById('scMetricPhRange');
      const phBadge = document.getElementById('scMetricPhBadge');
      if (phVal) phVal.innerText = p.ph.value;
      if (phRange) phRange.innerText = `(${p.ph.safeRange})`;
      if (phBadge) {
        phBadge.innerText = p.ph.status;
        phBadge.className = `sc-metric-badge ${p.ph.badgeClass || 'badge-safe'}`;
      }
    }

    if (p.tds) {
      const tdsVal = document.getElementById('scMetricTdsVal');
      const tdsRange = document.getElementById('scMetricTdsRange');
      const tdsBadge = document.getElementById('scMetricTdsBadge');
      if (tdsVal) tdsVal.innerText = p.tds.value;
      if (tdsRange) tdsRange.innerText = `(${p.tds.safeRange})`;
      if (tdsBadge) {
        tdsBadge.innerText = p.tds.status;
        tdsBadge.className = `sc-metric-badge ${p.tds.badgeClass || 'badge-safe'}`;
      }
    }

    if (p.temperature) {
      const tempVal = document.getElementById('scMetricTempVal');
      const tempBadge = document.getElementById('scMetricTempBadge');
      if (tempVal) tempVal.innerText = p.temperature.value;
      if (tempBadge) {
        tempBadge.innerText = p.temperature.status;
        tempBadge.className = `sc-metric-badge ${p.temperature.badgeClass || 'badge-safe'}`;
      }
    }

    if (p.turbidity) {
      const turbVal = document.getElementById('scMetricTurbVal');
      const turbRange = document.getElementById('scMetricTurbRange');
      const turbBadge = document.getElementById('scMetricTurbBadge');
      if (turbVal) turbVal.innerText = p.turbidity.value;
      if (turbRange) turbRange.innerText = `(${p.turbidity.safeRange})`;
      if (turbBadge) {
        turbBadge.innerText = p.turbidity.status;
        turbBadge.className = `sc-metric-badge ${p.turbidity.badgeClass || 'badge-safe'}`;
      }
    }
  }

  /**
   * Render Testing History Table
   */
  function renderTestingHistory(history) {
    const tbody = document.getElementById('scHistoryTbody');
    if (!tbody || !history) return;

    tbody.innerHTML = history.map((item, idx) => `
      <tr>
        <td style="font-weight:600; color:var(--text-light);">${idx + 1}</td>
        <td><strong>${escapeHtml(item.sampleDate)}</strong></td>
        <td>${escapeHtml(item.sourceStation)}</td>
        <td>${item.ph}</td>
        <td>${item.tds}</td>
        <td>${item.temp}</td>
        <td>${item.turbidity}</td>
        <td><span class="badge ${item.badgeClass || 'badge-safe'}">${escapeHtml(item.status)}</span></td>
      </tr>
    `).join('');
  }

  /**
   * Draw pH Trend Canvas Chart
   */
  function drawPhTrendChart() {
    const canvas = document.getElementById('scPhTrendCanvas');
    if (!canvas) return;

    // Adjust canvas resolution for high DPI displays
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width > 50 ? rect.width : 340;
    const height = 200;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
    const textColor = isDark ? '#a1a1a6' : '#6e6e73';
    const primaryColor = '#0071e3';

    ctx.clearRect(0, 0, width, height);

    const padL = 36;
    const padR = 24;
    const padT = 24;
    const padB = 32;

    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    // Y Axis Scale: 5 to 9 pH
    const minY = 5;
    const maxY = 9;
    const yTicks = [5, 7, 9];

    // Draw horizontal grid lines and Y-axis labels
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    yTicks.forEach(val => {
      const y = padT + plotH - ((val - minY) / (maxY - minY)) * plotH;
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(width - padR, y);
      ctx.stroke();

      ctx.fillText(String(val), padL - 8, y);
    });

    const dataPoints = scState.demoDashboard?.trendData || [
      { label: 'Nov 23', ph: 7.1 },
      { label: 'Feb 24', ph: 6.8 },
      { label: 'May 24', ph: 7.4 },
      { label: 'Aug 24', ph: 7.2 }
    ];

    if (!dataPoints || dataPoints.length === 0) return;

    const stepX = plotW / (dataPoints.length - 1);
    const coords = dataPoints.map((pt, i) => {
      const x = padL + i * stepX;
      const y = padT + plotH - ((pt.ph - minY) / (maxY - minY)) * plotH;
      return { x, y, ...pt };
    });

    // Draw area fill under line
    ctx.beginPath();
    ctx.moveTo(coords[0].x, coords[0].y);
    coords.forEach(pt => ctx.lineTo(pt.x, pt.y));
    ctx.lineTo(coords[coords.length - 1].x, padT + plotH);
    ctx.lineTo(coords[0].x, padT + plotH);
    ctx.closePath();
    ctx.fillStyle = isDark ? 'rgba(0, 113, 227, 0.18)' : 'rgba(0, 113, 227, 0.08)';
    ctx.fill();

    // Draw smooth line
    ctx.beginPath();
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    coords.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();

    // Draw dots and X-axis labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    coords.forEach(pt => {
      // Dot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fill();

      // X Label
      ctx.fillStyle = textColor;
      ctx.fillText(pt.label, pt.x, padT + plotH + 8);
    });
  }

  /**
   * Render Nearby Laboratories Cards
   */
  function renderLaboratories(labs) {
    const container = document.getElementById('scLabsContainer');
    if (!container || !labs) return;

    container.innerHTML = labs.map(lab => `
      <div class="sc-lab-card">
        <div>
          <div class="sc-lab-top">
            <div class="sc-lab-icon">${lab.typeIcon || '🔬'}</div>
            <div class="sc-lab-name-wrap">
              <h4>${escapeHtml(lab.name)} <span class="sc-lab-demo-pill">Demo</span></h4>
              <div class="sc-lab-meta">
                <div class="sc-lab-meta-item">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  <span>${escapeHtml(lab.distance)}</span>
                </div>
                <div class="sc-lab-meta-item">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="22.01"></line><line x1="15" y1="22" x2="15" y2="22.01"></line></svg>
                  <span>${escapeHtml(lab.type)}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="sc-lab-tags">
            ${lab.parameters.map(param => `<span class="sc-lab-tag">${escapeHtml(param)}</span>`).join('')}
          </div>
        </div>

        <div class="sc-lab-actions">
          <button class="btn btn-secondary sc-lab-btn" onclick="window.safetyChecker.openLabDetails('${lab.id}')">View Details</button>
          <button class="btn btn-primary sc-lab-btn" onclick="window.safetyChecker.selectLabForBooking('${lab.id}')">Book Test</button>
        </div>
      </div>
    `).join('');
  }

  /**
   * Open Lab Details Modal
   */
  function openLabDetails(labId) {
    const lab = scState.allLabs.find(l => l.id === labId);
    if (!lab) return;

    const modalTitle = document.getElementById('scLabModalTitle');
    const modalType = document.getElementById('scLabModalType');
    const modalDist = document.getElementById('scLabModalDistance');
    const modalAddr = document.getElementById('scLabModalAddress');
    const modalAccred = document.getElementById('scLabModalAccreditation');
    const modalParams = document.getElementById('scLabModalParams');
    const modalDesc = document.getElementById('scLabModalDesc');
    const modalBookBtn = document.getElementById('scLabModalBookBtn');

    if (modalTitle) modalTitle.innerText = lab.name;
    if (modalType) modalType.innerText = lab.type;
    if (modalDist) modalDist.innerText = `${lab.distance} (Simulated Demo Distance)`;
    if (modalAddr) modalAddr.innerText = lab.address;
    if (modalAccred) modalAccred.innerText = lab.accreditation;
    if (modalDesc) modalDesc.innerText = lab.description;
    if (modalParams) {
      modalParams.innerHTML = lab.parameters.map(p => `<span class="badge badge-info" style="margin-right:0.35rem;">${escapeHtml(p)}</span>`).join('');
    }

    if (modalBookBtn) {
      modalBookBtn.onclick = () => {
        closeModal('modalScLabDetails');
        selectLabForBooking(labId);
      };
    }

    openModal('modalScLabDetails');
  }

  /**
   * Pre-fill booking form with selected Lab
   */
  function selectLabForBooking(labId) {
    const lab = scState.allLabs.find(l => l.id === labId);
    if (!lab) return;

    scState.selectedLabForBooking = lab;
    const notesInput = document.getElementById('scBookingNotes');
    if (notesInput && !notesInput.value.includes(lab.name)) {
      notesInput.value = `Selected Laboratory: ${lab.name} (${lab.type})\n${notesInput.value}`.trim();
    }

    const bookingSection = document.getElementById('scBookingSection');
    if (bookingSection) {
      bookingSection.scrollIntoView({ behavior: 'smooth' });
    }

    if (window.showToast) {
      window.showToast(`Selected "${lab.name}" for your test request.`, 'info');
    }
  }

  /**
   * Handle Demo Booking Submission
   */
  async function handleBookingSubmit(e) {
    e.preventDefault();

    const nameInput = document.getElementById('scBookingName');
    const phoneInput = document.getElementById('scBookingPhone');
    const sourceInput = document.getElementById('scBookingSource');
    const dateInput = document.getElementById('scBookingDate');
    const notesInput = document.getElementById('scBookingNotes');
    const submitBtn = document.getElementById('scBookingSubmitBtn');

    const fullName = nameInput ? nameInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const waterSource = sourceInput ? sourceInput.value : '';
    const preferredDate = dateInput ? dateInput.value : '';
    const notes = notesInput ? notesInput.value.trim() : '';

    if (!fullName) {
      if (window.showToast) window.showToast('Please enter your full name.', 'error');
      nameInput?.focus();
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      if (window.showToast) window.showToast('Please enter a valid 10-digit phone number.', 'error');
      phoneInput?.focus();
      return;
    }

    if (!waterSource) {
      if (window.showToast) window.showToast('Please select a water source type.', 'error');
      sourceInput?.focus();
      return;
    }

    if (!preferredDate) {
      if (window.showToast) window.showToast('Please select a preferred testing date.', 'error');
      dateInput?.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Submitting Request...';
    }

    try {
      const payload = {
        fullName,
        phone: cleanPhone,
        pincode: scState.currentPincode,
        postalLocation: `${scState.selectedPostOffice || 'Local Area'}, ${scState.verifiedLocation?.district || ''}, ${scState.verifiedLocation?.state || ''}`.trim(),
        waterSource,
        preferredDate,
        notes,
        labId: scState.selectedLabForBooking?.id || 'LAB-001',
        labName: scState.selectedLabForBooking?.name || 'Mahabubnagar Govt. Lab'
      };

      let bookingRecord = null;

      try {
        const res = await fetch('/api/safety-checker/book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const text = await res.text();
        if (text && !text.trim().startsWith('<')) {
          const data = JSON.parse(text);
          if (res.ok && data.success && data.booking) {
            bookingRecord = data.booking;
          }
        }
      } catch (bkErr) {
        console.warn('Backend booking failed or returned non-JSON, using local demo confirmation:', bkErr);
      }

      // Client-side demo fallback booking
      if (!bookingRecord) {
        bookingRecord = {
          bookingReference: `DEMO-BK-${Math.floor(100000 + Math.random() * 900000)}`,
          fullName: payload.fullName,
          postalLocation: payload.postalLocation,
          pincode: payload.pincode,
          waterSource: payload.waterSource,
          preferredDate: payload.preferredDate,
          labName: payload.labName,
          isDemo: true,
          dataSource: 'DEMO'
        };
      }

      // Show Confirmation Modal
      showBookingConfirmationModal(bookingRecord);

      // Reset form
      if (nameInput) nameInput.value = '';
      if (phoneInput) phoneInput.value = '';
      if (notesInput) notesInput.value = '';
      scState.selectedLabForBooking = null;

    } catch (err) {
      console.error('Booking submission error:', err);
      if (window.showToast) window.showToast(err.message, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Submit Booking Request';
      }
    }
  }

  /**
   * Display Confirmation Modal for Demo Booking
   */
  function showBookingConfirmationModal(booking) {
    const codeEl = document.getElementById('scConfirmRefCode');
    const nameEl = document.getElementById('scConfirmName');
    const locEl = document.getElementById('scConfirmLocation');
    const sourceEl = document.getElementById('scConfirmSource');
    const dateEl = document.getElementById('scConfirmDate');
    const labEl = document.getElementById('scConfirmLab');

    if (codeEl) codeEl.innerText = booking.bookingReference;
    if (nameEl) nameEl.innerText = booking.fullName;
    if (locEl) locEl.innerText = `${booking.postalLocation} (PIN: ${booking.pincode})`;
    if (sourceEl) sourceEl.innerText = booking.waterSource;
    if (dateEl) dateEl.innerText = booking.preferredDate;
    if (labEl) labEl.innerText = booking.labName;

    openModal('modalScBookingSuccess');
  }

  /**
   * Change PIN button click: reset to search view
   */
  function changePin() {
    const pinInput = document.getElementById('scPinInput');
    if (pinInput) {
      pinInput.value = '';
      pinInput.focus();
    }
    hideDashboardSections();
    hideStatusMessage();
  }

  function showDashboardSections() {
    const ids = ['scOverviewSection', 'scHistorySection', 'scLabsSection', 'scBookingSection'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'block';
    });
  }

  function hideDashboardSections() {
    const ids = ['scLocationCard', 'scOverviewSection', 'scHistorySection', 'scLabsSection', 'scBookingSection'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }

  function showStatusMessage(msg, type) {
    const msgEl = document.getElementById('scStatusMessage');
    if (!msgEl) return;
    msgEl.className = `sc-status-message ${type}`;
    msgEl.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        ${type === 'success' 
          ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>' 
          : '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'}
      </svg>
      <span>${escapeHtml(msg)}</span>
    `;
    msgEl.style.display = 'flex';
  }

  function hideStatusMessage() {
    const msgEl = document.getElementById('scStatusMessage');
    if (msgEl) msgEl.style.display = 'none';
  }

  function openAllHistoryModal() {
    openModal('modalScAllHistory');
  }

  function openAllLabsModal() {
    openModal('modalScAllLabs');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Export to window
  window.safetyChecker = {
    init,
    performLookup,
    changePin,
    openLabDetails,
    selectLabForBooking,
    openAllHistoryModal,
    openAllLabsModal,
    drawPhTrendChart
  };

})();
