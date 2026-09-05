import { DEFAULTS, calculate, properties, type Fluid, type Method } from './hydraulics.ts';

export type CommonSegment = {
  id: string;
  name: string;
  count: number;
  diameter: number;
  length: number;
  k: number;
};

export type ParallelBranch = {
  id: string;
  name: string;
  count: number;
  diameter: number;
  length: number;
  k: number;
  referenceFlow: number;
  referenceDrop: number;
  exponent: number;
};

export type PumpCurve = {
  shutoffPressure: number;
  designFlow: number;
  designPressure: number;
  maxFlow: number;
};

export type SystemInputs = {
  fluid: Fluid;
  temperature: number;
  roughness: number;
  method: Method;
  common: CommonSegment[];
  branches: ParallelBranch[];
  pump: PumpCurve;
};

export const SYSTEM_DEFAULTS: SystemInputs = {
  fluid: 'eg50',
  temperature: 45,
  roughness: 0.0015,
  method: 'colebrook',
  common: [
    { id: 'supply', name: '供液主管', count: 1, diameter: 25, length: 3, k: 2 },
    { id: 'return', name: '回液主管', count: 1, diameter: 25, length: 3, k: 2 },
  ],
  branches: [
    { id: 'branch-a', name: '支路 A', count: 4, diameter: 10, length: 2, k: 4, referenceFlow: 2, referenceDrop: 20, exponent: 2 },
    { id: 'branch-b', name: '支路 B', count: 4, diameter: 10, length: 2.5, k: 4, referenceFlow: 2, referenceDrop: 20, exponent: 2 },
    { id: 'branch-c', name: '支路 C', count: 4, diameter: 10, length: 3, k: 4, referenceFlow: 2, referenceDrop: 20, exponent: 2 },
  ],
  pump: { shutoffPressure: 140, designFlow: 16, designPressure: 90, maxFlow: 30 },
};

const blankBends = () => DEFAULTS.bends.map(b => ({ ...b, count: 0 }));

function finitePositive(value: number) {
  return Number.isFinite(value) && value > 0;
}

export function validateSystem(i: SystemInputs) {
  const errors: string[] = [];
  if (!['eg50', 'pg25'].includes(i.fluid)) errors.push('請選擇 EG 50% 或 PG 25%。');
  if (!Number.isFinite(i.temperature) || i.temperature < 0 || i.temperature > 90) errors.push('液溫需在內建物性範圍 0–90 °C。');
  if (!Number.isFinite(i.roughness) || i.roughness < 0) errors.push('粗糙度必須是 0 或正數。');
  if (!i.common.length) errors.push('請至少保留一段共用管路。');
  if (!i.branches.length) errors.push('請至少保留一組並聯支路。');
  i.common.forEach((s, index) => {
    const name = s.name.trim() || `共用管段 ${index + 1}`;
    if (!Number.isInteger(s.count) || s.count < 1) errors.push(`${name}的數量需為正整數。`);
    if (!finitePositive(s.diameter)) errors.push(`${name}的管內徑必須大於 0。`);
    if (!Number.isFinite(s.length) || s.length < 0) errors.push(`${name}的管長不可為負數。`);
    if (!Number.isFinite(s.k) || s.k < 0) errors.push(`${name}的 K 不可為負數。`);
  });
  i.branches.forEach((b, index) => {
    const name = b.name.trim() || `支路 ${index + 1}`;
    if (!Number.isInteger(b.count) || b.count < 1) errors.push(`${name}的並聯數需為正整數。`);
    if (!finitePositive(b.diameter)) errors.push(`${name}的管內徑必須大於 0。`);
    if (!Number.isFinite(b.length) || b.length < 0) errors.push(`${name}的單路管長不可為負數。`);
    if (!Number.isFinite(b.k) || b.k < 0) errors.push(`${name}的單路 K 不可為負數。`);
    if (!finitePositive(b.referenceFlow)) errors.push(`${name}的元件參考流量必須大於 0。`);
    if (!Number.isFinite(b.referenceDrop) || b.referenceDrop < 0) errors.push(`${name}的元件參考壓降不可為負數。`);
    if (!finitePositive(b.exponent) || b.exponent > 5) errors.push(`${name}的壓降指數需大於 0 且不超過 5。`);
  });
  const p = i.pump;
  if (!finitePositive(p.shutoffPressure)) errors.push('泵浦零流量壓力必須大於 0。');
  if (!finitePositive(p.maxFlow)) errors.push('泵浦最大流量必須大於 0。');
  if (!finitePositive(p.designFlow) || p.designFlow >= p.maxFlow) errors.push('泵浦中間點流量需介於 0 與最大流量之間。');
  if (!finitePositive(p.designPressure) || p.designPressure >= p.shutoffPressure) errors.push('泵浦中間點壓力需介於 0 與零流量壓力之間。');
  return [...new Set(errors)];
}

function pipeDrop(i: SystemInputs, diameter: number, length: number, k: number, flowLpm: number) {
  const result = calculate({
    ...DEFAULTS,
    fluid: i.fluid,
    temperature: i.temperature,
    shape: 'circle',
    diameter,
    length,
    roughness: i.roughness,
    flowMode: 'flow',
    flowUnit: 'lpm',
    flow: Math.max(0, flowLpm),
    method: i.method,
    bendMode: 'manual',
    bends: blankBends(),
    extraK: k,
  });
  return result.ok && result.total !== null ? result.total : Number.NaN;
}

export function pumpPressure(pump: PumpCurve, flowLpm: number) {
  const q = Math.max(0, Math.min(pump.maxFlow, flowLpm));
  const x1 = pump.designFlow, x2 = pump.maxFlow;
  const y = pump.shutoffPressure * (q - x1) * (q - x2) / (x1 * x2)
    + pump.designPressure * q * (q - x2) / (x1 * (x1 - x2));
  return Math.max(0, y);
}

export function commonDrop(i: SystemInputs, totalFlowLpm: number) {
  return i.common.reduce((sum, segment) => sum + pipeDrop(
    i,
    segment.diameter,
    segment.length * segment.count,
    segment.k * segment.count,
    totalFlowLpm,
  ), 0);
}

export function branchDrop(i: SystemInputs, branch: ParallelBranch, flowPerPathLpm: number) {
  const q = Math.max(0, flowPerPathLpm);
  const pipe = pipeDrop(i, branch.diameter, branch.length, branch.k, q);
  const component = branch.referenceDrop * 1000 * (q / branch.referenceFlow) ** branch.exponent;
  return { pipe, component, total: pipe + component };
}

function inverseBranchDrop(i: SystemInputs, branch: ParallelBranch, targetPa: number) {
  if (targetPa <= 0) return 0;
  let low = 0, high = Math.max(branch.referenceFlow, 0.1);
  for (let j = 0; j < 60 && branchDrop(i, branch, high).total < targetPa; j++) high *= 2;
  for (let j = 0; j < 38; j++) {
    const mid = (low + high) / 2;
    if (branchDrop(i, branch, mid).total < targetPa) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

export function distributeFlow(i: SystemInputs, totalFlowLpm: number) {
  if (totalFlowLpm <= 0) {
    return { pressure: 0, branches: i.branches.map(branch => ({ branch, flowPerPath: 0, groupFlow: 0, ...branchDrop(i, branch, 0) })) };
  }
  const flowAtPressure = (pressure: number) => i.branches.reduce(
    (sum, branch) => sum + branch.count * inverseBranchDrop(i, branch, pressure), 0,
  );
  let low = 0, high = 1000;
  for (let j = 0; j < 80 && flowAtPressure(high) < totalFlowLpm; j++) high *= 2;
  for (let j = 0; j < 42; j++) {
    const mid = (low + high) / 2;
    if (flowAtPressure(mid) < totalFlowLpm) low = mid;
    else high = mid;
  }
  const pressure = (low + high) / 2;
  return {
    pressure,
    branches: i.branches.map(branch => {
      const flowPerPath = inverseBranchDrop(i, branch, pressure);
      return { branch, flowPerPath, groupFlow: flowPerPath * branch.count, ...branchDrop(i, branch, flowPerPath) };
    }),
  };
}

export function systemPressure(i: SystemInputs, totalFlowLpm: number) {
  const common = commonDrop(i, totalFlowLpm);
  const parallel = distributeFlow(i, totalFlowLpm);
  return { common, parallel: parallel.pressure, total: common + parallel.pressure, branches: parallel.branches };
}

export function calculateSystem(i: SystemInputs) {
  const errors = validateSystem(i);
  if (errors.length) return { ok: false as const, errors };
  let low = 0, high = i.pump.maxFlow;
  for (let j = 0; j < 52; j++) {
    const mid = (low + high) / 2;
    if (pumpPressure(i.pump, mid) * 1000 > systemPressure(i, mid).total) low = mid;
    else high = mid;
  }
  const flow = (low + high) / 2;
  const pumpKPa = pumpPressure(i.pump, flow);
  const system = systemPressure(i, flow);
  const fluid = properties(i.fluid, i.temperature);
  const pathFlows = system.branches.map(b => b.flowPerPath);
  const minFlow = Math.min(...pathFlows), maxFlow = Math.max(...pathFlows);
  const imbalance = maxFlow > 0 ? (maxFlow - minFlow) / maxFlow * 100 : 0;
  const curve = Array.from({ length: 41 }, (_, index) => {
    const q = i.pump.maxFlow * index / 40;
    return { flow: q, pump: pumpPressure(i.pump, q), system: systemPressure(i, q).total / 1000 };
  });
  return {
    ok: true as const,
    i,
    flow,
    pressure: system.total,
    pumpPressure: pumpKPa * 1000,
    commonDrop: system.common,
    parallelDrop: system.parallel,
    branches: system.branches,
    minFlow,
    maxFlow,
    imbalance,
    fluid,
    hydraulicPower: system.total * flow / 60000,
    curve,
  };
}

export type SystemResult = Extract<ReturnType<typeof calculateSystem>, { ok: true }>;
