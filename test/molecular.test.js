import test from 'node:test';
import assert from 'node:assert/strict';
import { MOLECULES, formatMol, formatPdb, formatXyz, harmonicEnergy, optimizeScan, toCartesian } from '../src/molecular.js';

test('preset Z-matrices produce finite Cartesian geometries and expected teaching bond lengths', () => {
  const water = toCartesian(MOLECULES.water.internal);
  assert.equal(water.length, 3);
  assert.ok(water.flat().every(Number.isFinite));
  assert.ok(Math.abs(Math.hypot(...water[1]) - 0.958) < 1e-8);
  assert.ok(Math.abs(Math.hypot(...water[2]) - 0.958) < 1e-8);

  const co2 = toCartesian(MOLECULES.carbonDioxide.internal);
  assert.ok(Math.abs(Math.hypot(...co2[1]) - 1.16) < 1e-8);
  assert.ok(Math.abs(Math.hypot(co2[2][0] - co2[1][0], co2[2][1] - co2[1][1], co2[2][2] - co2[1][2]) - 1.16) < 1e-8);
  assert.ok(co2[2][0] > co2[1][0]);

  const methane = toCartesian(MOLECULES.methane.internal);
  assert.equal(methane.length, 5);
  assert.ok(methane.flat().every(Number.isFinite));
  for (let first = 1; first < methane.length; first += 1) {
    for (let second = first + 1; second < methane.length; second += 1) {
      const distance = Math.hypot(...methane[first].map((value, axis) => value - methane[second][axis]));
      assert.ok(Math.abs(distance - 1.77995) < 5e-5, 'methane hydrogen atoms should form a tetrahedral geometry');
    }
  }
});

test('internal coordinates reject invalid lengths, angles, and forward references', () => {
  assert.throws(() => toCartesian([{ refs: [] }, { refs: [0], r: 0 }]), /Bond lengths/);
  assert.throws(() => toCartesian([{ refs: [] }, { refs: [0], r: 1 }, { refs: [0, 1], r: 1, angle: 181 }]), /Bond angles/);
  assert.throws(() => toCartesian([{ refs: [] }, { refs: [2], r: 1 }]), /preceding atom/);
});

test('ammonia viewer preset is pyramidal rather than planar', () => {
  const [nitrogen, ...hydrogens] = MOLECULES.ammonia.viewer;
  assert.ok(hydrogens.every((hydrogen) => hydrogen[2] > 0));
  const vectors = hydrogens.map((hydrogen) => hydrogen.map((value, axis) => value - nitrogen[axis]));
  const angle = Math.acos(
    vectors[0].reduce((sum, value, axis) => sum + value * vectors[1][axis], 0)
      / (Math.hypot(...vectors[0]) * Math.hypot(...vectors[1]))
  ) * 180 / Math.PI;
  assert.ok(angle > 100 && angle < 110);
});

test('XYZ output has atom count and comment but no connectivity block', () => {
  const xyz = formatXyz(MOLECULES.water, toCartesian(MOLECULES.water.internal));
  assert.match(xyz, /^3\nWater teaching geometry\n/);
  assert.match(xyz, /O\s+0\.000000/);
  assert.equal(xyz.includes('CONECT'), false);
});

test('PDB output uses coordinate records and reciprocal CONECT records', () => {
  const pdb = formatPdb(MOLECULES.carbonDioxide, MOLECULES.carbonDioxide.viewer);
  assert.match(pdb, /^HEADER/);
  assert.equal((pdb.match(/^HETATM/gm) || []).length, 3);
  assert.ok(pdb.includes('CONECT    1    2'));
  assert.ok(pdb.includes('CONECT    3    2'));
  assert.match(pdb, /\nEND\n$/);
});

test('MOL V2000 output includes counts, atom and explicit bond-order blocks', () => {
  const mol = formatMol(MOLECULES.carbonDioxide, MOLECULES.carbonDioxide.viewer);
  assert.match(mol, /3 {2}2 {2}0 {2}0 {2}0 {2}0 {12}999 V2000/);
  assert.equal((mol.match(/^\s*-?\d+\.\d{4}/gm) || []).length, 3);
  assert.match(mol, /\s+2 {2}0 {2}0 {2}0 {2}0/);
  assert.match(mol, /M {2}END\n$/);
});

test('harmonic PES and optimization traces converge according to selected method', () => {
  assert.equal(harmonicEnergy(1, 1), 0);
  assert.equal(harmonicEnergy(2, 1), 45);
  const trace = optimizeScan(1.6, 0.958, 30, 'lbfgs');
  assert.equal(trace.length, 31);
  assert.ok(Math.abs(trace.at(-1).coordinate - 0.958) < Math.abs(trace[0].coordinate - 0.958));
  assert.ok(Math.abs(trace.at(-1).gradient) < Math.abs(trace[0].gradient));
  assert.throws(() => optimizeScan(1, 1, 101, 'newton'), /1–100/);
  assert.throws(() => optimizeScan(1, 1, 10, 'unknown'), /Unknown optimizer/);
});
