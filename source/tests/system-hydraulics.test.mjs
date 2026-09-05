import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SYSTEM_DEFAULTS,
  branchDrop,
  calculateSystem,
  commonDrop,
  distributeFlow,
  pumpPressure,
  systemPressure,
  validateSystem,
} from '../lib/system-hydraulics.ts';

const clone = () => structuredClone(SYSTEM_DEFAULTS);
const near = (actual, expected, rel = 1e-7) => assert.ok(
  Math.abs(actual - expected) <= Math.max(1e-9, Math.abs(expected) * rel),
  `${actual} differs from ${expected}`,
);

test('three-point pump curve passes through all entered points', () => {
  const p = SYSTEM_DEFAULTS.pump;
  near(pumpPressure(p, 0), p.shutoffPressure);
  near(pumpPressure(p, p.designFlow), p.designPressure);
  near(pumpPressure(p, p.maxFlow), 0);
});

test('common segments are in series and include quantity', () => {
  const one = clone();
  one.common = [{ id: 'one', name: 'one', count: 1, diameter: 20, length: 2, k: 1 }];
  const repeated = clone();
  repeated.common = [{ ...one.common[0], count: 3 }];
  near(commonDrop(repeated, 10), commonDrop(one, 10) * 3, 1e-10);
});

test('identical parallel paths split flow equally', () => {
  const i = clone();
  const branch = i.branches[0];
  i.branches = [{ ...branch, count: 4 }];
  const result = distributeFlow(i, 20);
  near(result.branches[0].flowPerPath, 5, 1e-7);
  near(result.branches[0].groupFlow, 20, 1e-7);
});

test('unequal branches reach equal pressure and conserve total flow', () => {
  const i = clone();
  const result = distributeFlow(i, 18);
  near(result.branches.reduce((sum, b) => sum + b.groupFlow, 0), 18, 1e-7);
  for (const row of result.branches) near(row.total, result.pressure, 2e-7);
  assert.ok(result.branches[0].flowPerPath > result.branches[2].flowPerPath);
});

test('cold-plate reference curve uses entered pressure and exponent', () => {
  const i = clone();
  const b = { ...i.branches[0], length: 0, k: 0, referenceFlow: 2, referenceDrop: 20, exponent: 2 };
  near(branchDrop(i, b, 2).component, 20000);
  near(branchDrop(i, b, 4).component, 80000);
});

test('operating point balances pump and system curves', () => {
  const i = clone();
  const result = calculateSystem(i);
  assert.equal(result.ok, true, JSON.stringify(result));
  near(result.pumpPressure, result.pressure, 2e-7);
  const direct = systemPressure(i, result.flow);
  near(direct.total, result.pressure, 2e-7);
  assert.ok(result.flow > 0 && result.flow < i.pump.maxFlow);
  assert.equal(result.branches.length, i.branches.length);
});

test('invalid system inputs are rejected without a plausible result', () => {
  const bad = clone();
  bad.branches[0].count = 0;
  bad.pump.designFlow = bad.pump.maxFlow;
  assert.ok(validateSystem(bad).length >= 2);
  assert.equal(calculateSystem(bad).ok, false);
});
