/**
 * JalSaathi Hardware Simulation Lab - Three.js Engine
 * Accurately modeling the ESP-WROOM-32 Water Quality Telemetry Rig
 * Based on Reference Images 1 & 2
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ==========================================
// SIMULATION STATE
// ==========================================
export const simState = {
  running: true,
  paused: false,
  exploded: false,
  showLabels: true,
  showDataFlow: true,
  activeLcdScreen: 0, // 0: Live, 1: Diagnostics, 2: SD Log, 3: Network/System
  selectedComponent: 'esp32',
  
  // Simulated Sensor Readings (Illustrative demonstration values)
  readings: {
    ph: 7.20,
    tds: 320,
    turbidity: 4.5,
    temp: 26.4
  },
  
  // SD Card Simulated Logger
  sdLoggingEnabled: true,
  logIntervalSec: 2,
  logRecords: [],
  recordCounter: 0,
  
  // Hardware status indicators
  esp32TxBlink: false,
  wifiConnected: true,
  systemInitDone: true
};

// Component Metadata for Technical Inspection & Accuracy Notes
export const COMPONENT_CATALOG = {
  esp32: {
    id: 'esp32',
    name: 'ESP-WROOM-32 Development Board',
    category: 'Microcontroller / SoC',
    description: 'Dual-core Xtensa 32-bit LX6 microcontroller with integrated 2.4 GHz Wi-Fi and Bluetooth LE. Acts as the central telemetry master collecting multi-sensor analog/digital inputs, driving the 20x4 I2C LCD, logging to SPI Micro-SD, and transmitting payloads to Firebase/Cloud.',
    interfaces: 'SPI (VSPI), I2C, Multi-channel SAR ADC, GPIOs, UART, Micro-USB',
    pinout: [
      { pin: '3V3 / VIN', target: 'Breadboard Power Rails (3.3V / 5.0V Input)' },
      { pin: 'GND', target: 'Common Ground Rail' },
      { pin: 'GPIO 21 (SDA)', target: '20x4 LCD I2C Backpack SDA' },
      { pin: 'GPIO 22 (SCL)', target: '20x4 LCD I2C Backpack SCL' },
      { pin: 'GPIO 18 (SCK)', target: 'Micro-SD SPI SCK & MAX6675 SCK' },
      { pin: 'GPIO 19 (MISO)', target: 'Micro-SD SPI MISO & MAX6675 SO' },
      { pin: 'GPIO 23 (MOSI)', target: 'Micro-SD SPI MOSI' },
      { pin: 'GPIO 5 (CS)', target: 'Micro-SD SPI Chip Select' },
      { pin: 'GPIO 12 (CS_T)', target: 'MAX6675 Thermocouple Chip Select' },
      { pin: 'GPIO 36 / 39 / 25', target: 'Turbidity, pH & TDS Analog ADC inputs' },
      { pin: 'GPIO 32, 33, 34, 35', target: '4 Navigation Push Buttons (with 10k pulldowns)' }
    ],
    techNote: 'Educational Note: ESP32 ADC inputs have non-linear attenuation below 0.1V and above 3.1V. Prototype firmware applies multi-point polynomial calibration.'
  },
  breadboard: {
    id: 'breadboard',
    name: '830-Point Solderless Breadboard',
    category: 'Prototyping Platform',
    description: 'Full-size solderless breadboard providing 630 tie-point terminal matrix with center IC ravine and dual 100 tie-point distribution power buses (+ and - rails) along top and bottom.',
    interfaces: '2.54mm (0.1") Pitch Grid Contacts',
    pinout: [
      { pin: 'Top Red (+)', target: '5V Regulated USB / System Power Bus' },
      { pin: 'Top Blue (-)', target: 'System Ground (GND) Bus' },
      { pin: 'Bottom Red (+)', target: '3.3V LDO Output Bus' },
      { pin: 'Bottom Blue (-)', target: 'Pulldown Ground Bus for Buttons' }
    ],
    techNote: 'Ensure solid mechanical contact. High-speed SPI lines (SD card) benefit from short jumper wire lengths to prevent signal degradation.'
  },
  ph_module: {
    id: 'ph_module',
    name: 'pH Sensor Signal Conditioning Module',
    category: 'Analog Sensor Interface',
    description: 'High-impedance analog amplifier PCB converting millivolt potential from the glass electrode probe into a 0–3.3V/5V analog voltage proportional to pH 0–14.',
    interfaces: 'BNC Coaxial Input (pH Probe), 3-pin Header (VCC, GND, Po)',
    pinout: [
      { pin: 'VCC', target: '5V / 3.3V Power Bus' },
      { pin: 'GND', target: 'Common Ground' },
      { pin: 'Po (Analog)', target: 'ESP32 ADC Pin (GPIO 39 / VN)' },
      { pin: 'BNC Jack', target: 'Glass Combination pH Electrode' }
    ],
    techNote: 'Features an onboard multi-turn offset trim potentiometer to adjust the neutral pH 7.0 (approx 2.5V reference) calibration point.'
  },
  tds_module: {
    id: 'tds_module',
    name: 'TDS Meter Module V1.0 SB',
    category: 'Analog Sensor Interface',
    description: 'Total Dissolved Solids interface module generating an alternating excitation signal to prevent probe polarization while measuring electrical conductivity (EC).',
    interfaces: '2-pin XH2.54 / Terminal (Probe), 3-pin Header (VCC, GND, Analog)',
    pinout: [
      { pin: 'VCC', target: '3.3V / 5.0V Power Bus' },
      { pin: 'GND', target: 'Common Ground' },
      { pin: 'Signal (A)', target: 'ESP32 ADC Pin (GPIO 25)' },
      { pin: 'Probe Port', target: 'Dual-pin Titanium / Stainless TDS Probe' }
    ],
    techNote: 'TDS readings are temperature-dependent (~2% per °C). In this rig, MAX6675 temperature readings provide software compensation.'
  },
  turbidity_module: {
    id: 'turbidity_module',
    name: 'Turbidity Sensor Interface Module',
    category: 'Optical Sensor Interface',
    description: 'Optical signal conditioning PCB pairing with an infrared emitter/phototransistor probe to quantify suspended particulate matter via light scattering/attenuation.',
    interfaces: '3-pin Probe Header, 3/4-pin Controller Header (VCC, GND, A, D)',
    pinout: [
      { pin: 'VCC', target: '5V Power Bus' },
      { pin: 'GND', target: 'Common Ground' },
      { pin: 'A (Analog)', target: 'ESP32 ADC Pin (GPIO 36 / VP)' },
      { pin: 'Probe Jack', target: 'Submersible Turbidity Probe Head' }
    ],
    techNote: 'Reference Diagram Clarification: The provided system block diagram erroneously labeled this module as a duplicate "TDS Sensor Module". It is accurately modeled here as the Turbidity Interface.'
  },
  max6675: {
    id: 'max6675',
    name: 'MAX6675 Type-K Thermocouple Module',
    category: 'Digital Thermal Converter',
    description: 'Precision 12-bit analog-to-digital converter with cold-junction compensation specifically designed for Type-K thermocouples. Communicates via SPI read-only protocol.',
    interfaces: '2-Position Screw Terminal (+ and -), 5-pin Header (GND, VCC, SCK, CS, SO)',
    pinout: [
      { pin: 'GND & VCC', target: 'Common Ground & 3.3V Power' },
      { pin: 'SCK (Clock)', target: 'ESP32 SPI SCK (GPIO 14 / 18)' },
      { pin: 'CS (Chip Select)', target: 'ESP32 GPIO 12' },
      { pin: 'SO (Data Out)', target: 'ESP32 SPI MISO (GPIO 13 / 19)' },
      { pin: 'Green Screw Term', target: 'Braided Stainless Steel Thermocouple' }
    ],
    techNote: 'Operates in read-only SPI mode. Thermocouple leads are polarized: yellow/red leads connect to respective positive/negative terminals.'
  },
  sd_module: {
    id: 'sd_module',
    name: 'Micro-SD Card SPI Module',
    category: 'Storage / Data Logging',
    description: 'Flash storage module supporting FAT16/FAT32 formatted Micro-SD cards for offline telemetry logging, network outage buffer caching, and CSV file export.',
    interfaces: 'SPI Bus (CS, SCK, MOSI, MISO, VCC, GND)',
    pinout: [
      { pin: 'CS (Chip Select)', target: 'ESP32 GPIO 5' },
      { pin: 'SCK (Clock)', target: 'ESP32 GPIO 18' },
      { pin: 'MOSI (Master Out)', target: 'ESP32 GPIO 23' },
      { pin: 'MISO (Master In)', target: 'ESP32 GPIO 19' },
      { pin: 'VCC & GND', target: '3.3V / 5V Regulated & Common Ground' }
    ],
    techNote: 'Simulated SD Logging is active. Records are buffered in memory and can be exported as a realistic water quality telemetry CSV dataset.'
  },
  lcd_i2c: {
    id: 'lcd_i2c',
    name: '20×4 Character LCD with I2C Backpack',
    category: 'Visual Display Interface',
    description: 'High-contrast 20 column by 4 row alphanumeric liquid crystal display equipped with a PCF8574 I2C expander backpack, minimizing GPIO overhead to two wires.',
    interfaces: 'I2C Bus (SDA, SCL, VCC, GND)',
    pinout: [
      { pin: 'GND', target: 'Breadboard Ground Rail' },
      { pin: 'VCC', target: '5V Regulated Power Rail' },
      { pin: 'SDA (Data)', target: 'ESP32 GPIO 21' },
      { pin: 'SCL (Clock)', target: 'ESP32 GPIO 22' }
    ],
    techNote: 'Default I2C address is typically 0x27 or 0x3F. In this simulation, screen content dynamically renders across 4 interactive diagnostic screens.'
  },
  push_buttons: {
    id: 'push_buttons',
    name: '4x Navigation Push Buttons & 10kΩ Pulldowns',
    category: 'User Interface / Input',
    description: 'Four 6x6mm tactile momentary switches wired with 10kΩ pulldown resistors to ground, providing bounce-free active-HIGH digital triggers to cycle LCD screens.',
    interfaces: '4x Digital Inputs to ESP32 GPIOs 32, 33, 34, 35',
    pinout: [
      { pin: 'SW1 (Prev Screen)', target: 'ESP32 GPIO 34 (Active HIGH)' },
      { pin: 'SW2 (Next Screen)', target: 'ESP32 GPIO 35 (Active HIGH)' },
      { pin: 'SW3 (Select/Action)', target: 'ESP32 GPIO 32 (Active HIGH)' },
      { pin: 'SW4 (Menu/Back)', target: 'ESP32 GPIO 33 (Active HIGH)' },
      { pin: 'Resistors (4x 10kΩ)', target: 'Pulldown connection to Blue GND Rail' }
    ],
    techNote: 'Clicking the physical 3D button caps or the on-screen buttons triggers realistic tactile depression animations and switches LCD screens.'
  },
  water_sample: {
    id: 'water_sample',
    name: 'Water Sample Container & Immersed Probes',
    category: 'Sample Environment & Probes',
    description: 'Graduated laboratory beaker holding the water sample under test, with all 4 sensing probes securely immersed for telemetry acquisition.',
    interfaces: 'Direct Physical / Fluid Immersion',
    pinout: [
      { pin: 'pH Glass Probe', target: 'Immersed bulb with BNC cable to pH module' },
      { pin: 'TDS Dual Pin', target: 'Immersed titanium electrodes to TDS module' },
      { pin: 'Turbidity Optical', target: 'Immersed U-notch optical gap to Turbidity PCB' },
      { pin: 'Type-K Probe', target: 'Stainless steel sheath to MAX6675 module' }
    ],
    techNote: 'Safety Isolation Note: Electronic circuit boards, breadboards, and power headers remain physically isolated and elevated away from the liquid sample.'
  }
};

// 3D Scene Variables
let scene, camera, renderer, controls;
let containerEl;
let animationFrameId;
let clock;
let raycaster, mouse;
let hoveredObject = null;
let selectedObject = null;

// Mesh Registry for Interactive Selection & Exploded View
const interactiveMeshes = [];
const componentGroups = {};
const dataFlowParticles = [];
let lcdCanvasTexture = null;
let lcd2DContext = null;
let txLedMesh = null;
const buttonMeshes = [];

// Sound Synthesizer (AudioContext for realistic button clicks)
let audioCtx = null;
function playClickSound(freq = 650, duration = 0.03) {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + duration);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    // Ignore audio restriction errors
  }
}

// ==========================================
// INITIALIZE 3D LAB
// ==========================================
export function initHardwareLab() {
  containerEl = document.getElementById('hardwareLabCanvasContainer');
  if (!containerEl) return;

  // Clean up any existing instances
  if (renderer) {
    cancelAnimationFrame(animationFrameId);
    renderer.dispose();
    if (containerEl.contains(renderer.domElement)) {
      containerEl.removeChild(renderer.domElement);
    }
  }

  // Clear registries to prevent duplicate objects on re-navigation
  interactiveMeshes.length = 0;
  buttonMeshes.length = 0;
  dataFlowParticles.length = 0;
  for (const k in componentGroups) delete componentGroups[k];

  clock = new THREE.Clock();
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  // 1. Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1117);
  scene.fog = new THREE.FogExp2(0x0e1117, 0.015);

  // 2. Camera
  const width = Math.max(containerEl.clientWidth || 0, 800);
  const height = Math.max(containerEl.clientHeight || 0, 540);
  const aspect = width / height;
  camera = new THREE.PerspectiveCamera(46, aspect, 0.1, 100);
  camera.position.set(1.5, 15, 20);

  // 3. Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  containerEl.appendChild(renderer.domElement);

  // 4. OrbitControls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI / 2.05; // Prevent camera sinking under table
  controls.minDistance = 6;
  controls.maxDistance = 50;
  controls.target.set(1.5, 0.5, 0);
  camera.lookAt(controls.target);
  controls.update();
  controls.saveState();

  // 5. Lighting Setup
  setupLighting();

  // 6. Build 3D Models
  buildWorkbench();
  buildBreadboard();
  buildESP32();
  buildButtonsAndResistors();
  buildTopModules();
  buildBottomModules();
  buildWaterSampleAndProbes();
  buildJumperWires();
  buildDataFlowParticles();

  // 7. Event Listeners
  setupInteractionListeners();

  // 8. Start Animation Loop
  animate();

  // 9. Start Simulation Telemetry Cycle
  startTelemetryCycle();

  // Initial update of inspector and 2D UI
  updateInspectorPanel(simState.selectedComponent);
  updateLcdDisplay();
  updateSdTableUI();
  updateSensorControlsUI();
}

// ==========================================
// LIGHTING SETUP
// ==========================================
function setupLighting() {
  const ambient = new THREE.AmbientLight(0xffffff, 0.85);
  scene.add(ambient);

  const mainDirLight = new THREE.DirectionalLight(0xfff8ee, 1.6);
  mainDirLight.position.set(10, 24, 14);
  mainDirLight.castShadow = true;
  mainDirLight.shadow.mapSize.width = 2048;
  mainDirLight.shadow.mapSize.height = 2048;
  mainDirLight.shadow.camera.near = 0.5;
  mainDirLight.shadow.camera.far = 50;
  mainDirLight.shadow.camera.left = -16;
  mainDirLight.shadow.camera.right = 16;
  mainDirLight.shadow.camera.top = 16;
  mainDirLight.shadow.camera.bottom = -16;
  mainDirLight.shadow.bias = -0.0004;
  scene.add(mainDirLight);

  const fillLight = new THREE.DirectionalLight(0x90caf9, 0.7);
  fillLight.position.set(-14, 18, -10);
  scene.add(fillLight);

  const softRimLight = new THREE.DirectionalLight(0x38bdf8, 0.5);
  softRimLight.position.set(0, 10, -18);
  scene.add(softRimLight);
}

// ==========================================
// 3D MODELS: WORKBENCH & MAT
// ==========================================
function buildWorkbench() {
  // Electronics ESD Bench Mat
  const matGeo = new THREE.BoxGeometry(38, 0.4, 26);
  const matMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.75,
    metalness: 0.1
  });
  const matMesh = new THREE.Mesh(matGeo, matMat);
  matMesh.position.y = -0.2;
  matMesh.receiveShadow = true;
  scene.add(matMesh);

  // Bench Grid Lines (Subtle electronics measurement grid)
  const gridHelper = new THREE.GridHelper(36, 36, 0x334155, 0x1e293b);
  gridHelper.position.y = 0.02;
  scene.add(gridHelper);
}

// ==========================================
// 3D MODELS: BREADBOARD
// ==========================================
function buildBreadboard() {
  const group = new THREE.Group();
  group.name = 'breadboard_group';
  componentGroups['breadboard'] = group;

  // Breadboard Body (Off-white / cream ABS plastic)
  const bodyGeo = new THREE.BoxGeometry(17.2, 0.85, 6.4);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xf1f1ee,
    roughness: 0.55,
    metalness: 0.05
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.set(0, 0.425, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  body.userData = { componentId: 'breadboard' };
  interactiveMeshes.push(body);
  group.add(body);

  // Center Ravine / IC Divider
  const ravineGeo = new THREE.BoxGeometry(16.6, 0.25, 0.35);
  const ravineMat = new THREE.MeshStandardMaterial({ color: 0xd6d6d2, roughness: 0.8 });
  const ravine = new THREE.Mesh(ravineGeo, ravineMat);
  ravine.position.set(0, 0.75, 0);
  group.add(ravine);

  // Power Rails Colored Lines (Top & Bottom Red / Blue lines)
  const railGeo = new THREE.BoxGeometry(16.4, 0.02, 0.06);
  const redMat = new THREE.MeshBasicMaterial({ color: 0xdc2626 });
  const blueMat = new THREE.MeshBasicMaterial({ color: 0x2563eb });

  // Top rails
  const topRed = new THREE.Mesh(railGeo, redMat);
  topRed.position.set(0, 0.86, -2.75);
  group.add(topRed);
  const topBlue = new THREE.Mesh(railGeo, blueMat);
  topBlue.position.set(0, 0.86, -2.45);
  group.add(topBlue);

  // Bottom rails
  const btmBlue = new THREE.Mesh(railGeo, blueMat);
  btmBlue.position.set(0, 0.86, 2.45);
  group.add(btmBlue);
  const btmRed = new THREE.Mesh(railGeo, redMat);
  btmRed.position.set(0, 0.86, 2.75);
  group.add(btmRed);

  // Tie-Point Holes Pattern (Realistic pin holes grid)
  const holeGeo = new THREE.BoxGeometry(0.12, 0.05, 0.12);
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x475569 });
  const instancedHoles = new THREE.InstancedMesh(holeGeo, holeMat, 320);
  let idx = 0;
  const dummy = new THREE.Object3D();

  // Sample holes along the board
  for (let x = -7.8; x <= 7.8; x += 0.52) {
    // 5 rows above ravine
    for (let z = -2.1; z <= -0.5; z += 0.4) {
      if (idx < 320) {
        dummy.position.set(x, 0.85, z);
        dummy.updateMatrix();
        instancedHoles.setMatrixAt(idx++, dummy.matrix);
      }
    }
    // 5 rows below ravine
    for (let z = 0.5; z <= 2.1; z += 0.4) {
      if (idx < 320) {
        dummy.position.set(x, 0.85, z);
        dummy.updateMatrix();
        instancedHoles.setMatrixAt(idx++, dummy.matrix);
      }
    }
  }
  instancedHoles.instanceMatrix.needsUpdate = true;
  group.add(instancedHoles);

  scene.add(group);
}

// ==========================================
// 3D MODELS: ESP-WROOM-32
// ==========================================
function buildESP32() {
  const group = new THREE.Group();
  group.name = 'esp32_group';
  group.position.set(-4.6, 0.85, 0);
  componentGroups['esp32'] = group;

  // PCB Board (Matte Black)
  const pcbGeo = new THREE.BoxGeometry(5.4, 0.16, 2.8);
  const pcbMat = new THREE.MeshStandardMaterial({
    color: 0x141416,
    roughness: 0.45,
    metalness: 0.2
  });
  const pcb = new THREE.Mesh(pcbGeo, pcbMat);
  pcb.position.y = 0.35;
  pcb.castShadow = true;
  pcb.userData = { componentId: 'esp32' };
  interactiveMeshes.push(pcb);
  group.add(pcb);

  // Metallic RF Shield (ESP-WROOM-32 Can)
  const shieldGeo = new THREE.BoxGeometry(2.0, 0.28, 1.8);
  const shieldMat = new THREE.MeshStandardMaterial({
    color: 0xd4d4d8,
    metalness: 0.9,
    roughness: 0.25
  });
  const shield = new THREE.Mesh(shieldGeo, shieldMat);
  shield.position.set(0.8, 0.55, 0);
  shield.castShadow = true;
  group.add(shield);

  // PCB Antenna Section (Copper/Gold traces at board top)
  const antGeo = new THREE.BoxGeometry(0.8, 0.04, 1.8);
  const antMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.3, metalness: 0.6 });
  const ant = new THREE.Mesh(antGeo, antMat);
  ant.position.set(2.2, 0.45, 0);
  group.add(ant);

  // Micro-USB Port (Left edge)
  const usbGeo = new THREE.BoxGeometry(0.7, 0.35, 0.85);
  const usbMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.2 });
  const usb = new THREE.Mesh(usbGeo, usbMat);
  usb.position.set(-2.6, 0.5, 0);
  group.add(usb);

  // Micro-USB Cable Plugged In
  const usbCableGeo = new THREE.CylinderGeometry(0.2, 0.2, 5.0, 16);
  const usbCableMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 });
  const usbCable = new THREE.Mesh(usbCableGeo, usbCableMat);
  usbCable.rotation.z = Math.PI / 2;
  usbCable.position.set(-5.3, 0.5, 0);
  group.add(usbCable);

  // Power LED (Red) & TX Telemetry LED (Blue)
  const pwrLedGeo = new THREE.BoxGeometry(0.12, 0.1, 0.12);
  const pwrLedMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const pwrLed = new THREE.Mesh(pwrLedGeo, pwrLedMat);
  pwrLed.position.set(-1.4, 0.46, -0.6);
  group.add(pwrLed);

  const txLedMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  txLedMesh = new THREE.Mesh(pwrLedGeo, txLedMat);
  txLedMesh.position.set(-1.4, 0.46, 0.6);
  group.add(txLedMesh);

  // Dual Row Pin Headers (Under PCB plugging into breadboard)
  const pinGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.38, 8);
  const pinMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.2 });
  for (let x = -2.2; x <= 2.2; x += 0.35) {
    const p1 = new THREE.Mesh(pinGeo, pinMat);
    p1.position.set(x, 0.18, -1.25);
    group.add(p1);
    const p2 = new THREE.Mesh(pinGeo, pinMat);
    p2.position.set(x, 0.18, 1.25);
    group.add(p2);
  }

  scene.add(group);
}

// ==========================================
// 3D MODELS: 4 PUSH BUTTONS & 10k RESISTORS
// ==========================================
function buildButtonsAndResistors() {
  const group = new THREE.Group();
  group.name = 'push_buttons_group';
  componentGroups['push_buttons'] = group;

  const btnPositions = [2.2, 3.8, 5.4, 7.0];
  const labels = ['SW1: Prev', 'SW2: Next', 'SW3: Select', 'SW4: Menu'];

  btnPositions.forEach((posX, i) => {
    // Tactile Switch Housing (Black Box)
    const baseGeo = new THREE.BoxGeometry(0.8, 0.35, 0.8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.set(posX, 1.0, 0.8);
    base.userData = { componentId: 'push_buttons', buttonIndex: i };
    interactiveMeshes.push(base);
    group.add(base);

    // Silver Top Plate
    const plateGeo = new THREE.BoxGeometry(0.75, 0.04, 0.75);
    const plateMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.2 });
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.set(posX, 1.18, 0.8);
    group.add(plate);

    // Round Plunger Button Cap (Clickable!)
    const capGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.32, 16);
    const capMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.3
    });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(posX, 1.34, 0.8);
    cap.userData = { componentId: 'push_buttons', buttonIndex: i, isButtonCap: true };
    interactiveMeshes.push(cap);
    buttonMeshes.push(cap);
    group.add(cap);

    // 10k Ohm Pulldown Resistor (Axial through-hole component)
    // Brown, Black, Orange, Gold color bands
    const resGroup = new THREE.Group();
    resGroup.position.set(posX, 0.95, 1.85);

    const resBodyGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.45, 12);
    const resBodyMat = new THREE.MeshStandardMaterial({ color: 0xd6c49e, roughness: 0.7 });
    const resBody = new THREE.Mesh(resBodyGeo, resBodyMat);
    resBody.rotation.x = Math.PI / 2;
    resGroup.add(resBody);

    // Leads to ground bus
    const leadGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8);
    const leadMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.8 });
    const l1 = new THREE.Mesh(leadGeo, leadMat);
    l1.rotation.x = Math.PI / 2;
    l1.position.z = -0.35;
    resGroup.add(l1);
    const l2 = new THREE.Mesh(leadGeo, leadMat);
    l2.rotation.x = Math.PI / 2;
    l2.position.z = 0.35;
    resGroup.add(l2);

    group.add(resGroup);
  });

  scene.add(group);
}

// ==========================================
// 3D MODELS: TOP ROW MODULES (SD, Turbidity, pH, TDS)
// ==========================================
function buildTopModules() {
  // 1. SD-Card Module (Top Left)
  const sdGroup = new THREE.Group();
  sdGroup.name = 'sd_module_group';
  sdGroup.position.set(-6.2, 0.5, -6.2);
  componentGroups['sd_module'] = sdGroup;

  const sdPcbGeo = new THREE.BoxGeometry(2.2, 0.14, 3.4);
  const sdPcbMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4, metalness: 0.2 });
  const sdPcb = new THREE.Mesh(sdPcbGeo, sdPcbMat);
  sdPcb.castShadow = true;
  sdPcb.userData = { componentId: 'sd_module' };
  interactiveMeshes.push(sdPcb);
  sdGroup.add(sdPcb);

  // Metal Micro-SD Socket & Card
  const socketGeo = new THREE.BoxGeometry(1.6, 0.18, 1.8);
  const socketMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.25 });
  const socket = new THREE.Mesh(socketGeo, socketMat);
  socket.position.set(0, 0.16, -0.4);
  sdGroup.add(socket);

  const cardGeo = new THREE.BoxGeometry(1.3, 0.08, 0.9);
  const cardMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });
  const card = new THREE.Mesh(cardGeo, cardMat);
  card.position.set(0, 0.24, -0.5);
  sdGroup.add(card);

  // 6-pin header at bottom
  buildPinHeader(sdGroup, 6, 0, 0.12, 1.4);
  scene.add(sdGroup);

  // 2. Turbidity Sensor Interface Module (Top Center-Left)
  const turbGroup = new THREE.Group();
  turbGroup.name = 'turbidity_module_group';
  turbGroup.position.set(-2.0, 0.5, -6.2);
  componentGroups['turbidity_module'] = turbGroup;

  const turbPcbGeo = new THREE.BoxGeometry(2.6, 0.14, 3.2);
  const turbPcbMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.5 });
  const turbPcb = new THREE.Mesh(turbPcbGeo, turbPcbMat);
  turbPcb.castShadow = true;
  turbPcb.userData = { componentId: 'turbidity_module' };
  interactiveMeshes.push(turbPcb);
  turbGroup.add(turbPcb);

  // Blue Trim Potentiometer
  buildTrimpot(turbGroup, -0.6, 0.25, -0.5);

  // Top 3-pin connector to probe
  buildPinHeader(turbGroup, 3, 0, 0.15, -1.3, 0x38bdf8);
  // Bottom 4-pin header to ESP32
  buildPinHeader(turbGroup, 4, 0, 0.15, 1.3);
  scene.add(turbGroup);

  // 3. pH Sensor Interface Module (Top Center-Right)
  const phGroup = new THREE.Group();
  phGroup.name = 'ph_module_group';
  phGroup.position.set(2.2, 0.5, -6.2);
  componentGroups['ph_module'] = phGroup;

  const phPcbGeo = new THREE.BoxGeometry(2.8, 0.14, 3.4);
  const phPcbMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.45 });
  const phPcb = new THREE.Mesh(phPcbGeo, phPcbMat);
  phPcb.castShadow = true;
  phPcb.userData = { componentId: 'ph_module' };
  interactiveMeshes.push(phPcb);
  phGroup.add(phPcb);

  // Prominent Silver Cylindrical BNC Socket on Top
  const bncBaseGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.75, 24);
  const bncMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.15 });
  const bncBase = new THREE.Mesh(bncBaseGeo, bncMat);
  bncBase.position.set(0, 0.45, -0.85);
  phGroup.add(bncBase);

  const bncCollarGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.35, 24);
  const bncCollar = new THREE.Mesh(bncCollarGeo, bncMat);
  bncCollar.position.set(0, 0.9, -0.85);
  phGroup.add(bncCollar);

  // Blue Calibration Trimpot
  buildTrimpot(phGroup, 0.7, 0.25, 0.3);

  // Bottom 3-pin Header
  buildPinHeader(phGroup, 3, 0, 0.15, 1.4);
  scene.add(phGroup);

  // 4. TDS Sensor Interface Module (Top Right)
  const tdsGroup = new THREE.Group();
  tdsGroup.name = 'tds_module_group';
  tdsGroup.position.set(6.4, 0.5, -6.2);
  componentGroups['tds_module'] = tdsGroup;

  // PCB with distinctive orange edge
  const tdsPcbGeo = new THREE.BoxGeometry(2.6, 0.14, 3.4);
  const tdsPcbMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.4 });
  const tdsPcb = new THREE.Mesh(tdsPcbGeo, tdsPcbMat);
  tdsPcb.castShadow = true;
  tdsPcb.userData = { componentId: 'tds_module' };
  interactiveMeshes.push(tdsPcb);
  tdsGroup.add(tdsPcb);

  // Orange Silk-Screen Border Strip
  const borderGeo = new THREE.BoxGeometry(2.65, 0.04, 0.2);
  const borderMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
  const topBorder = new THREE.Mesh(borderGeo, borderMat);
  topBorder.position.set(0, 0.1, -1.6);
  tdsGroup.add(topBorder);
  const btmBorder = new THREE.Mesh(borderGeo, borderMat);
  btmBorder.position.set(0, 0.1, 1.6);
  tdsGroup.add(btmBorder);

  // Terminal blocks & chips
  buildPinHeader(tdsGroup, 2, 0, 0.15, -1.2, 0xef4444);
  buildPinHeader(tdsGroup, 3, 0, 0.15, 1.3);
  scene.add(tdsGroup);
}

// ==========================================
// 3D MODELS: BOTTOM ROW MODULES (MAX6675 & 20x4 LCD)
// ==========================================
function buildBottomModules() {
  // 1. MAX6675 Thermocouple Module (Bottom Left)
  const maxGroup = new THREE.Group();
  maxGroup.name = 'max6675_group';
  maxGroup.position.set(-4.8, 0.5, 6.2);
  componentGroups['max6675'] = maxGroup;

  const maxPcbGeo = new THREE.BoxGeometry(2.0, 0.14, 2.6);
  const maxPcbMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.45 });
  const maxPcb = new THREE.Mesh(maxPcbGeo, maxPcbMat);
  maxPcb.castShadow = true;
  maxPcb.userData = { componentId: 'max6675' };
  interactiveMeshes.push(maxPcb);
  maxGroup.add(maxPcb);

  // Green 2-pin Screw Terminal Block at Bottom (+ and - thermocouple inputs)
  const termGeo = new THREE.BoxGeometry(1.6, 0.65, 0.95);
  const termMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.5 });
  const term = new THREE.Mesh(termGeo, termMat);
  term.position.set(0, 0.38, 0.7);
  maxGroup.add(term);

  // Screw Heads
  const screwGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.08, 12);
  const screwMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9 });
  const s1 = new THREE.Mesh(screwGeo, screwMat);
  s1.position.set(-0.4, 0.72, 0.7);
  maxGroup.add(s1);
  const s2 = new THREE.Mesh(screwGeo, screwMat);
  s2.position.set(0.4, 0.72, 0.7);
  maxGroup.add(s2);

  // Top 5-pin Header to ESP32
  buildPinHeader(maxGroup, 5, 0, 0.15, -1.0);
  scene.add(maxGroup);

  // 2. 20x4 LCD with I2C Backpack Module (Bottom Center-Right)
  const lcdGroup = new THREE.Group();
  lcdGroup.name = 'lcd_i2c_group';
  lcdGroup.position.set(2.4, 0.6, 6.2);
  componentGroups['lcd_i2c'] = lcdGroup;

  // Green Main PCB
  const lcdPcbGeo = new THREE.BoxGeometry(9.8, 0.16, 5.8);
  const lcdPcbMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.5 });
  const lcdPcb = new THREE.Mesh(lcdPcbGeo, lcdPcbMat);
  lcdPcb.castShadow = true;
  lcdPcb.userData = { componentId: 'lcd_i2c' };
  interactiveMeshes.push(lcdPcb);
  lcdGroup.add(lcdPcb);

  // Black Metallic Bezel
  const bezelGeo = new THREE.BoxGeometry(8.2, 0.35, 4.4);
  const bezelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.7 });
  const bezel = new THREE.Mesh(bezelGeo, bezelMat);
  bezel.position.set(0, 0.22, 0);
  lcdGroup.add(bezel);

  // Dynamic 20x4 LCD Screen Mesh (Rendered via HTML5 Canvas Texture)
  createLcdDynamicTexture();
  const screenGeo = new THREE.PlaneGeometry(7.4, 3.6);
  const screenMat = new THREE.MeshBasicMaterial({
    map: lcdCanvasTexture,
    toneMapped: false
  });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.rotation.x = -Math.PI / 2;
  screen.position.set(0, 0.42, 0);
  lcdGroup.add(screen);

  // I2C Backpack Module attached to rear-left
  const i2cGeo = new THREE.BoxGeometry(1.6, 0.16, 3.2);
  const i2cMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 });
  const i2cBoard = new THREE.Mesh(i2cGeo, i2cMat);
  i2cBoard.position.set(-4.4, 0.12, 0);
  lcdGroup.add(i2cBoard);

  // 4 Pins from I2C backpack (GND, VCC, SDA, SCL)
  buildPinHeader(lcdGroup, 4, -4.4, 0.25, 0.8, 0xfacc15);

  scene.add(lcdGroup);
}

// Helper: Build a realistic trim potentiometer
function buildTrimpot(parent, x, y, z) {
  const potGeo = new THREE.BoxGeometry(0.7, 0.5, 0.7);
  const potMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.6 });
  const pot = new THREE.Mesh(potGeo, potMat);
  pot.position.set(x, y, z);
  parent.add(pot);

  // Brass screw on top
  const screwGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.1, 12);
  const screwMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.3 });
  const screw = new THREE.Mesh(screwGeo, screwMat);
  screw.position.set(x, y + 0.28, z);
  parent.add(screw);
}

// Helper: Build pin header
function buildPinHeader(parent, numPins, x, y, z, color = 0x1e293b) {
  const baseGeo = new THREE.BoxGeometry(numPins * 0.25 + 0.1, 0.2, 0.25);
  const baseMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.7 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.set(x, y, z);
  parent.add(base);

  const pinGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.35, 8);
  const pinMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.2 });
  const startX = x - ((numPins - 1) * 0.25) / 2;
  for (let i = 0; i < numPins; i++) {
    const pin = new THREE.Mesh(pinGeo, pinMat);
    pin.position.set(startX + i * 0.25, y + 0.15, z);
    parent.add(pin);
  }
}

// ==========================================
// 3D MODELS: WATER CONTAINER & IMMERSED PROBES
// ==========================================
function buildWaterSampleAndProbes() {
  const group = new THREE.Group();
  group.name = 'water_sample_group';
  group.position.set(11.2, 0, -1.8);
  componentGroups['water_sample'] = group;

  // 1. Transparent Glass Beaker
  const beakerRadius = 2.4;
  const beakerHeight = 5.8;
  const beakerGeo = new THREE.CylinderGeometry(beakerRadius, beakerRadius * 0.92, beakerHeight, 32, 1, true);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.35,
    roughness: 0.1,
    metalness: 0.1,
    transmission: 0.85,
    ior: 1.5,
    depthWrite: false
  });
  const beaker = new THREE.Mesh(beakerGeo, glassMat);
  beaker.position.y = beakerHeight / 2;
  beaker.userData = { componentId: 'water_sample' };
  interactiveMeshes.push(beaker);
  group.add(beaker);

  // Beaker Base
  const baseGeo = new THREE.CylinderGeometry(beakerRadius * 0.92, beakerRadius * 0.92, 0.15, 32);
  const baseMesh = new THREE.Mesh(baseGeo, glassMat);
  baseMesh.position.y = 0.08;
  group.add(baseMesh);

  // 2. Liquid Water Inside Beaker
  const waterGeo = new THREE.CylinderGeometry(beakerRadius * 0.95, beakerRadius * 0.89, beakerHeight * 0.72, 32);
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.65,
    roughness: 0.1,
    transmission: 0.6,
    ior: 1.33
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.y = (beakerHeight * 0.72) / 2 + 0.15;
  water.userData = { componentId: 'water_sample' };
  group.add(water);

  // 3. Immersed Probes:
  // (a) pH Electrode Probe (Glass bulb with collar & black cable)
  const phProbeGeo = new THREE.CylinderGeometry(0.24, 0.24, 4.2, 16);
  const phProbeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 });
  const phProbe = new THREE.Mesh(phProbeGeo, phProbeMat);
  phProbe.position.set(-0.9, 2.6, -0.6);
  phProbe.rotation.z = -0.12;
  group.add(phProbe);

  // Glass bulb tip
  const phBulbGeo = new THREE.SphereGeometry(0.28, 16, 16);
  const phBulbMat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.2, metalness: 0.5 });
  const phBulb = new THREE.Mesh(phBulbGeo, phBulbMat);
  phBulb.position.set(-0.65, 0.65, -0.6);
  group.add(phBulb);

  // (b) TDS Probe (Dual metal pin electrode head)
  const tdsProbeGeo = new THREE.CylinderGeometry(0.22, 0.22, 3.8, 16);
  const tdsProbeMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.5 });
  const tdsProbe = new THREE.Mesh(tdsProbeGeo, tdsProbeMat);
  tdsProbe.position.set(0.8, 2.4, -0.7);
  tdsProbe.rotation.z = 0.1;
  group.add(tdsProbe);

  // Dual metallic pins
  const pinTipGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8);
  const pinTipMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95 });
  const tp1 = new THREE.Mesh(pinTipGeo, pinTipMat);
  tp1.position.set(0.68, 0.4, -0.65);
  group.add(tp1);
  const tp2 = new THREE.Mesh(pinTipGeo, pinTipMat);
  tp2.position.set(0.82, 0.4, -0.75);
  group.add(tp2);

  // (c) Turbidity Optical Probe Head
  const turbHeadGeo = new THREE.BoxGeometry(0.7, 3.2, 0.6);
  const turbHeadMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5 });
  const turbHead = new THREE.Mesh(turbHeadGeo, turbHeadMat);
  turbHead.position.set(-0.5, 2.2, 0.8);
  turbHead.rotation.x = 0.12;
  group.add(turbHead);

  // Optical notch gap
  const notchGeo = new THREE.BoxGeometry(0.4, 0.6, 0.65);
  const notchMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const notch = new THREE.Mesh(notchGeo, notchMat);
  notch.position.set(-0.5, 0.9, 0.95);
  group.add(notch);

  // (d) Type-K Thermocouple Metal Probe Sheath
  const thermoGeo = new THREE.CylinderGeometry(0.12, 0.12, 4.0, 16);
  const thermoMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 0.95, roughness: 0.15 });
  const thermo = new THREE.Mesh(thermoGeo, thermoMat);
  thermo.position.set(0.7, 2.3, 0.7);
  thermo.rotation.z = 0.08;
  group.add(thermo);

  scene.add(group);
}

// ==========================================
// 3D MODELS: JUMPER WIRES (Catmull-Rom Splines)
// ==========================================
function buildJumperWires() {
  const wireGroup = new THREE.Group();
  wireGroup.name = 'jumper_wires_group';

  // Wire specifications matching Reference Image 2
  const wireDefs = [
    // SD Card to ESP32 (SPI)
    { points: [[-6.2, 0.6, -4.8], [-6.4, 2.4, -2.5], [-5.8, 1.8, -0.8], [-5.5, 1.0, -0.8]], color: 0x78350f, name: 'SD_GND' },
    { points: [[-6.0, 0.6, -4.8], [-5.9, 2.5, -2.2], [-5.3, 1.8, -0.8], [-5.2, 1.0, -0.8]], color: 0x0f172a, name: 'SD_VCC' },
    { points: [[-5.8, 0.6, -4.8], [-5.5, 2.6, -2.0], [-4.8, 1.8, -0.8], [-4.6, 1.0, -0.8]], color: 0xdc2626, name: 'SD_CS' },
    { points: [[-5.6, 0.6, -4.8], [-5.1, 2.7, -1.8], [-4.3, 1.8, -0.8], [-4.0, 1.0, -0.8]], color: 0x16a34a, name: 'SD_SCK' },
    { points: [[-5.4, 0.6, -4.8], [-4.7, 2.8, -1.6], [-3.8, 1.8, -0.8], [-3.4, 1.0, -0.8]], color: 0xeab308, name: 'SD_MOSI' },
    { points: [[-5.2, 0.6, -4.8], [-4.3, 2.9, -1.4], [-3.3, 1.8, -0.8], [-2.8, 1.0, -0.8]], color: 0xf97316, name: 'SD_MISO' },

    // Turbidity Module to Breadboard / ESP32
    { points: [[-2.2, 0.6, -4.8], [-2.6, 2.5, -2.5], [-3.2, 1.6, -1.2], [-3.5, 1.0, -1.2]], color: 0x0f172a, name: 'TURB_GND' },
    { points: [[-2.0, 0.6, -4.8], [-2.2, 2.6, -2.2], [-2.8, 1.6, -1.2], [-3.0, 1.0, -1.2]], color: 0xdc2626, name: 'TURB_VCC' },
    { points: [[-1.8, 0.6, -4.8], [-1.8, 2.7, -1.8], [-2.2, 1.6, -1.2], [-2.4, 1.0, -1.2]], color: 0x06b6d4, name: 'TURB_AOUT' },

    // pH Module to Breadboard / ESP32
    { points: [[2.0, 0.6, -4.8], [1.2, 2.6, -2.5], [-0.5, 1.8, -1.2], [-1.8, 1.0, -1.2]], color: 0xdc2626, name: 'PH_VCC' },
    { points: [[2.2, 0.6, -4.8], [1.5, 2.5, -2.2], [0.0, 1.8, -1.2], [-1.2, 1.0, -1.2]], color: 0x0f172a, name: 'PH_GND' },
    { points: [[2.4, 0.6, -4.8], [1.8, 2.7, -1.8], [0.5, 1.8, -1.2], [-0.6, 1.0, -1.2]], color: 0x0284c7, name: 'PH_AOUT' },

    // TDS Module to Breadboard / ESP32
    { points: [[6.2, 0.6, -4.8], [5.2, 2.6, -2.5], [2.8, 1.8, -1.2], [0.5, 1.0, -1.2]], color: 0xa855f7, name: 'TDS_AOUT' },
    { points: [[6.4, 0.6, -4.8], [5.5, 2.5, -2.2], [3.2, 1.8, -1.2], [1.2, 1.0, -1.2]], color: 0x0f172a, name: 'TDS_GND' },
    { points: [[6.6, 0.6, -4.8], [5.8, 2.7, -1.8], [3.6, 1.8, -1.2], [1.8, 1.0, -1.2]], color: 0xdc2626, name: 'TDS_VCC' },

    // MAX6675 Module to ESP32 (Bottom Left)
    { points: [[-4.8, 0.6, 5.0], [-5.2, 2.3, 3.2], [-5.4, 1.8, 1.4], [-5.5, 1.0, 1.2]], color: 0x78350f, name: 'MAX_GND' },
    { points: [[-4.6, 0.6, 5.0], [-4.9, 2.4, 3.0], [-5.1, 1.8, 1.4], [-5.2, 1.0, 1.2]], color: 0xdc2626, name: 'MAX_VCC' },
    { points: [[-4.4, 0.6, 5.0], [-4.6, 2.5, 2.8], [-4.8, 1.8, 1.4], [-4.9, 1.0, 1.2]], color: 0xeab308, name: 'MAX_SCK' },
    { points: [[-4.2, 0.6, 5.0], [-4.3, 2.6, 2.6], [-4.5, 1.8, 1.4], [-4.6, 1.0, 1.2]], color: 0xf97316, name: 'MAX_CS' },
    { points: [[-4.0, 0.6, 5.0], [-4.0, 2.7, 2.4], [-4.2, 1.8, 1.4], [-4.3, 1.0, 1.2]], color: 0x16a34a, name: 'MAX_SO' },

    // 20x4 LCD I2C to ESP32 (Bottom Right)
    { points: [[-2.0, 0.6, 5.2], [-2.6, 2.6, 3.8], [-3.8, 1.8, 1.4], [-4.0, 1.0, 1.2]], color: 0x0f172a, name: 'LCD_GND' },
    { points: [[-1.8, 0.6, 5.2], [-2.3, 2.7, 3.6], [-3.5, 1.8, 1.4], [-3.7, 1.0, 1.2]], color: 0xdc2626, name: 'LCD_VCC' },
    { points: [[-1.6, 0.6, 5.2], [-2.0, 2.8, 3.4], [-3.2, 1.8, 1.4], [-3.4, 1.0, 1.2]], color: 0x16a34a, name: 'LCD_SDA' },
    { points: [[-1.4, 0.6, 5.2], [-1.7, 2.9, 3.2], [-2.9, 1.8, 1.4], [-3.1, 1.0, 1.2]], color: 0xf97316, name: 'LCD_SCL' },

    // Thermocouple Braided Cable to Water Beaker
    { points: [[-4.8, 0.7, 7.2], [-1.0, 3.6, 6.5], [6.5, 4.2, 3.0], [11.9, 2.3, -1.1]], color: 0x94a3b8, name: 'THERMO_CABLE' },
    // pH BNC Cable to Water Beaker
    { points: [[2.2, 1.2, -7.0], [5.8, 3.8, -6.0], [9.8, 3.5, -4.0], [10.3, 2.6, -2.4]], color: 0x1e293b, name: 'PH_CABLE' },
    // TDS Cable to Water Beaker
    { points: [[6.4, 0.8, -7.2], [8.2, 3.4, -5.5], [10.8, 3.2, -3.8], [12.0, 2.4, -2.5]], color: 0x0284c7, name: 'TDS_CABLE' },
    // Turbidity Cable to Water Beaker
    { points: [[-2.0, 0.8, -7.2], [3.5, 4.4, -6.5], [8.5, 3.8, -4.5], [10.7, 2.2, -1.0]], color: 0x334155, name: 'TURB_CABLE' }
  ];

  wireDefs.forEach(wire => {
    const vectors = wire.points.map(p => new THREE.Vector3(p[0], p[1], p[2]));
    const curve = new THREE.CatmullRomCurve3(vectors);
    const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.055, 8, false);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: wire.color,
      roughness: 0.5,
      metalness: 0.15
    });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.castShadow = true;
    tube.userData = { isWire: true, name: wire.name, color: wire.color };
    wireGroup.add(tube);
  });

  scene.add(wireGroup);
}

// ==========================================
// 3D MODELS: CONCEPTUAL DATA-FLOW PARTICLES
// ==========================================
function buildDataFlowParticles() {
  const particleCount = 28;
  const geo = new THREE.SphereGeometry(0.1, 8, 8);
  const mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

  for (let i = 0; i < particleCount; i++) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = simState.showDataFlow;
    scene.add(mesh);

    dataFlowParticles.push({
      mesh: mesh,
      speed: 0.008 + Math.random() * 0.006,
      progress: Math.random(),
      // Define path waypoints: Probe -> Module -> ESP32 -> LCD/SD
      source: i % 4 // 0: pH, 1: TDS, 2: Turb, 3: Temp
    });
  }
}

function updateDataFlowAnimation() {
  if (!simState.showDataFlow || !simState.running || simState.paused) {
    dataFlowParticles.forEach(p => p.mesh.visible = false);
    return;
  }

  dataFlowParticles.forEach(p => {
    p.mesh.visible = true;
    p.progress += p.speed;
    if (p.progress > 1.0) p.progress = 0;

    // Interpolate positions
    let pStart, pMid, pEnd;
    if (p.source === 0) { // pH
      pStart = new THREE.Vector3(10.3, 2.6, -2.4);
      pMid = new THREE.Vector3(2.2, 0.6, -6.2);
      pEnd = new THREE.Vector3(-4.6, 0.85, 0);
    } else if (p.source === 1) { // TDS
      pStart = new THREE.Vector3(12.0, 2.4, -2.5);
      pMid = new THREE.Vector3(6.4, 0.5, -6.2);
      pEnd = new THREE.Vector3(-4.6, 0.85, 0);
    } else if (p.source === 2) { // Turbidity
      pStart = new THREE.Vector3(10.7, 2.2, -1.0);
      pMid = new THREE.Vector3(-2.0, 0.5, -6.2);
      pEnd = new THREE.Vector3(-4.6, 0.85, 0);
    } else { // Temp
      pStart = new THREE.Vector3(11.9, 2.3, -1.1);
      pMid = new THREE.Vector3(-4.8, 0.5, 6.2);
      pEnd = new THREE.Vector3(-4.6, 0.85, 0);
    }

    if (p.progress < 0.5) {
      const alpha = p.progress * 2;
      p.mesh.position.lerpVectors(pStart, pMid, alpha);
    } else {
      const alpha = (p.progress - 0.5) * 2;
      p.mesh.position.lerpVectors(pMid, pEnd, alpha);
    }
  });
}

// ==========================================
// 20x4 LCD DYNAMIC CANVAS TEXTURE
// ==========================================
function createLcdDynamicTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  lcd2DContext = canvas.getContext('2d');
  lcdCanvasTexture = new THREE.CanvasTexture(canvas);
  lcdCanvasTexture.minFilter = THREE.LinearFilter;
  lcdCanvasTexture.magFilter = THREE.LinearFilter;
  renderLcdToCanvas();
}

function renderLcdToCanvas() {
  if (!lcd2DContext) return;
  const ctx = lcd2DContext;

  // Yellow-green LCD background
  ctx.fillStyle = '#78a826';
  ctx.fillRect(0, 0, 512, 256);

  // Subtle LCD character cell grid
  ctx.fillStyle = '#6e9b22';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 20; c++) {
      ctx.fillRect(20 + c * 23.5, 24 + r * 52, 21, 44);
    }
  }

  // Dark LCD Pixels Text
  ctx.fillStyle = '#142304';
  ctx.font = 'bold 30px "Courier New", Courier, monospace';
  ctx.textBaseline = 'middle';

  const lines = getLcdLinesForCurrentScreen();
  lines.forEach((line, index) => {
    // Pad or slice to exactly 20 characters
    const text20 = (line + '                    ').slice(0, 20);
    ctx.fillText(text20, 24, 46 + index * 52);
  });

  if (lcdCanvasTexture) lcdCanvasTexture.needsUpdate = true;
}

function getLcdLinesForCurrentScreen() {
  const { ph, tds, turbidity, temp } = simState.readings;

  if (simState.activeLcdScreen === 0) {
    // Screen 1: Live Telemetry
    return [
      'JALSAATHI WATER LAB ',
      `pH:${ph.toFixed(1)} TDS:${tds}ppm `,
      `Turb:${turbidity.toFixed(1)}NTU T:${temp.toFixed(1)}C`,
      `REC:#${String(simState.recordCounter).padStart(4, '0')} SD:OK `
    ];
  } else if (simState.activeLcdScreen === 1) {
    // Screen 2: Sensor Diagnostics
    const phAdc = Math.round((ph / 14.0) * 4095);
    const tdsAdc = Math.round((tds / 2000) * 4095);
    return [
      'SENSOR DIAGNOSTICS  ',
      `pH ADC:${phAdc} 3.12V `,
      `TDS ADC:${tdsAdc} 1.05V`,
      `NTU ADC:2840 MAX:OK `
    ];
  } else if (simState.activeLcdScreen === 2) {
    // Screen 3: SD Card Storage
    return [
      'SD STORAGE LOGGING  ',
      'FILE: /LOGS/WQM.CSV ',
      `LOGS: ${simState.recordCounter} RECORDS`,
      'SPI CLK: 20MHz [OK] '
    ];
  } else {
    // Screen 4: System & Network
    return [
      'ESP32 TELEMETRY RIG ',
      'WIFI: CONNECTED     ',
      'IP: 192.168.1.104   ',
      'MQTT/HTTP: RUNNING  '
    ];
  }
}

// ==========================================
// INTERACTIVE EVENT LISTENERS & RAYCASTING
// ==========================================
function setupInteractionListeners() {
  containerEl.addEventListener('mousemove', onMouseMove);
  containerEl.addEventListener('click', onMouseClick);
  window.addEventListener('resize', onWindowResize);
}

function onMouseMove(event) {
  const rect = containerEl.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / containerEl.clientWidth) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / containerEl.clientHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(interactiveMeshes, true);

  if (intersects.length > 0) {
    containerEl.style.cursor = 'pointer';
    let target = intersects[0].object;
    while (target && !target.userData.componentId && target.parent) {
      target = target.parent;
    }
    if (target && target.userData.componentId) {
      hoveredObject = target;
    }
  } else {
    containerEl.style.cursor = 'grab';
    hoveredObject = null;
  }

  // Update 3D Floating Labels positions
  if (simState.showLabels) {
    updateFloatingLabels();
  }
}

function onMouseClick(event) {
  const rect = containerEl.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / containerEl.clientWidth) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / containerEl.clientHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(interactiveMeshes, true);

  if (intersects.length > 0) {
    let target = intersects[0].object;
    
    // Check if user clicked a 3D Push Button Cap
    if (target.userData.isButtonCap !== undefined) {
      handleButtonPress(target.userData.buttonIndex);
      return;
    }

    while (target && !target.userData.componentId && target.parent) {
      target = target.parent;
    }

    if (target && target.userData.componentId) {
      const compId = target.userData.componentId;
      selectComponent(compId);
    }
  }
}

export function handleButtonPress(buttonIdx) {
  playClickSound();

  // Depress 3D button plunger
  if (buttonMeshes[buttonIdx]) {
    const btn = buttonMeshes[buttonIdx];
    btn.position.y = 1.22;
    setTimeout(() => {
      btn.position.y = 1.34;
    }, 140);
  }

  // Highlight 2D button in bottom panel
  const btnEl = document.getElementById(`hwBtn${buttonIdx + 1}`);
  if (btnEl) {
    btnEl.classList.add('pressed');
    setTimeout(() => btnEl.classList.remove('pressed'), 160);
  }

  // Execute Button Action
  if (buttonIdx === 0) { // Prev Screen
    simState.activeLcdScreen = (simState.activeLcdScreen + 3) % 4;
  } else if (buttonIdx === 1) { // Next Screen
    simState.activeLcdScreen = (simState.activeLcdScreen + 1) % 4;
  } else if (buttonIdx === 2) { // Select / Confirm Action
    // Force a telemetry capture
    logCurrentReading();
  } else if (buttonIdx === 3) { // Menu / Back
    simState.activeLcdScreen = 0; // Return to live screen
  }

  updateLcdDisplay();
}

export function selectComponent(compId) {
  simState.selectedComponent = compId;
  updateInspectorPanel(compId);

  // Focus Camera smoothly toward component
  const group = componentGroups[compId];
  if (group) {
    // Trigger outline or highlight pulse
  }
}

export function focusSelectedComponent() {
  const group = componentGroups[simState.selectedComponent];
  if (!group) return;

  const worldPos = new THREE.Vector3();
  group.getWorldPosition(worldPos);

  const startTarget = controls.target.clone();
  const endTarget = worldPos.clone().add(new THREE.Vector3(0, 0.5, 0));
  const startCamPos = camera.position.clone();
  const endCamPos = worldPos.clone().add(new THREE.Vector3(0, 5.5, 8.5));

  let t = 0;
  function animateCam() {
    t += 0.05;
    controls.target.lerpVectors(startTarget, endTarget, t);
    camera.position.lerpVectors(startCamPos, endCamPos, t);
    controls.update();
    if (t < 1.0) requestAnimationFrame(animateCam);
  }
  animateCam();
}

export function resetCamera() {
  const startTarget = controls.target.clone();
  const endTarget = new THREE.Vector3(1.5, 0.5, 0);
  const startCamPos = camera.position.clone();
  const endCamPos = new THREE.Vector3(1.5, 15, 20);

  let t = 0;
  function animateCam() {
    t += 0.05;
    controls.target.lerpVectors(startTarget, endTarget, t);
    camera.position.lerpVectors(startCamPos, endCamPos, t);
    controls.update();
    if (t < 1.0) requestAnimationFrame(animateCam);
  }
  animateCam();
}

export function toggleExplodedView() {
  simState.exploded = !simState.exploded;
  const btn = document.getElementById('btnExplodedView');
  if (btn) {
    if (simState.exploded) btn.classList.add('active-toggle');
    else btn.classList.remove('active-toggle');
  }

  // Smoothly elevate top/bottom modules
  const targetTopY = simState.exploded ? 2.5 : 0.5;
  const targetBottomY = simState.exploded ? 2.5 : 0.5;

  ['sd_module', 'turbidity_module', 'ph_module', 'tds_module'].forEach(id => {
    if (componentGroups[id]) {
      lerpGroupY(componentGroups[id], targetTopY);
    }
  });

  ['max6675', 'lcd_i2c'].forEach(id => {
    if (componentGroups[id]) {
      lerpGroupY(componentGroups[id], targetBottomY);
    }
  });
}

function lerpGroupY(group, targetY) {
  let t = 0;
  const startY = group.position.y;
  function step() {
    t += 0.08;
    group.position.y = THREE.MathUtils.lerp(startY, targetY, t);
    if (t < 1.0) requestAnimationFrame(step);
  }
  step();
}

export function toggleLabels() {
  simState.showLabels = !simState.showLabels;
  const container = document.getElementById('floatingLabelsContainer');
  if (container) {
    container.style.display = simState.showLabels ? 'block' : 'none';
  }
  const btn = document.getElementById('btnToggleLabels');
  if (btn) {
    if (simState.showLabels) btn.classList.add('active-toggle');
    else btn.classList.remove('active-toggle');
  }
  if (simState.showLabels) updateFloatingLabels();
}

export function toggleDataFlow() {
  simState.showDataFlow = !simState.showDataFlow;
  const btn = document.getElementById('btnToggleDataFlow');
  if (btn) {
    if (simState.showDataFlow) btn.classList.add('active-toggle');
    else btn.classList.remove('active-toggle');
  }
}

export function toggleSimulation() {
  simState.running = !simState.running;
  simState.paused = !simState.running;
  updateStatusPill();
}

export function pauseSimulation() {
  simState.paused = !simState.paused;
  updateStatusPill();
}

export function resetSimulation() {
  simState.recordCounter = 0;
  simState.logRecords = [];
  simState.readings = { ph: 7.20, tds: 320, turbidity: 4.5, temp: 26.4 };
  simState.activeLcdScreen = 0;
  updateSensorControlsUI();
  updateLcdDisplay();
  updateSdTableUI();
  resetCamera();
}

function updateStatusPill() {
  const pill = document.getElementById('labStatusPill');
  const btnPlay = document.getElementById('btnStartSim');
  if (!pill) return;

  if (simState.running && !simState.paused) {
    pill.className = 'lab-mode-pill running';
    pill.innerHTML = '● Simulation Running';
    if (btnPlay) btnPlay.innerHTML = '⏸ Pause';
  } else {
    pill.className = 'lab-mode-pill paused';
    pill.innerHTML = '⏸ Paused';
    if (btnPlay) btnPlay.innerHTML = '▶ Resume';
  }
}

// ==========================================
// TELEMETRY & LOGGING CYCLE
// ==========================================
let telemetryIntervalId = null;
function startTelemetryCycle() {
  if (telemetryIntervalId) clearInterval(telemetryIntervalId);

  telemetryIntervalId = setInterval(() => {
    if (!simState.running || simState.paused) return;

    // Small subtle electrical noise (0.02) to simulate authentic ADC sampling
    const noise = (Math.random() - 0.5) * 0.04;
    simState.readings.temp = Math.max(0, +(simState.readings.temp + noise * 0.2).toFixed(1));

    // Flash TX LED on ESP32
    if (txLedMesh) {
      txLedMesh.material.color.setHex(0xffffff);
      setTimeout(() => {
        if (txLedMesh) txLedMesh.material.color.setHex(0x38bdf8);
      }, 100);
    }

    // SD Card Logging
    if (simState.sdLoggingEnabled) {
      logCurrentReading();
    }

    updateLcdDisplay();
  }, 2500);
}

function logCurrentReading() {
  simState.recordCounter++;
  const record = {
    id: simState.recordCounter,
    timestamp: new Date().toLocaleTimeString(),
    ph: simState.readings.ph.toFixed(2),
    tds: simState.readings.tds,
    turbidity: simState.readings.turbidity.toFixed(1),
    temp: simState.readings.temp.toFixed(1),
    status: 'OK'
  };

  simState.logRecords.unshift(record);
  if (simState.logRecords.length > 50) simState.logRecords.pop();

  updateSdTableUI();
}

// ==========================================
// UI SYNCHRONIZATION
// ==========================================
export function updateLcdDisplay() {
  renderLcdToCanvas();

  // Update 2D LCD HTML Preview
  const lines = getLcdLinesForCurrentScreen();
  for (let i = 0; i < 4; i++) {
    const el = document.getElementById(`lcdPreviewLine${i + 1}`);
    if (el) el.textContent = lines[i] || '';
  }

  // Update Inspector live values
  const liveEl = document.getElementById('inspectorLiveReading');
  if (liveEl) {
    const comp = COMPONENT_CATALOG[simState.selectedComponent];
    if (comp) {
      if (comp.id === 'ph_module') liveEl.textContent = `${simState.readings.ph.toFixed(2)} pH`;
      else if (comp.id === 'tds_module') liveEl.textContent = `${simState.readings.tds} ppm`;
      else if (comp.id === 'turbidity_module') liveEl.textContent = `${simState.readings.turbidity.toFixed(1)} NTU`;
      else if (comp.id === 'max6675') liveEl.textContent = `${simState.readings.temp.toFixed(1)} °C`;
      else liveEl.textContent = 'Active / Telemetry OK';
    }
  }
}

export function updateInspectorPanel(compId) {
  const comp = COMPONENT_CATALOG[compId] || COMPONENT_CATALOG['esp32'];
  
  const titleEl = document.getElementById('inspectorCompTitle');
  const catEl = document.getElementById('inspectorCompCategory');
  const descEl = document.getElementById('inspectorCompDesc');
  const ifaceEl = document.getElementById('inspectorCompInterfaces');
  const pinListEl = document.getElementById('inspectorPinoutList');
  const noteEl = document.getElementById('inspectorTechNote');

  if (titleEl) titleEl.textContent = comp.name;
  if (catEl) catEl.textContent = comp.category;
  if (descEl) descEl.textContent = comp.description;
  if (ifaceEl) ifaceEl.textContent = comp.interfaces;
  if (noteEl) noteEl.innerHTML = `<strong>Implementation Accuracy:</strong> ${comp.techNote}`;

  if (pinListEl && comp.pinout) {
    pinListEl.innerHTML = comp.pinout.map(item => `
      <li class="pinout-item">
        <span class="pin-name">${item.pin}</span>
        <span class="pin-target">${item.target}</span>
      </li>
    `).join('');
  }
}

function updateSdTableUI() {
  const countEl = document.getElementById('sdRecordCount');
  if (countEl) countEl.textContent = simState.recordCounter;

  const tbody = document.getElementById('sdLogTbody');
  if (!tbody) return;

  if (simState.logRecords.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">Waiting for measurement cycle...</td></tr>';
    return;
  }

  tbody.innerHTML = simState.logRecords.slice(0, 8).map(r => `
    <tr>
      <td>#${String(r.id).padStart(4, '0')}</td>
      <td>${r.timestamp}</td>
      <td>${r.ph}</td>
      <td>${r.tds}</td>
      <td>${r.turbidity}</td>
      <td>${r.temp}°C</td>
    </tr>
  `).join('');
}

export function updateSensorControlsUI() {
  const phSlider = document.getElementById('simSliderPh');
  const phVal = document.getElementById('simValPh');
  if (phSlider && phVal) {
    phSlider.value = simState.readings.ph;
    phVal.textContent = simState.readings.ph.toFixed(1);
  }

  const tdsSlider = document.getElementById('simSliderTds');
  const tdsVal = document.getElementById('simValTds');
  if (tdsSlider && tdsVal) {
    tdsSlider.value = simState.readings.tds;
    tdsVal.textContent = `${simState.readings.tds} ppm`;
  }

  const turbSlider = document.getElementById('simSliderTurbidity');
  const turbVal = document.getElementById('simValTurbidity');
  if (turbSlider && turbVal) {
    turbSlider.value = simState.readings.turbidity;
    turbVal.textContent = `${simState.readings.turbidity.toFixed(1)} NTU`;
  }

  const tempSlider = document.getElementById('simSliderTemp');
  const tempVal = document.getElementById('simValTemp');
  if (tempSlider && tempVal) {
    tempSlider.value = simState.readings.temp;
    tempVal.textContent = `${simState.readings.temp.toFixed(1)} °C`;
  }
}

export function onSensorSliderChange(param, value) {
  const numVal = parseFloat(value);
  if (isNaN(numVal)) return;

  simState.readings[param] = numVal;
  updateSensorControlsUI();
  updateLcdDisplay();
}

export function exportSdLogCsv() {
  if (simState.logRecords.length === 0) {
    alert('No telemetry records logged yet. Wait for a measurement cycle.');
    return;
  }

  let csv = 'RecordID,Timestamp,pH,TDS_ppm,Turbidity_NTU,Temperature_C,Status\n';
  simState.logRecords.forEach(r => {
    csv += `${r.id},"${r.timestamp}",${r.ph},${r.tds},${r.turbidity},${r.temp},${r.status}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `AquaMonitor_SD_Log_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// 3D Floating Labels Calculation
function updateFloatingLabels() {
  const container = document.getElementById('floatingLabelsContainer');
  if (!container || !simState.showLabels) return;

  const labels = [
    { id: 'esp32', text: 'ESP-WROOM-32' },
    { id: 'breadboard', text: 'Breadboard 830-Pt' },
    { id: 'sd_module', text: 'Micro-SD Module' },
    { id: 'turbidity_module', text: 'Turbidity Interface' },
    { id: 'ph_module', text: 'pH Interface' },
    { id: 'tds_module', text: 'TDS Meter V1.0' },
    { id: 'max6675', text: 'MAX6675 Thermocouple' },
    { id: 'lcd_i2c', text: '20×4 LCD (I2C)' },
    { id: 'push_buttons', text: 'Navigation Buttons' },
    { id: 'water_sample', text: 'Water Sample & Probes' }
  ];

  labels.forEach(l => {
    const group = componentGroups[l.id];
    let el = document.getElementById(`lbl_${l.id}`);
    if (!el) {
      el = document.createElement('div');
      el.id = `lbl_${l.id}`;
      el.className = 'component-3d-label';
      el.textContent = l.text;
      el.onclick = () => selectComponent(l.id);
      container.appendChild(el);
    }

    if (group) {
      const pos = new THREE.Vector3();
      group.getWorldPosition(pos);
      pos.y += 1.2;

      // Project 3D vector to 2D screen coordinates
      pos.project(camera);
      const x = (pos.x * 0.5 + 0.5) * containerEl.clientWidth;
      const y = (-(pos.y * 0.5) + 0.5) * containerEl.clientHeight;

      // Check if behind camera
      if (pos.z < 1.0) {
        el.style.display = 'block';
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
      } else {
        el.style.display = 'none';
      }
    }
  });
}

function onWindowResize() {
  if (!containerEl || !renderer || !camera) return;
  const w = containerEl.clientWidth;
  const h = containerEl.clientHeight;
  if (!w || !h || w <= 0 || h <= 0) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  if (simState.showLabels) updateFloatingLabels();
}

// ==========================================
// ANIMATION LOOP
// ==========================================
function animate() {
  animationFrameId = requestAnimationFrame(animate);

  // Auto-heal dimensions if container becomes visible or resized
  if (containerEl && camera && renderer) {
    const w = containerEl.clientWidth;
    const h = containerEl.clientHeight;
    if (w > 0 && h > 0) {
      const currentAspect = w / h;
      if (isNaN(camera.aspect) || Math.abs(camera.aspect - currentAspect) > 0.005) {
        camera.aspect = currentAspect;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    }
  }

  const delta = clock.getDelta();

  if (controls) controls.update();
  updateDataFlowAnimation();

  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }

  if (simState.showLabels) {
    updateFloatingLabels();
  }
}

export function getDebugInfo() {
  return {
    camPos: camera ? { x: camera.position.x, y: camera.position.y, z: camera.position.z } : null,
    target: controls ? { x: controls.target.x, y: controls.target.y, z: controls.target.z } : null,
    camRot: camera ? { x: camera.rotation.x, y: camera.rotation.y, z: camera.rotation.z } : null
  };
}

if (typeof window !== 'undefined') {
  window.hardwareLab = {
    simState,
    COMPONENT_CATALOG,
    initHardwareLab,
    handleButtonPress,
    selectComponent,
    focusSelectedComponent,
    resetCamera,
    toggleExplodedView,
    toggleLabels,
    toggleDataFlow,
    toggleSimulation,
    pauseSimulation,
    resetSimulation,
    updateLcdDisplay,
    updateInspectorPanel,
    updateSensorControlsUI,
    onSensorSliderChange,
    exportSdLogCsv,
    getDebugInfo
  };
}
