import test from 'node:test';
import assert from 'node:assert/strict';
import { MOLECULES, formatMol, formatPdb, formatXyz, harmonicEnergy, optimizeScan, toCartesian, validateCoordinates } from '../src/molecular.js';

test('new preset molecules contain finite, matching non-degenerate viewer geometries', () => {
  for (const key of ['ammonia', 'boronTrifluoride', 'sulfurHexafluoride', 'phosphorusPentachloride']) {
    const molecule = MOLECULES[key];
    assert.equal(molecule.atoms.length, molecule.viewer.length);
    validateCoordinates(molecule.atoms, molecule.viewer);
    assert.ok(molecule.bonds.length > 0);
  }

  assert.equal(MOLECULES.ammonia.atoms.join(','), 'N,H,H,H');
  assert.equal(MOLECULES.boronTrifluoride.formula, 'BF3');
  assert.equal(MOLECULES.sulfurHexafluoride.formula, 'SF6');
  assert.equal(MOLECULES.phosphorusPentachloride.formula, 'PCl5');

  const sf6 = MOLECULES.sulfurHexafluoride.viewer;
  assert.equal(new Set(sf6.slice(1).map((point) => point.join(','))).size, 6);
});

test('ammonia and boron trifluoride internal coordinates are finite and non-degenerate', () => {
  for (const key of ['ammonia', 'boronTrifluoride']) {
    const points = toCartesian(MOLECULES[key].internal);
    assert.equal(points.length, MOLECULES[key].atoms.length);
    assert.ok(points.flat().every(Number.isFinite));
  }
});

test('new presets produce valid XYZ, PDB, and MOL output', () => {
  for (const key of ['ammonia', 'boronTrifluoride', 'sulfurHexafluoride', 'phosphorusPentachloride']) {
    const molecule = MOLECULES[key];
    assert.match(formatXyz(molecule, molecule.viewer), new RegExp(`^${molecule.atoms.length}\\n`));
    assert.match(formatPdb(molecule, molecule.viewer), /^HEADER/);
    assert.match(formatMol(molecule, molecule.viewer), /M  END\n$/);
  }
});

test('preset Z-matrices produce finite Cartesian geometries and expected teaching bond lengths', () => {
  const water = toCartesian(MOLECULES.water.internal);
  assert.equal(water.length, 3);
  assert.ok(water.flat().every(Number.isFinite));
  assert.ok(Math.abs(Math.hypot(...water[1]) - 0.958) < 1e-8);

  const co2 = toCartesian(MOLECULES.carbonDioxide.internal);
  assert.ok(Math.abs(Math.hypot(co2[2][0] - co2[1][0], co2[2][1] - co2[1][1], co2[2][2] - co2[1][2]) - 1.16) < 1e-8);

  const methane = toCartesian(MOLECULES.methane.internal);
  assert.equal(methane.length, 5);
  assert.ok(methane.flat().every(Number.isFinite));
});

test('internal coordinates reject invalid lengths, angles, and forward references', () => {
  assert.throws(() => toCartesian([{ refs: [] }, { refs: [0], r: 0 }]), /Bond lengths/);
  assert.throws(() => toCartesian([{ refs: [] }, { refs: [0], r: 1 }, { refs: [0, 1], r: 1, angle: 181 }]), /Bond angles/);
  assert.throws(() => toCartesian([{ refs: [] }, { refs: [2], r: 1 }]), /preceding atom/);
});

test('harmonic PES and optimization traces converge according to selected method', () => {
  assert.equal(harmonicEnergy(1, 1), 0);
  assert.equal(harmonicEnergy(2, 1), 45);
  const trace = optimizeScan(1.6, 0.958, 30, 'lbfgs');
  assert.equal(trace.length, 31);
  assert.ok(Math.abs(trace.at(-1).coordinate - 0.958) < Math.abs(trace[0].coordinate - 0.958));
  assert.ok(Math.abs(trace.at(-1).gradient) < Math.abs(trace[0].gradient));
});
