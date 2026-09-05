'use client';
import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, Check, Droplets, Gauge, GitBranch, Plus, RotateCcw, Trash2, TriangleAlert, Workflow } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceDot, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { numberText as n, type Fluid, type Method } from '@/lib/hydraulics';
import { parseNumber } from '@/lib/form-state';
import { SYSTEM_DEFAULTS, calculateSystem, type CommonSegment, type ParallelBranch, type PumpCurve, type SystemInputs } from '@/lib/system-hydraulics';

const STORAGE_KEY = 'glycol-flow-system-v1';
type CommonDraft = Omit<CommonSegment, 'count' | 'diameter' | 'length' | 'k'> & Record<'count' | 'diameter' | 'length' | 'k', string>;
type BranchDraft = Omit<ParallelBranch, 'count' | 'diameter' | 'length' | 'k' | 'referenceFlow' | 'referenceDrop' | 'exponent'> & Record<'count' | 'diameter' | 'length' | 'k' | 'referenceFlow' | 'referenceDrop' | 'exponent', string>;
type PumpDraft = Record<keyof PumpCurve, string>;
type SystemDraft = {
  fluid: Fluid;
  temperature: string;
  roughness: string;
  method: Method;
  common: CommonDraft[];
  branches: BranchDraft[];
  pump: PumpDraft;
};

function createSystemDraft(i: SystemInputs = SYSTEM_DEFAULTS): SystemDraft {
  return {
    fluid: i.fluid,
    temperature: String(i.temperature),
    roughness: String(i.roughness),
    method: i.method,
    common: i.common.map(row => ({ ...row, count: String(row.count), diameter: String(row.diameter), length: String(row.length), k: String(row.k) })),
    branches: i.branches.map(row => ({ ...row, count: String(row.count), diameter: String(row.diameter), length: String(row.length), k: String(row.k), referenceFlow: String(row.referenceFlow), referenceDrop: String(row.referenceDrop), exponent: String(row.exponent) })),
    pump: { shutoffPressure: String(i.pump.shutoffPressure), designFlow: String(i.pump.designFlow), designPressure: String(i.pump.designPressure), maxFlow: String(i.pump.maxFlow) },
  };
}

function restoreSystem(raw: string): SystemDraft {
  const saved = JSON.parse(raw);
  if (saved?.version !== 1 || !saved.draft || !Array.isArray(saved.draft.common) || !Array.isArray(saved.draft.branches)) return createSystemDraft();
  const base = createSystemDraft();
  const d = saved.draft;
  const safe = (value: unknown, fallback: string) => typeof value === 'string' && value.length < 60 ? value : fallback;
  const name = (value: unknown, fallback: string) => typeof value === 'string' && value.trim() && value.length < 50 ? value : fallback;
  base.fluid = d.fluid === 'pg25' ? 'pg25' : 'eg50';
  base.method = ['colebrook', 'churchill', 'max'].includes(d.method) ? d.method : base.method;
  base.temperature = safe(d.temperature, base.temperature);
  base.roughness = safe(d.roughness, base.roughness);
  base.common = d.common.slice(0, 20).map((row: Record<string, unknown>, index: number) => {
    const fallback = base.common[index] ?? base.common[0];
    return { id: name(row.id, `common-${index}`), name: name(row.name, `共用管段 ${index + 1}`), count: safe(row.count, fallback.count), diameter: safe(row.diameter, fallback.diameter), length: safe(row.length, fallback.length), k: safe(row.k, fallback.k) };
  });
  base.branches = d.branches.slice(0, 20).map((row: Record<string, unknown>, index: number) => {
    const fallback = base.branches[index] ?? base.branches[0];
    return { id: name(row.id, `branch-${index}`), name: name(row.name, `支路 ${index + 1}`), count: safe(row.count, fallback.count), diameter: safe(row.diameter, fallback.diameter), length: safe(row.length, fallback.length), k: safe(row.k, fallback.k), referenceFlow: safe(row.referenceFlow, fallback.referenceFlow), referenceDrop: safe(row.referenceDrop, fallback.referenceDrop), exponent: safe(row.exponent, fallback.exponent) };
  });
  for (const key of Object.keys(base.pump) as (keyof PumpDraft)[]) base.pump[key] = safe(d.pump?.[key], base.pump[key]);
  return base.common.length && base.branches.length ? base : createSystemDraft();
}

function toSystemInputs(d: SystemDraft): SystemInputs {
  return {
    fluid: d.fluid,
    temperature: parseNumber(d.temperature),
    roughness: parseNumber(d.roughness),
    method: d.method,
    common: d.common.map(row => ({ ...row, count: parseNumber(row.count), diameter: parseNumber(row.diameter), length: parseNumber(row.length), k: parseNumber(row.k) })),
    branches: d.branches.map(row => ({ ...row, count: parseNumber(row.count), diameter: parseNumber(row.diameter), length: parseNumber(row.length), k: parseNumber(row.k), referenceFlow: parseNumber(row.referenceFlow), referenceDrop: parseNumber(row.referenceDrop), exponent: parseNumber(row.exponent) })),
    pump: Object.fromEntries(Object.entries(d.pump).map(([key, value]) => [key, parseNumber(value)])) as PumpCurve,
  };
}

function SField({ id, label, value, unit, onChange, integer = false }: { id: string; label: string; value: string; unit?: string; onChange: (value: string) => void; integer?: boolean }) {
  const valid = Number.isFinite(parseNumber(value));
  return <div className="field system-field"><label htmlFor={id}>{label}</label><div className="input-wrap"><Input id={id} type="text" inputMode={integer ? 'numeric' : 'decimal'} autoComplete="off" spellCheck={false} className="number-input" value={value} onChange={event => onChange(event.target.value)} aria-invalid={!valid}/>{unit && <span className="input-unit">{unit}</span>}</div></div>;
}

function SystemCurve({ result }: { result: Extract<ReturnType<typeof calculateSystem>, { ok: true }> }) {
  return <section className="panel system-chart-panel">
    <div className="panel-heading compact"><h2><Activity/>泵浦 × 系統曲線</h2><span className="quiet">kPa</span></div>
    <p className="support">兩條曲線的交點就是實際工作流量與壓力。</p>
    <ChartContainer className="system-chart" config={{ pump: { label: '泵浦可用壓力', color: '#bf702d' }, system: { label: '系統需求壓力', color: '#176c61' } }}>
      <LineChart data={result.curve} margin={{ top: 12, right: 12, bottom: 5, left: 0 }} accessibilityLayer>
        <CartesianGrid vertical={false} strokeDasharray="3 5"/>
        <XAxis dataKey="flow" type="number" tickFormatter={value => n(Number(value), 1)} tickLine={false} axisLine={false}/>
        <YAxis tickFormatter={value => n(Number(value), 0)} tickLine={false} axisLine={false} width={48}/>
        <ChartTooltip content={<ChartTooltipContent className="curve-tooltip" labelFormatter={(_, payload) => `${n(Number(payload?.[0]?.payload?.flow), 2)} L/min`} formatter={(value, key) => <><span>{key === 'pump' ? '泵浦' : '系統'}</span><b>{n(Number(value), 2)} kPa</b></>}/>}/>
        <Line dataKey="pump" type="monotone" stroke="var(--color-pump)" strokeWidth={3} dot={false} isAnimationActive={false}/>
        <Line dataKey="system" type="monotone" stroke="var(--color-system)" strokeWidth={3} dot={false} isAnimationActive={false}/>
        <ReferenceDot x={result.flow} y={result.pressure / 1000} r={5} fill="#fff" stroke="#153e38" strokeWidth={3}/>
      </LineChart>
    </ChartContainer>
    <div className="chart-bottom"><span className="chart-key pump-key"><i/>泵浦</span><span className="chart-key"><i/>系統</span><span className="chart-axis">總流量 L/min</span></div>
  </section>;
}

export function SystemAnalysis() {
  const [draft, setDraft] = useState<SystemDraft>(() => createSystemDraft());
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) setDraft(restoreSystem(saved)); } catch {} setHydrated(true); }, []);
  useEffect(() => { if (!hydrated) return; const timer = setTimeout(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, draft })); } catch {} }, 250); return () => clearTimeout(timer); }, [draft, hydrated]);
  const inputs = useMemo(() => toSystemInputs(draft), [draft]);
  const result = useMemo(() => calculateSystem(inputs), [inputs]);
  const r = result.ok ? result : null;
  const updateCommon = (index: number, key: keyof CommonDraft, value: string) => setDraft(old => ({ ...old, common: old.common.map((row, j) => j === index ? { ...row, [key]: value } : row) }));
  const updateBranch = (index: number, key: keyof BranchDraft, value: string) => setDraft(old => ({ ...old, branches: old.branches.map((row, j) => j === index ? { ...row, [key]: value } : row) }));
  const updatePump = (key: keyof PumpDraft, value: string) => setDraft(old => ({ ...old, pump: { ...old.pump, [key]: value } }));
  const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}`;

  return <div id="system-analysis" className="system-analysis">
    <section className="system-flow-map" aria-label="系統計算流程">
      <span className="map-node pump-node"><Gauge/>泵浦</span><ArrowRight/><span className="map-node"><Workflow/>共用管路</span><ArrowRight/><span className="map-node"><GitBranch/>並聯支路</span><ArrowRight/><span className="map-node"><Droplets/>回流</span>
    </section>
    <div className="system-workspace">
      <div className="input-column">
        <section className="panel"><div className="panel-heading"><h2><Droplets/>系統流體條件</h2><span className="section-index">01</span></div>
          <div className="fluid-choice system-fluid-choice"><Button variant="outline" className={'fluid-button ' + (draft.fluid === 'eg50' ? 'selected' : '')} onClick={() => setDraft(old => ({ ...old, fluid: 'eg50' }))}><span><strong>EG <b>50%</b></strong><small>乙二醇水溶液</small></span>{draft.fluid === 'eg50' && <Check/>}</Button><Button variant="outline" className={'fluid-button pg ' + (draft.fluid === 'pg25' ? 'selected' : '')} onClick={() => setDraft(old => ({ ...old, fluid: 'pg25' }))}><span><strong>PG <b>25%</b></strong><small>丙二醇水溶液</small></span>{draft.fluid === 'pg25' && <Check/>}</Button></div>
          <div className="system-fields three"><SField id="system-temperature" label="平均液溫" value={draft.temperature} unit="°C" onChange={value => setDraft(old => ({ ...old, temperature: value }))}/><SField id="system-roughness" label="管壁粗糙度" value={draft.roughness} unit="mm" onChange={value => setDraft(old => ({ ...old, roughness: value }))}/><div className="field system-field"><label htmlFor="system-method">摩擦係數模型</label><NativeSelect id="system-method" className="big-select" value={draft.method} onChange={event => setDraft(old => ({ ...old, method: event.target.value as Method }))}><NativeSelectOption value="colebrook">Colebrook</NativeSelectOption><NativeSelectOption value="churchill">Churchill</NativeSelectOption><NativeSelectOption value="max">四式較大值</NativeSelectOption></NativeSelect></div></div>
        </section>

        <section className="panel"><div className="panel-heading"><h2><Gauge/>泵浦三點曲線</h2><span className="section-index">02</span></div><p className="support">輸入零流量、中間工作點及最大流量；最大流量處壓力設定為 0。</p>
          <div className="pump-point-grid"><div className="pump-point"><b>零流量點</b><SField id="pump-shutoff" label="可用壓力" value={draft.pump.shutoffPressure} unit="kPa" onChange={value => updatePump('shutoffPressure', value)}/></div><div className="pump-point"><b>中間點</b><SField id="pump-design-flow" label="流量" value={draft.pump.designFlow} unit="L/min" onChange={value => updatePump('designFlow', value)}/><SField id="pump-design-pressure" label="壓力" value={draft.pump.designPressure} unit="kPa" onChange={value => updatePump('designPressure', value)}/></div><div className="pump-point"><b>最大流量點</b><SField id="pump-max-flow" label="流量" value={draft.pump.maxFlow} unit="L/min" onChange={value => updatePump('maxFlow', value)}/><span className="zero-pressure">壓力 0 kPa</span></div></div>
        </section>

        <section className="panel"><div className="panel-heading"><h2><Workflow/>共用串聯管路</h2><Button variant="outline" className="add-row-button" onClick={() => setDraft(old => ({ ...old, common: [...old.common, { id: newId('common'), name: `管段 ${old.common.length + 1}`, count: '1', diameter: '25', length: '1', k: '0' }] }))}><Plus/>新增管段</Button></div><p className="support">供液與回液主管、過濾器前後管段等，依序串聯加總。</p>
          <div className="system-item-list">{draft.common.map((row, index) => <article className="system-item" key={row.id}><div className="system-item-head"><Input aria-label={`共用管段 ${index + 1} 名稱`} className="item-name" value={row.name} onChange={event => updateCommon(index, 'name', event.target.value)}/><Button variant="ghost" aria-label={`刪除 ${row.name}`} disabled={draft.common.length === 1} onClick={() => setDraft(old => ({ ...old, common: old.common.filter((_, j) => j !== index) }))}><Trash2/></Button></div><div className="system-fields four"><SField id={`common-count-${index}`} label="數量" value={row.count} unit="個" integer onChange={value => updateCommon(index, 'count', value)}/><SField id={`common-diameter-${index}`} label="管內徑" value={row.diameter} unit="mm" onChange={value => updateCommon(index, 'diameter', value)}/><SField id={`common-length-${index}`} label="單段長度" value={row.length} unit="m" onChange={value => updateCommon(index, 'length', value)}/><SField id={`common-k-${index}`} label="單段 K" value={row.k} onChange={value => updateCommon(index, 'k', value)}/></div></article>)}</div>
        </section>

        <section className="panel"><div className="panel-heading"><h2><GitBranch/>並聯支路群組</h2><Button variant="outline" className="add-row-button" onClick={() => setDraft(old => ({ ...old, branches: [...old.branches, { id: newId('branch'), name: `支路 ${old.branches.length + 1}`, count: '1', diameter: '10', length: '2', k: '0', referenceFlow: '2', referenceDrop: '20', exponent: '2' }] }))}><Plus/>新增支路</Button></div><p className="support">每列可代表多條相同支路；不同列會依共同壓差自動分配流量。</p>
          <div className="system-item-list">{draft.branches.map((row, index) => <article className="system-item branch-item" key={row.id}><div className="system-item-head"><Input aria-label={`支路 ${index + 1} 名稱`} className="item-name" value={row.name} onChange={event => updateBranch(index, 'name', event.target.value)}/><Button variant="ghost" aria-label={`刪除 ${row.name}`} disabled={draft.branches.length === 1} onClick={() => setDraft(old => ({ ...old, branches: old.branches.filter((_, j) => j !== index) }))}><Trash2/></Button></div><div className="system-fields branch-fields"><SField id={`branch-count-${index}`} label="相同支路數" value={row.count} unit="路" integer onChange={value => updateBranch(index, 'count', value)}/><SField id={`branch-diameter-${index}`} label="單路管內徑" value={row.diameter} unit="mm" onChange={value => updateBranch(index, 'diameter', value)}/><SField id={`branch-length-${index}`} label="單路管長" value={row.length} unit="m" onChange={value => updateBranch(index, 'length', value)}/><SField id={`branch-k-${index}`} label="單路配件 K" value={row.k} onChange={value => updateBranch(index, 'k', value)}/><SField id={`branch-ref-flow-${index}`} label="元件參考流量" value={row.referenceFlow} unit="L/min" onChange={value => updateBranch(index, 'referenceFlow', value)}/><SField id={`branch-ref-drop-${index}`} label="元件參考壓降" value={row.referenceDrop} unit="kPa" onChange={value => updateBranch(index, 'referenceDrop', value)}/><SField id={`branch-exp-${index}`} label="壓降指數 n" value={row.exponent} onChange={value => updateBranch(index, 'exponent', value)}/></div></article>)}</div>
          <p className="fine-print">元件曲線：Δp = Δpᵣ × (Q/Qᵣ)ⁿ。冷板與快接頭若有整體壓降曲線，可合併填入參考點。</p>
          <div className="form-footer"><span><Check size={16}/>修改即時重新求解</span><Button variant="ghost" className="reset-button" onClick={() => setDraft(createSystemDraft())}><RotateCcw/>重設示範</Button></div>
        </section>
      </div>

      <aside className="result-column" aria-label="系統分析結果"><div className="result-sticky">
        <section className="result-card system-result-card"><div className="result-top"><span><Gauge/>系統工作點</span><span className="regime-tag">P–Q 交點</span></div><div className="pressure-label">總流量</div><div className="total-pressure"><strong>{n(r?.flow ?? null, 2)}</strong><span className="result-large-unit">L/min</span></div><p className="pressure-equivalent">系統壓力 {n(r ? r.pressure / 1000 : null, 2)} kPa</p>
          {r && <><div className="system-result-breakdown"><div><span>共用管路</span><strong>{n(r.commonDrop / 1000, 2)}<small>kPa</small></strong></div><div><span>並聯區段</span><strong>{n(r.parallelDrop / 1000, 2)}<small>kPa</small></strong></div><div><span>液壓功率</span><strong>{n(r.hydraulicPower, 2)}<small>W</small></strong></div></div><div className="branch-balance"><span>單路流量範圍</span><b>{n(r.minFlow, 2)}–{n(r.maxFlow, 2)} L/min</b><span>最大不均率</span><b>{n(r.imbalance, 1)}%</b></div></>}
        </section>
        {!result.ok && <div className="notice error-notice" role="alert"><TriangleAlert/><div><strong>請確認系統輸入</strong>{result.errors.slice(0, 8).map(error => <p key={error}>{error}</p>)}</div></div>}
        {r && r.imbalance > 10 && <div className="notice warning-notice"><TriangleAlert/><p>支路最大不均率超過 10%；可調整管徑、管長或平衡閥 K 值。</p></div>}
        {r && <><SystemCurve result={r}/><section className="panel branch-result-panel"><div className="panel-heading compact"><h2><GitBranch/>支路流量分配</h2><span className="quiet">共同壓差 {n(r.parallelDrop / 1000, 2)} kPa</span></div><div className="table-scroll"><Table className="engineering-table branch-table"><TableHeader><TableRow><TableHead>群組</TableHead><TableHead>路數</TableHead><TableHead>單路流量</TableHead><TableHead>群組流量</TableHead><TableHead>管路壓降</TableHead><TableHead>元件壓降</TableHead></TableRow></TableHeader><TableBody>{r.branches.map(row => <TableRow key={row.branch.id}><TableCell>{row.branch.name}</TableCell><TableCell>{row.branch.count}</TableCell><TableCell>{n(row.flowPerPath, 3)} L/min</TableCell><TableCell>{n(row.groupFlow, 2)} L/min</TableCell><TableCell>{n(row.pipe / 1000, 2)} kPa</TableCell><TableCell>{n(row.component / 1000, 2)} kPa</TableCell></TableRow>)}</TableBody></Table></div></section></>}
      </div></aside>
    </div>
  </div>;
}
