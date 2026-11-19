import Chart from 'chart.js/auto';
import {
  MOLECULES,
  formatMol,
  formatPdb,
  formatXyz,
  harmonicEnergy,
  optimizeScan,
  toCartesian
} from './molecular.js';

const $ = (selector) => document.querySelector(selector);
const elements = {
  H: { color: '#dce8f4', radius: 0.24 },
  C: { color: '#778ba4', radius: 0.36 },
  N: { color: '#719fff', radius: 0.34 },
  O: { color: '#ff7c88', radius: 0.33 },
  S: { color: '#e8be70', radius: 0.42 }
};
const equilibriumBond = { water: 0.958, carbonDioxide: 1.16, methane: 1.09 };
let pesChart;
let convergenceChart;
let currentPoints = [];
let currentInternal = [];
let currentZmatKey = 'water';
let currentViewerKey = 'water';
let viewerStyle = 'ballStick';
let threeModule;
let viewer;
let viewerGeneration = 0;
let fallbackRotation = 0;
let fallbackZoom = 1;
let fallbackDrag;

const quizQuestions = [
  {
    question: 'At a stationary geometry, which quantity is zero within the chosen convergence tolerance?',
    choices: ['The nuclear-coordinate gradient', 'Every Hessian eigenvalue', 'The absolute total energy', 'The number of SCF iterations'],
    answer: 0,
    explanation: 'A stationary point has a zero first derivative (gradient). Curvature must still be examined to distinguish minima from saddle points.'
  },
  {
    question: 'What helps distinguish a true local minimum from a first-order saddle point?',
    choices: ['The atom count', 'The Hessian eigenvalues or vibrational frequencies', 'The filename extension', 'The starting geometry alone'],
    answer: 1,
    explanation: 'A minimum has positive curvature in all non-translational/rotational vibrational directions; a saddle has at least one negative-curvature mode.'
  },
  {
    question: 'What is normally missing from a basic XYZ file?',
    choices: ['Atom symbols', 'Cartesian coordinates', 'Explicit bond connectivity and bond order', 'A comment line'],
    answer: 2,
    explanation: 'XYZ contains an atom count, a comment line, and element/coordinate rows. Connectivity is usually inferred or stored elsewhere.'
  },
  {
    question: 'Which internal coordinate describes rotation about a bond?',
    choices: ['Bond length', 'Bond angle', 'Dihedral (torsion) angle', 'Cartesian origin'],
    answer: 2,
    explanation: 'A dihedral is the angle between two planes defined by four atoms and describes torsion around the central bond.'
  },
  {
    question: 'Why can a geometry optimization require many energy or force evaluations?',
    choices: ['Each optimizer step may call an inner SCF or force-field evaluation', 'Coordinates are always stored in PDB', 'The gradient is a file format', 'One evaluation is one vibrational mode'],
    answer: 0,
    explanation: 'An outer geometry step requests energies and gradients; an electronic-structure SCF procedure may itself iterate many times for each request.'
  },
  {
    question: 'Which statement about a lower energy structure is most accurate?',
    choices: ['It is always the global minimum', 'It proves the compound is stable in every environment', 'It is a model- and condition-dependent result and may be a local minimum', 'It can only be represented with Cartesian coordinates'],
    answer: 2,
    explanation: 'Optimizers generally find a nearby stationary point. Global searches, method choice, solvent, temperature, and conformers all matter.'
  }
];

function bondScanLabel(key) {
  return key === 'water' ? 'O–H scan distance' : key === 'carbonDioxide' ? 'C=O scan distance' : 'C–H scan distance';
}

function setupCharts() {
  const text = '#a5b6cb';
  const grid = 'rgba(144,166,193,.14)';
  const common = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 180 },
    plugins: { legend: { labels: { color: text, boxWidth: 12, usePointStyle: true } } },
    scales: {
      x: { ticks: { color: text }, grid: { color: grid }, title: { display: true, text: 'Bond coordinate (Å)', color: text } },
      y: { ticks: { color: text }, grid: { color: grid }, title: { display: true, text: 'Relative energy (arbitrary units)', color: text } }
    }
  };
  const scans = Array.from({ length: 51 }, (_, index) => 0.65 + index * 0.02);
  pesChart = new Chart($('#pesChart'), {
    type: 'line',
    data: {
      labels: scans.map((value) => value.toFixed(2)),
      datasets: [
        { label: 'Schematic PES', data: [], borderColor: '#6de0ca', backgroundColor: 'rgba(109,224,202,.08)', borderWidth: 2, pointRadius: 0, tension: .22 },
        { label: 'Optimization path', data: [], borderColor: '#ffb86b', backgroundColor: '#ffb86b', pointRadius: 4, showLine: true, borderDash: [4, 4], tension: 0 },
        { label: 'Current scan coordinate', data: [], borderColor: '#ff7c88', backgroundColor: '#ff7c88', pointRadius: 5, showLine: false }
      ]
    },
    options: { ...common, scales: { ...common.scales, x: { ...common.scales.x, type: 'linear', min: .65, max: 1.65 } } }
  });
  convergenceChart = new Chart($('#convergenceChart'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'Relative energy', data: [], yAxisID: 'energy', borderColor: '#6de0ca', pointRadius: 2, tension: .25 },
        { label: '|Gradient|', data: [], yAxisID: 'gradient', borderColor: '#ffb86b', pointRadius: 2, tension: .25 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 180 },
      plugins: { legend: { labels: { color: text, boxWidth: 12, usePointStyle: true } } },
      scales: {
        x: { ticks: { color: text }, grid: { color: grid }, title: { display: true, text: 'Optimization step', color: text } },
        energy: { type: 'linear', position: 'left', ticks: { color: '#6de0ca' }, grid: { color: grid }, title: { display: true, text: 'Relative energy', color: '#6de0ca' } },
        gradient: { type: 'linear', position: 'right', ticks: { color: '#ffb86b' }, grid: { drawOnChartArea: false }, title: { display: true, text: '|Gradient|', color: '#ffb86b' } }
      }
    }
  });
}

function updateEnergyScan(key, coordinate = Number($('#scanCoordinate').value), trace = []) {
  const target = equilibriumBond[key];
  const values = pesChart.data.labels.map((label) => {
    const x = Number(label);
    return { x, y: harmonicEnergy(x, target) };
  });
  pesChart.data.datasets[0].data = values;
  pesChart.data.datasets[1].data = trace.map(({ coordinate: x }) => ({ x, y: harmonicEnergy(x, target) }));
  pesChart.data.datasets[2].data = [{ x: coordinate, y: harmonicEnergy(coordinate, target) }];
  pesChart.update();
  const gradient = 90 * (coordinate - target);
  $('#finalCoordinate').textContent = `${coordinate.toFixed(3)} Å`;
  $('#finalEnergy').textContent = harmonicEnergy(coordinate, target).toFixed(3);
  $('#finalGradient').textContent = Math.abs(gradient).toFixed(3);
}

function updateSimulatorControls() {
  const key = $('#simMolecule').value;
  const target = equilibriumBond[key];
  $('#scanLabel').firstChild.textContent = `${bondScanLabel(key)}: `;
  $('#rangeMin').textContent = $('#scanCoordinate').min;
  $('#rangeMax').textContent = `${$('#scanCoordinate').max} Å`;
  $('#scanCoordinate').value = String(target);
  $('#scanValue').textContent = `${target.toFixed(2)} Å`;
  updateEnergyScan(key, target);
  convergenceChart.data.labels = [];
  convergenceChart.data.datasets.forEach((dataset) => { dataset.data = []; });
  convergenceChart.update();
  $('#simStatus').textContent = 'Ready · adjust the scan coordinate or run the demo.';
}

function runOptimization() {
  const key = $('#simMolecule').value;
  const steps = Number($('#stepsInput').value);
  if (!Number.isInteger(steps) || steps < 5 || steps > 100) {
    $('#simStatus').textContent = 'Choose a whole number of steps from 5 to 100.';
    $('#stepsInput').focus();
    return;
  }
  const start = Number($('#scanCoordinate').value);
  const trace = optimizeScan(start, equilibriumBond[key], steps, $('#optimizer').value);
  updateEnergyScan(key, start, trace);
  pesChart.data.datasets[1].data = trace.map(({ coordinate, energy }) => ({ x: coordinate, y: energy }));
  pesChart.update();
  convergenceChart.data.labels = trace.map(({ step }) => step);
  convergenceChart.data.datasets[0].data = trace.map(({ energy }) => energy);
  convergenceChart.data.datasets[1].data = trace.map(({ gradient }) => Math.abs(gradient));
  convergenceChart.update();
  const final = trace.at(-1);
  const previous = trace.at(-2);
  const converged = Math.abs(final.energy - previous.energy) < 1e-6
    && Math.abs(final.gradient) < 0.01
    && Math.abs(final.coordinate - previous.coordinate) < 1e-3;
  $('#finalCoordinate').textContent = `${final.coordinate.toFixed(4)} Å`;
  $('#finalEnergy').textContent = final.energy.toFixed(5);
  $('#finalGradient').textContent = Math.abs(final.gradient).toFixed(5);
  $('#simStatus').textContent = converged
    ? `Illustrative convergence reached in ${steps} steps (energy, gradient, and displacement criteria).`
    : `Demo stopped after ${steps} steps; one or more convergence criteria remain unmet.`;
  $('#zmatMolecule').value = key;
  currentZmatKey = key;
  currentInternal = initializeInternal(key);
  currentInternal[1].r = final.coordinate;
  recalculateInternal();
  updateOutputFiles(trace);
}

function zmatReferences(internal, index) {
  const refs = internal[index]?.refs || [];
  return refs.map((reference) => `atom ${reference + 1}`).join(', ') || 'origin';
}

function initializeInternal(key) {
  const molecule = MOLECULES[key];
  if (!molecule.internal.length) return null;
  return molecule.internal.map((entry) => ({ ...entry, refs: [...entry.refs] }));
}

function renderZMatrixTable() {
  const molecule = MOLECULES[currentZmatKey];
  currentInternal = initializeInternal(currentZmatKey);
  const body = $('#zmatRows');
  body.replaceChildren();
  molecule.atoms.forEach((element, index) => {
    const entry = currentInternal[index];
    const row = document.createElement('tr');
    const reference = entry.refs.length
      ? entry.refs.map((ref) => String(ref + 1)).join(', ')
      : '—';
    const length = index > 0 ? `<input type="number" min="0.1" max="10" step="0.001" value="${entry.r}" data-index="${index}" data-coordinate="r" aria-label="Atom ${index + 1} bond length in angstroms">` : '—';
    const angle = entry.angle == null ? '—' : `<input type="number" min="0.1" max="180" step="0.1" value="${entry.angle}" data-index="${index}" data-coordinate="angle" aria-label="Atom ${index + 1} bond angle in degrees">`;
    const dihedral = entry.dihedral == null ? '—' : `<input type="number" min="-180" max="180" step="1" value="${entry.dihedral}" data-index="${index}" data-coordinate="dihedral" aria-label="Atom ${index + 1} dihedral in degrees">`;
    row.innerHTML = `<td><span class="mono">${index + 1}</span> · ${element}</td><td>${reference}</td><td>${length}</td><td>${angle}</td><td>${dihedral}</td>`;
    body.append(row);
  });
  $('#zmatRows').querySelectorAll('input').forEach((input) => {
    input.addEventListener('change', handleCoordinateChange);
  });
  $('#zmatStatus').textContent = 'Coordinates are editable; changes recalculate positions and all file outputs.';
  recalculateInternal();
}

function handleCoordinateChange(event) {
  const input = event.currentTarget;
  const index = Number(input.dataset.index);
  const coordinate = input.dataset.coordinate;
  const value = Number(input.value);
  const valid = Number.isFinite(value)
    && (coordinate === 'r' ? value > 0 && value <= 10
      : coordinate === 'angle' ? value > 0 && value <= 180
        : value >= -180 && value <= 180);
  if (!valid || input.value.trim() === '') {
    $('#zmatStatus').textContent = coordinate === 'r'
      ? 'Bond length must be greater than 0 and no more than 10 Å.'
      : coordinate === 'angle' ? 'Bond angle must be greater than 0° and no more than 180°.'
        : 'Dihedral angle must be between −180° and 180°.';
    input.value = String(currentInternal[index][coordinate]);
    return;
  }
  currentInternal[index][coordinate] = value;
  recalculateInternal();
}

function recalculateInternal() {
  try {
    currentPoints = toCartesian(currentInternal);
    $('#zmatStatus').textContent = 'Geometry updated · coordinates are in Å.';
    renderAtomLegend(MOLECULES[currentZmatKey].atoms);
    drawCanvasMolecule($('#zmatCanvas'), MOLECULES[currentZmatKey].atoms, currentPoints, 'ballStick', 0, 1, MOLECULES[currentZmatKey].bonds);
    $('#cartesianOutput').textContent = currentPoints.map((point, index) =>
      `${String(index + 1).padStart(2)} ${MOLECULES[currentZmatKey].atoms[index].padEnd(2)} ${point.map((value) => value.toFixed(6).padStart(12)).join('')}`
    ).join('\n');
    const zLines = currentInternal.map((entry, index) => {
      if (index === 0) return `${MOLECULES[currentZmatKey].atoms[index]}`;
      const refs = entry.refs.map((ref) => ref + 1);
      let line = `${MOLECULES[currentZmatKey].atoms[index]} ${refs[0]} r${index}`;
      if (entry.angle != null) line += ` ${refs[1]} a${index}`;
      if (entry.dihedral != null) line += ` ${refs[2]} d${index}`;
      return line;
    }).join('\n');
    const variables = currentInternal.flatMap((entry, index) => {
      if (index === 0) return [];
      const values = [`r${index} = ${entry.r.toFixed(4)} Å`];
      if (entry.angle != null) values.push(`a${index} = ${entry.angle.toFixed(2)}°`);
      if (entry.dihedral != null) values.push(`d${index} = ${entry.dihedral.toFixed(2)}°`);
      return values;
    });
    $('#zmatOutput').textContent = `${zLines}\n\nVariables\n${variables.join('\n')}`;
    updateOutputFiles();
  } catch (error) {
    $('#zmatStatus').textContent = `Unable to build these coordinates: ${error.message}`;
  }
}

function renderAtomLegend(atoms) {
  const counts = atoms.reduce((map, atom) => map.set(atom, (map.get(atom) || 0) + 1), new Map());
  $('#atomLegend').innerHTML = [...counts].map(([atom, count]) =>
    `<span class="legend-item"><span class="dot" style="background:${elements[atom]?.color || '#a5b6cb'}"></span>${atom} × ${count}</span>`
  ).join('');
}

function makeOutputLog(molecule, points, optimization = null) {
  const trace = optimization || optimizeScan(equilibriumBond[currentZmatKey], equilibriumBond[currentZmatKey], 12, 'lbfgs');
  const log = [
    `Molecular Geometry Lab · illustrative run`,
    `Molecule: ${molecule.name} (${molecule.formula})`,
    `Method: L-BFGS-style teaching trace; not a quantum chemistry calculation`,
    `Units: energy arbitrary; coordinates Å; gradient arbitrary/Å`,
    '',
    ' Step       Energy       ΔE          max|g|      max|Δx|',
    ' --------------------------------------------------------'
  ];
  trace.forEach((entry, index, list) => {
    const previous = list[index - 1];
    const deltaEnergy = previous ? entry.energy - previous.energy : 0;
    const displacement = previous ? Math.abs(entry.coordinate - previous.coordinate) : 0;
    log.push(`${String(entry.step).padStart(5)}  ${entry.energy.toFixed(7).padStart(12)}  ${deltaEnergy.toFixed(2).padStart(9)}  ${Math.abs(entry.gradient).toFixed(5).padStart(10)}  ${displacement.toFixed(5).padStart(10)}`);
  });
  const final = trace.at(-1);
  const previous = trace.at(-2);
  const energyConverged = Math.abs(final.energy - previous.energy) < 1e-6;
  const gradientConverged = Math.abs(final.gradient) < 0.01;
  const displacementConverged = Math.abs(final.coordinate - previous.coordinate) < 1e-3;
  const stationary = energyConverged && gradientConverged && displacementConverged;
  log.push('', 'Convergence checks (illustrative criteria):');
  log.push(`  energy change < 1.0e-6 : ${energyConverged ? 'PASS' : 'WARNING'}`);
  log.push(`  max gradient < 1.0e-2  : ${gradientConverged ? 'PASS' : 'WARNING'}`);
  log.push(`  max displacement < 1e-3: ${displacementConverged ? 'PASS' : 'WARNING'}`);
  log.push('', `Stationary point: ${stationary ? 'CONVERGED (minimum not confirmed by Hessian)' : 'NOT CONVERGED'}`);
  log.push('Hessian/frequency check: NOT PERFORMED · minimum vs. saddle is unconfirmed');
  log.push('', 'Final geometry (Å):');
  molecule.atoms.forEach((atom, index) => {
    log.push(`${String(index + 1).padStart(3)} ${atom.padEnd(2)} ${points[index].map((value) => value.toFixed(6).padStart(12)).join('')}`);
  });
  log.push('', 'End of illustrative educational log.');
  return log.join('\n');
}

function updateOutputFiles(optimization = null) {
  if (!currentPoints.length) return;
  const molecule = MOLECULES[currentZmatKey];
  $('#xyzOutput').textContent = formatXyz(molecule, currentPoints);
  $('#pdbOutput').textContent = formatPdb(molecule, currentPoints);
  $('#molOutput').textContent = formatMol(molecule, currentPoints);
  $('#logOutput').textContent = makeOutputLog(molecule, currentPoints, optimization);
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function drawCanvasMolecule(canvas, atoms, points, style, rotation, zoom, bonds) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const width = rect.width;
  const height = rect.height;
  context.clearRect(0, 0, width, height);
  if (!points.length) return;
  const center = points.reduce((sum, point) => sum.map((value, index) => value + point[index] / points.length), [0, 0, 0]);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const projected = points.map((point) => {
    const x = point[0] - center[0];
    const y = point[1] - center[1];
    const z = point[2] - center[2];
    const rx = x * cos - z * sin;
    const rz = x * sin + z * cos;
    return { x: width / 2 + rx * 82 * zoom, y: height / 2 + y * 82 * zoom - rz * 18 * zoom, depth: rz };
  });
  context.lineCap = 'round';
  bonds.forEach(([a, b, order]) => {
    const start = projected[a];
    const end = projected[b];
    const offsets = order === 2 ? [-2, 2] : [0];
    offsets.forEach((offset) => {
      context.beginPath();
      context.moveTo(start.x + offset, start.y + offset);
      context.lineTo(end.x + offset, end.y + offset);
      context.strokeStyle = '#91a5bd';
      context.lineWidth = style === 'stick' ? 5 : 4;
      context.stroke();
    });
  });
  projected.map((point, index) => ({ ...point, index })).sort((a, b) => a.depth - b.depth).forEach(({ x, y, index }) => {
    const atom = atoms[index];
    const config = elements[atom] || { color: '#b8c5d5', radius: .3 };
    const radius = style === 'stick' ? 4 : style === 'sphere' ? 18 : 10 + config.radius * 5;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = config.color;
    context.fill();
    context.strokeStyle = 'rgba(255,255,255,.55)';
    context.lineWidth = 1;
    context.stroke();
    if (style !== 'sphere') {
      context.fillStyle = atom === 'H' ? '#253348' : '#101a2a';
      context.font = '600 10px "DM Mono", monospace';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(atom, x, y);
    }
  });
}

function updateViewerGeometry() {
  if (viewer) {
    const molecule = MOLECULES[currentViewerKey];
    const group = viewer.group;
    group.children.forEach((object) => {
      object.geometry.dispose();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material.dispose();
    });
    group.clear();
    const points = molecule.viewer;
    const centers = points.map((point) => new threeModule.Vector3(...point));
    molecule.bonds.forEach(([first, second, order]) => {
      const start = centers[first];
      const end = centers[second];
      const vector = new threeModule.Vector3().subVectors(end, start);
      const length = vector.length();
      const count = order === 2 ? 2 : 1;
      for (let bondIndex = 0; bondIndex < count; bondIndex += 1) {
        const radius = viewerStyle === 'stick' ? .065 : .045;
        const geometry = new threeModule.CylinderGeometry(radius, radius, length, 12);
        const material = new threeModule.MeshStandardMaterial({ color: '#93a8bf', roughness: .48 });
        const bond = new threeModule.Mesh(geometry, material);
        bond.position.copy(start).add(end).multiplyScalar(.5);
        bond.quaternion.setFromUnitVectors(new threeModule.Vector3(0, 1, 0), vector.clone().normalize());
        group.add(bond);
      }
    });
    centers.forEach((center, index) => {
      const atom = molecule.atoms[index];
      const info = elements[atom] || elements.C;
      const radius = viewerStyle === 'sphere' ? info.radius * 1.7 : viewerStyle === 'stick' ? .12 : info.radius;
      const geometry = new threeModule.SphereGeometry(radius, 24, 16);
      const material = new threeModule.MeshStandardMaterial({ color: info.color, roughness: .38, metalness: .03 });
      const mesh = new threeModule.Mesh(geometry, material);
      mesh.position.copy(center);
      group.add(mesh);
    });
    group.rotation.set(.16, 0, 0);
    viewer.controls.azimuth = 0;
    viewer.controls.elevation = .16;
    viewer.render();
  } else {
    const molecule = MOLECULES[currentViewerKey];
    drawCanvasMolecule($('#moleculeViewer'), molecule.atoms, molecule.viewer, viewerStyle, fallbackRotation, fallbackZoom, molecule.bonds);
  }
  $('#viewerCaption').textContent = `${MOLECULES[currentViewerKey].name} · ${MOLECULES[currentViewerKey].description}`;
}

function addViewerControls(canvas) {
  const dragStart = (event) => {
    fallbackDrag = { x: event.clientX, y: event.clientY, azimuth: viewer?.controls.azimuth || 0, elevation: viewer?.controls.elevation || 0 };
    canvas.setPointerCapture?.(event.pointerId);
  };
  const dragMove = (event) => {
    if (!fallbackDrag) return;
    const dx = event.clientX - fallbackDrag.x;
    const dy = event.clientY - fallbackDrag.y;
    if (viewer) {
      viewer.controls.azimuth = fallbackDrag.azimuth + dx * .008;
      viewer.controls.elevation = Math.max(-1.35, Math.min(1.35, fallbackDrag.elevation + dy * .008));
      viewer.group.rotation.set(viewer.controls.elevation, viewer.controls.azimuth, 0);
      viewer.render();
    } else {
      fallbackRotation = fallbackDrag.azimuth + dx * .01;
      drawCanvasMolecule(canvas, MOLECULES[currentViewerKey].atoms, MOLECULES[currentViewerKey].viewer, viewerStyle, fallbackRotation, fallbackZoom, MOLECULES[currentViewerKey].bonds);
    }
  };
  canvas.addEventListener('pointerdown', dragStart);
  canvas.addEventListener('pointermove', dragMove);
  canvas.addEventListener('pointerup', () => { fallbackDrag = null; });
  canvas.addEventListener('pointercancel', () => { fallbackDrag = null; });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    if (viewer) {
      viewer.camera.position.multiplyScalar(event.deltaY > 0 ? 1.08 : .92);
      viewer.camera.position.clampLength(2.2, 12);
      viewer.render();
    } else {
      fallbackZoom = Math.max(.55, Math.min(2.8, fallbackZoom * (event.deltaY > 0 ? .92 : 1.08)));
      drawCanvasMolecule(canvas, MOLECULES[currentViewerKey].atoms, MOLECULES[currentViewerKey].viewer, viewerStyle, fallbackRotation, fallbackZoom, MOLECULES[currentViewerKey].bonds);
    }
  }, { passive: false });
  canvas.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      fallbackRotation += event.key === 'ArrowRight' ? .18 : -.18;
      if (viewer) {
        viewer.controls.azimuth = fallbackRotation;
        viewer.group.rotation.y = fallbackRotation;
        viewer.render();
      } else {
        drawCanvasMolecule(canvas, MOLECULES[currentViewerKey].atoms, MOLECULES[currentViewerKey].viewer, viewerStyle, fallbackRotation, fallbackZoom, MOLECULES[currentViewerKey].bonds);
      }
    }
  });
}

function initializeThreeViewer(THREE, canvas) {
  if (viewer) {
    viewer.resizeObserver.disconnect();
    viewer.renderer.dispose();
    viewer = null;
  }
  const rect = canvas.getBoundingClientRect();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(Math.max(rect.width, 1), Math.max(rect.height, 1), false);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, Math.max(rect.width, 1) / Math.max(rect.height, 1), .1, 100);
  camera.position.set(0, 0, 5.2);
  scene.add(new THREE.AmbientLight(0xffffff, 1.7));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
  keyLight.position.set(3, 5, 6);
  scene.add(keyLight);
  const group = new THREE.Group();
  scene.add(group);
  const render = () => renderer.render(scene, camera);
  const resizeObserver = new ResizeObserver(() => {
    const bounds = canvas.getBoundingClientRect();
    renderer.setSize(Math.max(bounds.width, 1), Math.max(bounds.height, 1), false);
    camera.aspect = Math.max(bounds.width, 1) / Math.max(bounds.height, 1);
    camera.updateProjectionMatrix();
    render();
  });
  resizeObserver.observe(canvas);
  viewer = { renderer, scene, camera, group, render, resizeObserver, controls: { azimuth: 0, elevation: .16 } };
  $('#viewerFallback').hidden = true;
  $('#viewerFallback').textContent = '';
  updateViewerGeometry();
}

async function loadViewer() {
  const canvas = $('#moleculeViewer');
  const generation = ++viewerGeneration;
  try {
    if (!threeModule) {
      threeModule = await import('https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js');
    }
    if (generation !== viewerGeneration) return;
    initializeThreeViewer(threeModule, canvas);
  } catch {
    if (generation !== viewerGeneration) return;
    if (viewer) {
      viewer.resizeObserver.disconnect();
      viewer.renderer.dispose();
      viewer = null;
    }
    $('#viewerFallback').textContent = 'Three.js could not be loaded. Interactive 2D projection fallback is active; drag to rotate and use the wheel to zoom.';
    $('#viewerFallback').hidden = false;
    drawCanvasMolecule(canvas, MOLECULES[currentViewerKey].atoms, MOLECULES[currentViewerKey].viewer, viewerStyle, fallbackRotation, fallbackZoom, MOLECULES[currentViewerKey].bonds);
  }
}

function renderQuiz() {
  const container = $('#quizContainer');
  container.innerHTML = quizQuestions.map((item, index) => `
    <fieldset class="question" data-question="${index}">
      <legend>${index + 1}. ${item.question}</legend>
      <div class="answers">${item.choices.map((choice, choiceIndex) => `
        <label class="answer"><input type="radio" name="question-${index}" value="${choiceIndex}"><span>${choice}</span></label>
      `).join('')}</div>
      <p class="feedback" aria-live="polite"></p>
    </fieldset>
  `).join('');
  container.querySelectorAll('input[type="radio"]').forEach((input) => input.addEventListener('change', handleQuizAnswer));
}

function handleQuizAnswer(event) {
  const index = Number(event.currentTarget.closest('[data-question]').dataset.question);
  const selected = Number(event.currentTarget.value);
  const question = quizQuestions[index];
  const fieldset = event.currentTarget.closest('[data-question]');
  const feedback = fieldset.querySelector('.feedback');
  const correct = selected === question.answer;
  feedback.textContent = `${correct ? 'Correct. ' : 'Not quite. '}${question.explanation}`;
  feedback.className = `feedback ${correct ? 'correct' : 'incorrect'}`;
  fieldset.querySelectorAll('input').forEach((input) => { input.disabled = true; });
  updateQuizScore();
}

function updateQuizScore() {
  const answers = [...$('#quizContainer').querySelectorAll('[data-question]')];
  const answered = answers.filter((fieldset) => fieldset.querySelector('input:checked')).length;
  const correct = answers.filter((fieldset) => {
    const input = fieldset.querySelector('input:checked');
    return input && Number(input.value) === quizQuestions[Number(fieldset.dataset.question)].answer;
  }).length;
  $('#quizScore').textContent = answered === answers.length ? `Score · ${correct} / ${answers.length}` : `${answered} / ${answers.length} answered`;
}

function setupNavigation() {
  const button = $('#menuButton');
  const nav = $('#primaryNav');
  button.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    button.setAttribute('aria-expanded', String(open));
  });
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    nav.classList.remove('open');
    button.setAttribute('aria-expanded', 'false');
  }));
}

function setupFormatTabs() {
  document.querySelectorAll('.format-tab').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.format-tab').forEach((tab) => {
        const active = tab === button;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
      });
      document.querySelectorAll('.format-panel').forEach((panel) => {
        panel.classList.toggle('active', panel.id === button.getAttribute('aria-controls'));
      });
    });
    button.addEventListener('keydown', (event) => {
      const tabs = [...document.querySelectorAll('.format-tab')];
      const index = tabs.indexOf(button);
      const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length
          : -1;
      if (next >= 0) {
        event.preventDefault();
        tabs[next].focus();
        tabs[next].click();
      }
    });
  });
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Clipboard access is unavailable in this browser.');
}

function setupFileActions() {
  document.querySelectorAll('.copy-button').forEach((button) => button.addEventListener('click', async () => {
    try {
      await copyText($(`#${button.dataset.target}`).textContent);
      $('#copyStatus').textContent = 'Copied to clipboard.';
    } catch (error) {
      $('#copyStatus').textContent = error.message;
    }
  }));
  document.querySelectorAll('.download-button').forEach((button) => button.addEventListener('click', () => {
    const content = $(`#${button.dataset.target}`).textContent;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = button.dataset.filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    $('#copyStatus').textContent = `${button.dataset.filename} downloaded.`;
  }));
}

function setupViewer() {
  const canvas = $('#moleculeViewer');
  addViewerControls(canvas);
  $('#viewerMolecule').addEventListener('change', (event) => {
    currentViewerKey = event.target.value;
    fallbackRotation = 0;
    if (viewer) updateViewerGeometry();
    else loadViewer();
    $('#viewerCaption').textContent = `${MOLECULES[currentViewerKey].name} · ${MOLECULES[currentViewerKey].description}`;
  });
  $('#viewerStyle').addEventListener('change', (event) => {
    viewerStyle = event.target.value;
    if (viewer) updateViewerGeometry();
    else drawCanvasMolecule(canvas, MOLECULES[currentViewerKey].atoms, MOLECULES[currentViewerKey].viewer, viewerStyle, fallbackRotation, fallbackZoom, MOLECULES[currentViewerKey].bonds);
  });
  $('#viewerReset').addEventListener('click', () => {
    fallbackRotation = 0;
    fallbackZoom = 1;
    if (viewer) {
      viewer.camera.position.set(0, 0, 5.2);
      viewer.controls.azimuth = 0;
      viewer.controls.elevation = .16;
      viewer.group.rotation.set(.16, 0, 0);
      viewer.render();
    } else {
      drawCanvasMolecule(canvas, MOLECULES[currentViewerKey].atoms, MOLECULES[currentViewerKey].viewer, viewerStyle, fallbackRotation, fallbackZoom, MOLECULES[currentViewerKey].bonds);
    }
  });
  loadViewer();
}

function initializeApp() {
  setupCharts();
  setupNavigation();
  setupFormatTabs();
  setupFileActions();
  renderQuiz();
  $('#simMolecule').addEventListener('change', updateSimulatorControls);
  $('#scanCoordinate').addEventListener('input', (event) => {
    const value = Number(event.target.value);
    $('#scanValue').textContent = `${value.toFixed(2)} Å`;
    updateEnergyScan($('#simMolecule').value, value);
  });
  $('#optimizer').addEventListener('change', () => { $('#simStatus').textContent = `Selected ${$('#optimizer').selectedOptions[0].textContent}. Run the simulator to compare its illustrative trace.`; });
  $('#runOptimization').addEventListener('click', runOptimization);
  $('#zmatMolecule').addEventListener('change', (event) => {
    currentZmatKey = event.target.value;
    renderZMatrixTable();
  });
  $('#resetQuiz').addEventListener('click', renderQuiz);
  $('#viewerCaption').textContent = `${MOLECULES[currentViewerKey].name} · ${MOLECULES[currentViewerKey].description}`;
  updateSimulatorControls();
  renderZMatrixTable();
  setupViewer();
}

initializeApp();
