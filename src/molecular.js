export const MOLECULES = {
  water: {
    name: 'Water',
    formula: 'H2O',
    atoms: ['O', 'H', 'H'],
    bonds: [[0, 1, 1], [0, 2, 1]],
    internal: [{ refs: [] }, { refs: [0], r: 0.958 }, { refs: [0, 1], r: 0.958, angle: 104.5 }],
    viewer: [[0, 0, 0], [0.958, 0, 0], [-0.24, 0.927, 0]],
    description: 'Bent · H–O–H angle ≈ 104.5°'
  },
  carbonDioxide: {
    name: 'Carbon dioxide',
    formula: 'CO2',
    atoms: ['O', 'C', 'O'],
    bonds: [[0, 1, 2], [1, 2, 2]],
    internal: [{ refs: [] }, { refs: [0], r: 1.16 }, { refs: [1, 0], r: 1.16, angle: 180 }],
    viewer: [[-1.16, 0, 0], [0, 0, 0], [1.16, 0, 0]],
    description: 'Linear · O=C=O angle = 180°'
  },
  methane: {
    name: 'Methane',
    formula: 'CH4',
    atoms: ['C', 'H', 'H', 'H', 'H'],
    bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]],
    internal: [
      { refs: [] },
      { refs: [0], r: 1.09 },
      { refs: [0, 1], r: 1.09, angle: 109.47 },
      { refs: [0, 1, 2], r: 1.09, angle: 109.47, dihedral: 120 },
      { refs: [0, 1, 2], r: 1.09, angle: 109.47, dihedral: -120 }
    ],
    viewer: [[0, 0, 0], [0.629, 0.629, 0.629], [0.629, -0.629, -0.629], [-0.629, 0.629, -0.629], [-0.629, -0.629, 0.629]],
    description: 'Tetrahedral · H–C–H angle ≈ 109.5°'
  },
  ammonia: {
    name: 'Ammonia',
    formula: 'NH3',
    atoms: ['N', 'H', 'H', 'H'],
    bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1]],
    internal: [
      { refs: [] },
      { refs: [0], r: 1.012 },
      { refs: [0, 1], r: 1.012, angle: 106.7 },
      { refs: [0, 1, 2], r: 1.012, angle: 106.7, dihedral: 120 }
    ],
    viewer: [[0, 0, 0], [0.937, 0, 0.382], [-0.4685, 0.8113, 0.382], [-0.4685, -0.8113, 0.382]],
    description: 'Trigonal pyramidal · N–H bond length ≈ 1.012 Å'
  },
  boronTrifluoride: {
    name: 'Boron trifluoride',
    formula: 'BF3',
    atoms: ['B', 'F', 'F', 'F'],
    bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1]],
    internal: [
      { refs: [] },
      { refs: [0], r: 1.31 },
      { refs: [0, 1], r: 1.31, angle: 120 },
      { refs: [0, 1, 2], r: 1.31, angle: 120, dihedral: 120 }
    ],
    viewer: [[0, 0, 0], [1.31, 0, 0], [-0.655, 1.1347, 0], [-0.655, -1.1347, 0]],
    description: 'Trigonal planar · F–B–F angle = 120°'
  },
  sulfurHexafluoride: {
    name: 'Sulfur hexafluoride',
    formula: 'SF6',
    atoms: ['S', 'F', 'F', 'F', 'F', 'F', 'F'],
    bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1], [0, 5, 1], [0, 6, 1]],
    internal: [],
    viewer: [[0, 0, 0], [1.56, 0, 0], [-1.56, 0, 0], [0, 1.56, 0], [0, -1.56, 0], [0, 0, 1.56], [0, 0, -1.56]],
    description: 'Octahedral · S–F bond length ≈ 1.56 Å'
  },
  phosphorusPentachloride: {
    name: 'Phosphorus pentachloride',
    formula: 'PCl5',
    atoms: ['P', 'Cl', 'Cl', 'Cl', 'Cl', 'Cl'],
    bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1], [0, 5, 1]],
    internal: [],
    viewer: [[0, 0, 0], [0, 0, 2.14], [0, 0, -2.14], [2.02, 0, 0], [-1.01, 1.7495, 0], [-1.01, -1.7495, 0]],
    description: 'Trigonal bipyramidal · axial/equatorial P–Cl ≈ 2.14/2.02 Å'
  },
  formaldehyde: {
    name: 'Formaldehyde',
    formula: 'CH2O',
    atoms: ['C', 'O', 'H', 'H'],
    bonds: [[0, 1, 2], [0, 2, 1], [0, 3, 1]],
    internal: [],
    viewer: [[0, 0, 0], [1.21, 0, 0], [-0.59, 0.94, 0], [-0.59, -0.94, 0]],
    description: 'Planar · simplified teaching geometry'
  }
};

const add = (a, b) => a.map((value, index) => value + b[index]);
const subtract = (a, b) => a.map((value, index) => value - b[index]);
const scale = (vector, scalar) => vector.map((value) => value * scalar);
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (vector) => {
  const length = Math.hypot(...vector);
  if (length < 1e-10) throw new RangeError('Degenerate internal coordinate references');
  return scale(vector, 1 / length);
};

export function toCartesian(internal) {
  if (!Array.isArray(internal) || !internal.length) throw new TypeError('An internal coordinate list is required');
  const points = [];
  internal.forEach((entry, index) => {
    if (index === 0) {
      points.push([0, 0, 0]);
      return;
    }
    const r = Number(entry.r);
    if (!Number.isFinite(r) || r <= 0 || r > 10) throw new RangeError('Bond lengths must be greater than 0 and no more than 10 Å');
    const references = entry.refs || [];
    if (references.some((ref) => !Number.isInteger(ref) || ref < 0 || ref >= index)) {
      throw new RangeError('Each reference must point to a preceding atom');
    }
    if (index === 1) {
      points.push([r, 0, 0]);
      return;
    }
    const theta = Number(entry.angle);
    if (!Number.isFinite(theta) || theta <= 0 || theta > 180) throw new RangeError('Bond angles must be greater than 0 and no more than 180 degrees');
    const thetaRad = theta * Math.PI / 180;
    const origin = points[references[0]];
    const towardPrevious = normalize(subtract(points[references[1]], origin));
    if (index === 2 || references.length < 3) {
      let perpendicular = cross([0, 0, 1], towardPrevious);
      if (Math.hypot(...perpendicular) < 1e-8) perpendicular = cross([0, 1, 0], towardPrevious);
      perpendicular = normalize(perpendicular);
      const direction = add(scale(towardPrevious, Math.cos(thetaRad)), scale(perpendicular, Math.sin(thetaRad)));
      points.push(add(origin, scale(direction, r)));
      return;
    }
    const previous = points[references[1]];
    const planeAtom = points[references[2]];
    const axis = normalize(subtract(origin, previous));
    let normal = cross(axis, subtract(planeAtom, previous));
    if (Math.hypot(...normal) < 1e-8) normal = cross(axis, [0, 0, 1]);
    normal = normalize(normal);
    const inPlane = normalize(cross(normal, axis));
    const phi = Number(entry.dihedral || 0) * Math.PI / 180;
    const direction = add(
      scale(axis, -Math.cos(thetaRad)),
      scale(add(scale(inPlane, Math.cos(phi)), scale(normal, Math.sin(phi))), Math.sin(thetaRad))
    );
    if (!Number.isFinite(dot(direction, direction))) throw new RangeError('Invalid internal coordinate geometry');
    points.push(add(origin, scale(direction, r)));
  });
  return points;
}

export function validateCoordinates(atoms, points) {
  if (!Array.isArray(atoms) || !Array.isArray(points) || atoms.length !== points.length || !atoms.length) {
    throw new TypeError('Atoms and coordinates must be non-empty arrays of equal length');
  }
  points.forEach((point) => {
    if (!Array.isArray(point) || point.length !== 3 || point.some((value) => !Number.isFinite(value))) {
      throw new TypeError('Every atom must have three finite coordinates');
    }
  });
}

export function formatXyz(molecule, points, title = `${molecule.name} teaching geometry`) {
  validateCoordinates(molecule.atoms, points);
  return `${molecule.atoms.length}\n${title}\n${molecule.atoms.map((element, index) =>
    `${element.padEnd(2)} ${points[index].map((value) => value.toFixed(6).padStart(12)).join(' ')}`
  ).join('\n')}\n`;
}

export function formatPdb(molecule, points) {
  validateCoordinates(molecule.atoms, points);
  const atomLines = molecule.atoms.map((element, index) => {
    const [x, y, z] = points[index];
    return `HETATM${String(index + 1).padStart(5)} ${`${element}${index + 1}`.padEnd(4)} MOL A   1    ${x.toFixed(3).padStart(8)}${y.toFixed(3).padStart(8)}${z.toFixed(3).padStart(8)}  1.00  0.00          ${element.padEnd(2)}  `;
  });
  const neighbors = molecule.atoms.map(() => []);
  molecule.bonds.forEach(([a, b]) => {
    neighbors[a].push(b);
    neighbors[b].push(a);
  });
  const conect = neighbors.flatMap((connected, index) => connected.length
    ? [`CONECT${String(index + 1).padStart(5)}${connected.map((neighbor) => String(neighbor + 1).padStart(5)).join('')}`]
    : []);
  return `HEADER    ${molecule.name.toUpperCase()} TEACHING GEOMETRY\n${atomLines.join('\n')}\n${conect.join('\n')}\nEND\n`;
}

export function formatMol(molecule, points) {
  validateCoordinates(molecule.atoms, points);
  const bonds = molecule.bonds;
  const header = `${molecule.name}\n  Molecular Geometry Lab\n\n${String(molecule.atoms.length).padStart(3)}${String(bonds.length).padStart(3)}  0  0  0  0            999 V2000`;
  const atomLines = molecule.atoms.map((element, index) =>
    `${points[index].map((value) => value.toFixed(4).padStart(10)).join('')} ${element.padEnd(3)} 0  0  0  0  0  0  0  0  0  0  0  0  0`
  );
  const bondLines = bonds.map(([a, b, order]) =>
    `${String(a + 1).padStart(3)}${String(b + 1).padStart(3)}${String(order).padStart(3)}  0  0  0  0`
  );
  return `${header}\n${atomLines.join('\n')}\n${bondLines.join('\n')}\nM  END\n`;
}

export function harmonicEnergy(coordinate, equilibrium, forceConstant = 90) {
  if (![coordinate, equilibrium, forceConstant].every(Number.isFinite) || forceConstant <= 0) {
    throw new RangeError('Energy scan parameters must be finite and the force constant positive');
  }
  return 0.5 * forceConstant * (coordinate - equilibrium) ** 2;
}

export function optimizeScan(start, equilibrium, steps, method) {
  if (!Number.isFinite(start) || !Number.isFinite(equilibrium) || !Number.isInteger(steps) || steps < 1 || steps > 100) {
    throw new RangeError('Optimization requires a finite start and 1–100 integer steps');
  }
  const rates = { steepest: 0.22, conjugate: 0.42, lbfgs: 0.58, newton: 0.82 };
  const rate = rates[method];
  if (!rate) throw new RangeError('Unknown optimizer');
  const trace = [];
  let coordinate = start;
  for (let step = 0; step <= steps; step += 1) {
    trace.push({ step, coordinate, energy: harmonicEnergy(coordinate, equilibrium), gradient: 90 * (coordinate - equilibrium) });
    coordinate = coordinate + rate * (equilibrium - coordinate);
  }
  return trace;
}
