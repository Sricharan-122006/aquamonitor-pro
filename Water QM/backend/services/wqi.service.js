/**
 * Water Quality Index (WQI) Calculation Service
 * Uses standard Weighted Arithmetic Index Method (Brown et al. / WHO / BIS guidelines)
 */

function calculateWQI({ ph, turbidity, temperature, dissolvedOxygen, tds, conductivity }) {
  // Unit Weights
  const weights = {
    ph: 0.25,
    turbidity: 0.20,
    dissolvedOxygen: 0.25,
    tds: 0.15,
    conductivity: 0.10,
    temperature: 0.05
  };

  // Sub-index calculations (0 to 100, where 100 is best quality)
  // 1. pH sub-index (ideal 7.0, acceptable 6.5 - 8.5)
  let q_ph = 100;
  if (ph < 7.0) {
    q_ph = Math.max(0, 100 - (7.0 - ph) * 60);
  } else {
    q_ph = Math.max(0, 100 - (ph - 7.0) * 60);
  }

  // 2. Turbidity sub-index (ideal 0, acceptable 0-50, critical > 100)
  let q_turb = 100;
  if (turbidity > 0) {
    q_turb = Math.max(0, 100 - (turbidity / 100) * 80);
  }

  // 3. Dissolved Oxygen (ideal >= 8.5 mg/L, acceptable >= 5.0 mg/L)
  let q_do = 100;
  if (dissolvedOxygen < 8.5) {
    q_do = Math.max(0, (dissolvedOxygen / 8.5) * 100);
  }

  // 4. TDS sub-index (ideal <= 250 ppm, acceptable <= 500 ppm)
  let q_tds = 100;
  if (tds > 250) {
    q_tds = Math.max(0, 100 - ((tds - 250) / 750) * 100);
  }

  // 5. Conductivity sub-index (ideal 250 µS/cm, acceptable <= 800)
  let condVal = conductivity || 250;
  let q_cond = 100;
  if (condVal > 250) {
    q_cond = Math.max(0, 100 - ((condVal - 250) / 750) * 100);
  }

  // 6. Temperature sub-index (ideal 18-24°C)
  let tempVal = temperature || 22;
  let q_temp = 100;
  if (tempVal > 25) {
    q_temp = Math.max(0, 100 - (tempVal - 25) * 8);
  } else if (tempVal < 10) {
    q_temp = Math.max(0, 100 - (10 - tempVal) * 8);
  }

  const weightedSum =
    (q_ph * weights.ph) +
    (q_turb * weights.turbidity) +
    (q_do * weights.dissolvedOxygen) +
    (q_tds * weights.tds) +
    (q_cond * weights.conductivity) +
    (q_temp * weights.temperature);

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const rawWQI = Math.round(weightedSum / totalWeight);
  const wqi = Math.max(10, Math.min(100, rawWQI));

  let status = 'Safe';
  if (wqi < 50 || ph < 5.5 || ph > 9.0 || dissolvedOxygen < 3.5 || tds > 750) {
    status = 'Alert';
  } else if (wqi < 70 || turbidity > 45 || tds > 450 || ph < 6.5 || ph > 8.5) {
    status = 'Caution';
  }

  return { wqi, status };
}

module.exports = {
  calculateWQI
};
