'use client';
import { useEffect,useMemo,useState } from 'react';
import { ArrowDown,ArrowDownToLine,ArrowRight,BookOpen,Check,ChevronRight,Circle,Download,Droplets,Gauge,Info,Printer,RectangleHorizontal,RotateCcw,Smartphone,Thermometer,TriangleAlert,WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect,NativeSelectOption } from '@/components/ui/native-select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from '@/components/ui/dialog';
import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from '@/components/ui/table';
import { FlowDiagram } from '@/components/flow-diagram';
import { PressureCurve } from '@/components/pressure-curve';
import { Formulas } from '@/components/formulas';
import { SystemAnalysis } from '@/components/system-analysis';
import { usePwa } from '@/components/use-pwa';
import { createDraft,toInputs,restoreDraft,parseNumber,type Draft,type NumericField } from '@/lib/form-state';
import { calculate,numberText as n,properties,PRESSURE_UNITS,type SuccessResult } from '@/lib/hydraulics';

const STORAGE_KEY='glycol-flow-settings-v1';
function NumberField({id,label,value,unit,onChange,help,disabled=false,integer=false}:{id:string;label:string;value:string;unit?:string;onChange:(s:string)=>void;help?:string;disabled?:boolean;integer?:boolean}) {
  const valid=Number.isFinite(parseNumber(value));
  return <div className={'field'+(disabled?' disabled-field':'')}><label htmlFor={id}>{label}</label><div className="input-wrap"><Input id={id} type="text" inputMode={integer?'numeric':'decimal'} autoComplete="off" spellCheck={false} className="number-input" value={value} onChange={e=>onChange(e.target.value)} disabled={disabled} aria-invalid={!disabled&&!valid} aria-describedby={help?`${id}-help`:undefined}/>{unit&&<span className="input-unit" aria-hidden="true">{unit}</span>}</div>{help&&<p id={`${id}-help`} className="field-help">{help}</p>}</div>;
}
function Stat({label,value,unit}:{label:string;value:string;unit?:string}) {return <div className="stat"><dt>{label}</dt><dd>{value}{unit&&<small>{unit}</small>}</dd></div>;}
function Report({r,unit}:{r:SuccessResult;unit:keyof typeof PRESSURE_UNITS}) {
  const factor=PRESSURE_UNITS[unit].factor;
  const pressure=(value:number|null)=>n(value===null?null:value*factor,unit==='Pa'?1:3);
  const parts=[{label:'直管',value:r.straight,color:'#7ad9ba'},{label:'彎頭',value:r.bendDrop??0,color:'#efc487'},{label:'附加 K',value:r.extra,color:'#a8c7db'}];
  return <>
    <div className="result-breakdown">{parts.map(p=><div key={p.label}><span><i style={{background:p.color}}/>{p.label}壓降</span><strong>{p.label==='彎頭'&&r.incomplete?'待定':pressure(p.value)}<small>{unit}</small></strong></div>)}</div>
    {r.total!==null&&r.total>0&&<div className="proportion-bar" aria-label="壓降占比">{parts.map(p=><span key={p.label} style={{width:`${p.value/r.total!*100}%`,background:p.color}} title={`${p.label} ${n(p.value/r.total!*100,1)}%`}/>)}</div>}
    <dl className="result-stats"><Stat label="平均流速 v" value={n(r.v)} unit="m/s"/><Stat label="雷諾數 Re" value={n(r.re,0)}/><Stat label="水力直徑 Dh" value={n(r.g.dh*1000)} unit="mm"/><Stat label="摩擦係數 f" value={r.re===0?'—':n(r.f.f,5)}/><Stat label="液柱高度 H" value={n(r.head)} unit="m"/><Stat label="液壓功率" value={n(r.hydraulicPower)} unit="W"/></dl>
    <div className="result-note"><span>流量 <b>{n(r.q*60000)} L/min</b></span><span>質量流率 <b>{n(r.massFlow,4)} kg/s</b></span></div>
  </>;
}
function exportReport(r:SuccessResult) {
  const rows:(string|number|null)[][]=[['液冷壓降計算報告','數值','單位'],['建立時間',new Date().toISOString(),'UTC'],
    ['冷卻液',r.i.fluid==='eg50'?'EG 50%':'PG 25%','vol%'],['物性來源',r.i.custom?'手動物性':'Dynalene 原廠表插值',''],['平均液溫',r.i.temperature,'°C'],['密度',r.p.rho,'kg/m³'],['動力黏度',r.p.muMPas,'mPa·s'],['運動黏度',r.p.nu*1e6,'mm²/s'],
    ['流道形狀',r.i.shape==='circle'?'圓管':'矩形',''],['圓管內徑',r.i.shape==='circle'?r.i.diameter:'不適用','mm'],['矩形寬',r.i.shape==='rectangle'?r.i.width:'不適用','mm'],['矩形高',r.i.shape==='rectangle'?r.i.height:'不適用','mm'],['水力直徑',r.g.dh*1000,'mm'],['截面積',r.g.area*1e6,'mm²'],['直管長度（不含彎頭）',r.i.length,'m'],['絕對粗糙度',r.i.roughness,'mm'],
    ['體積流量',r.q*60000,'L/min'],['平均流速',r.v,'m/s'],['雷諾數',r.re,''],['流況',r.f.regime,''],['摩擦模型',r.f.name,''],['Darcy 摩擦係數',r.f.f,''],['彎頭模式',r.i.bendMode==='auto'?'Rennels':'手動 K',''],['附加K',r.i.extraK,''],
    ['直管壓降',r.straight,'Pa'],['彎頭壓降',r.bendDrop,'Pa'],['附加壓降',r.extra,'Pa'],['總壓降',r.total,'Pa'],['總壓降',r.total===null?null:r.total/1000,'kPa'],['液體揚程',r.head,'m'],['液壓功率',r.hydraulicPower,'W']];
  for(const b of r.bends)rows.push([`${b.angle}° 數量`,b.count,'個'],[`${b.angle}° 中心半徑`,r.i.bendMode==='auto'?b.radius:'手動K未使用','mm'],[`${b.angle}° 單個K`,b.k,''],[`${b.angle}° 合計壓降`,b.dp,'Pa']);
  for(const note of r.notices)rows.push(['適用性說明',note.text,'']);
  rows.push(['範圍','單一路徑流阻；未含靜壓高差、未輸入之歧管與其他配件；不是泵工作點。',''],['壓降公式','Δp = (fL/Dh + ΣnK + K附加)ρv²/2','']);
  const csv='\uFEFF'+rows.map(row=>row.map(c=>'"'+String(c===null?'待定':c).replaceAll('"','""')+'"').join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=`glycol-pressure-${r.i.fluid}-${r.i.shape}.csv`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}

export default function Home() {
  const [form,setForm]=useState<Draft>(()=>createDraft());
  const [hydrated,setHydrated]=useState(false),[saved,setSaved]=useState(true),[unit,setUnit]=useState<keyof typeof PRESSURE_UNITS>('kPa');
  const [installOpen,setInstallOpen]=useState(false),[resetOpen,setResetOpen]=useState(false),[toast,setToast]=useState('');
  const [view,setView]=useState<'single'|'system'>('single');
  const pwa=usePwa();
  useEffect(()=>{try{const stored=localStorage.getItem(STORAGE_KEY);if(stored)setForm(restoreDraft(stored));}catch{setSaved(false);}setHydrated(true);},[]);
  useEffect(()=>{if(!hydrated)return;const timer=setTimeout(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,form}));setSaved(true);}catch{setSaved(false);}},250);return ()=>clearTimeout(timer);},[form,hydrated]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),3500);return ()=>clearTimeout(timer);},[toast]);
  const inputs=useMemo(()=>toInputs(form),[form]);
  const result=useMemo(()=>calculate(inputs),[inputs]);
  const r=result.ok?result:null;
  const fluidProps=useMemo(()=>{try{return form.custom?{rho:inputs.density,muMPas:inputs.viscosity,nu:inputs.viscosity/1000/inputs.density}:properties(form.fluid,inputs.temperature);}catch{return null;}},[form.custom,form.fluid,inputs.temperature,inputs.density,inputs.viscosity]);
  const set=<K extends keyof Draft>(key:K,value:Draft[K])=>setForm(old=>({...old,[key]:value}));
  const setNumeric=(key:NumericField)=>(value:string)=>set(key,value);
  const bendValue=(index:number,key:'count'|'radius'|'k',value:string)=>setForm(old=>({...old,bends:old.bends.map((b,j)=>j===index?{...b,[key]:value}:b)}));
  const changeFlowMode=(mode:'flow'|'velocity')=>setForm(old=>({...old,flowMode:mode,...(r?{flow:String(Number((old.flowUnit==='lpm'?r.q*60000:r.q*3600).toPrecision(10))),velocity:String(Number(r.v.toPrecision(10)))}:{})}));
  const changeUnit=(value:'lpm'|'m3h')=>setForm(old=>({...old,flowUnit:value,...(Number.isFinite(parseNumber(old.flow))?{flow:String(Number((parseNumber(old.flow)*(value===old.flowUnit?1:value==='m3h'?0.06:1/0.06)).toPrecision(10)))}:{})}));
  const toggleCustom=(enabled:boolean)=>{if(enabled&&fluidProps)setForm(old=>({...old,custom:true,density:String(Number(fluidProps.rho.toFixed(3))),viscosity:String(Number(fluidProps.muMPas.toFixed(5)))}));else set('custom',enabled);};
  const totalText=r?.total!=null?n(r.total*PRESSURE_UNITS[unit].factor,unit==='Pa'?1:3):'—';
  const regime=r?({zero:'無流動',laminar:'層流',transition:'過渡區',turbulent:'紊流'}[r.f.regime]):'待輸入';

  return <div className="app-shell">
    <a href={view==='single'?'#calculation':'#system-analysis'} className="skip-link">跳到計算輸入</a>
    <header className="site-header"><a className="brand" href="#"><span className="brand-mark"><Droplets aria-hidden="true"/></span><span>GLYCOL FLOW<small>液冷工程工具</small></span></a><div className="header-actions">{view==='single'&&<a href="#formulas" className="formula-link"><BookOpen size={19}/>公式</a>}<Button className="install-button" variant="outline" onClick={async()=>{if(!await pwa.install())setInstallOpen(true);}}><Smartphone/>{pwa.installed?'已安裝':'安裝 App'}</Button></div></header>
    <main>
      <div className="title-row"><div><h1>{view==='single'?'液冷壓降計算器':'液冷系統分析'}<span className="title-dot">.</span></h1><p>{view==='single'?'從流道尺寸，到所需壓差。圓管與矩形，一次算清楚。':'組裝共用管路與並聯支路，找出泵浦實際工作點。'}</p></div><span className={'offline-badge'+(pwa.offline?' is-offline':'')}>{pwa.offline?<WifiOff size={15}/>:pwa.ready?<Check size={15}/>:<span className="status-dot"/>}{pwa.offline?(pwa.ready?'離線模式':'目前離線'):pwa.ready?'可離線計算':pwa.failed?'線上模式':'準備離線功能'}</span></div>
      <div className="app-mode-tabs" aria-label="計算模式"><Button variant="ghost" className={view==='single'?'active':''} aria-pressed={view==='single'} onClick={()=>setView('single')}>單段管路</Button><Button variant="ghost" className={view==='system'?'active':''} aria-pressed={view==='system'} onClick={()=>setView('system')}>系統分析</Button></div>
      {view==='single'?<>
      <div className="mode-row"><div className="shape-switch" aria-label="流道形狀"><Button variant="ghost" aria-pressed={form.shape==='circle'} onClick={()=>set('shape','circle')} className={form.shape==='circle'?'active':''}><Circle/>圓管</Button><Button variant="ghost" aria-pressed={form.shape==='rectangle'} onClick={()=>set('shape','rectangle')} className={form.shape==='rectangle'?'active':''}><RectangleHorizontal/>矩形流道</Button></div><span className="saved-label">{saved?<Check size={14}/>:<Info size={14}/>} {saved?'設定自動保留於本機':'本機無法保存設定'}</span></div>
      <div className="workspace" id="calculation">
        <div className="input-column">
          <section className="panel"><div className="panel-heading"><h2><Thermometer/>流體條件</h2><span className="section-index">01</span></div>
            <div className="fluid-choice" aria-label="冷卻液"><Button variant="outline" aria-pressed={form.fluid==='eg50'} className={'fluid-button '+(form.fluid==='eg50'?'selected':'')} onClick={()=>set('fluid','eg50')}><span><strong>EG <b>50%</b></strong><small>乙二醇水溶液</small></span><span className="choice-check">{form.fluid==='eg50'&&<Check size={17}/>}</span></Button><Button variant="outline" aria-pressed={form.fluid==='pg25'} className={'fluid-button pg '+(form.fluid==='pg25'?'selected':'')} onClick={()=>set('fluid','pg25')}><span><strong>PG <b>25%</b></strong><small>丙二醇水溶液</small></span><span className="choice-check">{form.fluid==='pg25'&&<Check size={17}/>}</span></Button></div>
            <div className="concentration-note"><Info size={15}/>體積濃度 vol% · 內建參考物性 0–90 °C</div>
            <NumberField id="temperature" label="平均液溫 T" value={form.temperature} unit="°C" onChange={setNumeric('temperature')} help="使用整段流道的代表液溫；密度與黏度隨溫度更新。"/>
            <dl className="property-strip"><Stat label="密度 ρ" value={n(fluidProps?.rho??null,1)} unit="kg/m³"/><Stat label="動力黏度 μ" value={n(fluidProps?.muMPas??null,3)} unit="mPa·s"/><Stat label="運動黏度 ν" value={n(fluidProps?fluidProps.nu*1e6:null,3)} unit="mm²/s"/></dl>
            <div className="custom-toggle"><Checkbox id="custom-property" checked={form.custom} onCheckedChange={value=>toggleCustom(value===true)}/><label htmlFor="custom-property">使用供應商／實測物性</label><span>選填</span></div>
            {form.custom&&<div className="manual-properties"><div className="two-fields"><NumberField id="density" label="密度 ρ" value={form.density} unit="kg/m³" onChange={setNumeric('density')}/><NumberField id="viscosity" label="動力黏度 μ" value={form.viscosity} unit="mPa·s" onChange={setNumeric('viscosity')}/></div><p className="field-help">手動模式不會隨溫度自動更新；1 cP = 1 mPa·s。</p></div>}
          </section>
          <section className="panel"><div className="panel-heading"><h2>{form.shape==='circle'?<Circle/>:<RectangleHorizontal/>}流道幾何</h2><span className="section-index">02</span></div>
            <FlowDiagram shape={form.shape}/>
            {form.shape==='circle'?<NumberField id="diameter" label="管內徑 D" value={form.diameter} unit="mm" onChange={setNumeric('diameter')}/>:<div className="two-fields"><NumberField id="width" label="流道寬 a" value={form.width} unit="mm" onChange={setNumeric('width')}/><NumberField id="height" label="流道高 b" value={form.height} unit="mm" onChange={setNumeric('height')}/></div>}
            <div className="two-fields field-spacing"><NumberField id="length" label="直管總長 L" value={form.length} unit="m" onChange={setNumeric('length')} help="不含彎頭弧長。"/><NumberField id="roughness" label="絕對粗糙度 ε" value={form.roughness} unit="mm" onChange={setNumeric('roughness')} help="可填 0，表示水力光滑。"/></div>
            <p className="fine-print">請填內部通流尺寸；粗糙度 ε 不是表面粗糙度 Ra 的直接換算。</p>
          </section>
          <section className="panel"><div className="panel-heading"><h2><ArrowRight/>流量設定</h2><span className="section-index">03</span></div>
            <div className="inline-switch" aria-label="流量輸入方式"><Button variant="ghost" aria-pressed={form.flowMode==='flow'} onClick={()=>changeFlowMode('flow')} className={form.flowMode==='flow'?'active':''}>輸入流量</Button><Button variant="ghost" aria-pressed={form.flowMode==='velocity'} onClick={()=>changeFlowMode('velocity')} className={form.flowMode==='velocity'?'active':''}>輸入流速</Button></div>
            {form.flowMode==='flow'?<div className="flow-unit-row"><NumberField id="flow" label="體積流量 Q" value={form.flow} onChange={setNumeric('flow')}/><div className="field"><label htmlFor="flow-unit">流量單位</label><NativeSelect id="flow-unit" className="big-select" value={form.flowUnit} onChange={e=>changeUnit(e.target.value as 'lpm'|'m3h')}><NativeSelectOption value="lpm">L/min</NativeSelectOption><NativeSelectOption value="m3h">m³/h</NativeSelectOption></NativeSelect></div></div>:<NumberField id="velocity" label="平均流速 v" value={form.velocity} unit="m/s" onChange={setNumeric('velocity')}/>}
            <div className="conversion-line"><ArrowRight size={17}/>{form.flowMode==='flow'?<>平均流速 <b>{n(r?.v??null)} m/s</b></>:<>體積流量 <b>{n(r?r.q*60000:null)} L/min</b></>}</div>
            <div className="field model-field"><label htmlFor="method">摩擦係數模型</label><NativeSelect id="method" className="big-select" value={form.method} onChange={e=>set('method',e.target.value as Draft['method'])}><NativeSelectOption value="colebrook">自動流況 · Colebrook</NativeSelectOption><NativeSelectOption value="churchill">自動流況 · Churchill</NativeSelectOption><NativeSelectOption value="max">自動流況 · 四式較大值</NativeSelectOption></NativeSelect><p className="field-help">層流自動使用截面解析式；上述選項決定紊流算法。</p></div>
          </section>
          <section className="panel" id="bends"><div className="panel-heading"><h2><RotateCcw/>彎頭與局部損失</h2><span className="section-index">04</span></div>
            <div className="field"><label htmlFor="bend-mode">彎頭算法</label><NativeSelect id="bend-mode" className="big-select" value={form.bendMode} onChange={e=>set('bendMode',e.target.value as Draft['bendMode'])}><NativeSelectOption value="auto">自動：圓滑彎頭 + 中心半徑</NativeSelectOption><NativeSelectOption value="manual">手動：輸入單個彎頭 K</NativeSelectOption></NativeSelect></div>
            <p className="support">{form.bendMode==='auto'?'R 為彎頭中心線半徑；自動 K 已含弧長摩擦。':'K 以本流道平均速度為基準，需對應實際流況，並涵蓋整個彎頭損失。'}</p>
            <div className="bend-list">{form.bends.map((b,j)=><div className={'bend-row'+(parseNumber(b.count)>0?' has-bend':'')} key={b.angle}><div className="bend-angle"><svg viewBox="0 0 48 40" aria-hidden="true"><path d={b.angle===45?'M7 33V24Q7 20 12 15L24 3':b.angle===90?'M8 34V20Q8 8 20 8H38':'M8 34V18Q8 4 23 4Q38 4 38 18V34'} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg><strong>{b.angle}°</strong></div><NumberField id={`count-${b.angle}`} label="數量" value={b.count} unit="個" integer onChange={s=>bendValue(j,'count',s)}/>{form.bendMode==='auto'?<NumberField id={`radius-${b.angle}`} label="中心半徑 R" value={b.radius} unit="mm" disabled={parseNumber(b.count)===0} onChange={s=>bendValue(j,'radius',s)}/>:<NumberField id={`k-${b.angle}`} label="單個 K" value={b.k} disabled={parseNumber(b.count)===0} onChange={s=>bendValue(j,'k',s)}/>}</div>)}</div>
            <NumberField id="extra-k" label="其他配件合計 K" value={form.extraK} onChange={setNumeric('extraK')} help="可納入接頭、閥件、入口／出口等已知損失。預設 0，未自動加入。"/>
            <div className="form-footer"><span><Check size={16}/>修改即時計算</span><Button variant="ghost" className="reset-button" onClick={()=>setResetOpen(true)}><RotateCcw/>重設範例</Button></div>
          </section>
        </div>
        <aside className="result-column" id="results" aria-label="計算結果">
          <div className="result-sticky"><section className="result-card"><div className="result-top"><span><Gauge size={20}/>計算結果</span><span className={'regime-tag '+(r?.f.regime==='transition'?'transition':'')}>{regime}</span></div><div className="pressure-label">總壓降 Δp</div><div className="total-pressure" aria-live="polite" aria-atomic="true"><strong>{totalText}</strong><NativeSelect aria-label="壓降顯示單位" className="pressure-unit" value={unit} onChange={e=>setUnit(e.target.value as keyof typeof PRESSURE_UNITS)}>{Object.keys(PRESSURE_UNITS).map(u=><NativeSelectOption key={u} value={u}>{u}</NativeSelectOption>)}</NativeSelect></div>
            {r?.incomplete?<p className="pressure-equivalent incomplete">彎頭 K 待確認 · 直管壓降如下</p>:<p className="pressure-equivalent">{n(r?.total!=null?r.total/1e5:null,5)} bar <span>／</span> {n(r?.total!=null?r.total/6894.757293168:null,3)} psi</p>}
            {r?<Report r={r} unit={unit}/>:<div className="result-empty"><Info/><p>請完成有效輸入，結果會自動更新。</p></div>}
          </section>
          {!result.ok&&<div className="notice error-notice" role="alert"><TriangleAlert/><div><strong>請確認輸入</strong>{result.errors.map(e=><p key={e}>{e}</p>)}</div></div>}
          {r?.notices.map((note,j)=><div className={'notice '+(note.kind==='warning'?'warning-notice':'info-notice')} key={j}>{note.kind==='warning'?<TriangleAlert/>:<Info/>}<div><p>{note.text}</p>{r.incomplete&&j===(r.f.regime==='transition'?1:0)&&<a href="#bends">前往設定彎頭 K <ArrowRight size={15}/></a>}</div></div>)}
          <div className="result-actions"><Button variant="outline" disabled={!r} onClick={()=>{if(r){exportReport(r);setToast('計算報告已建立');}}}><Download/>匯出 CSV</Button><Button variant="outline" onClick={()=>window.print()} disabled={!r}><Printer/>列印</Button><a href="#formulas"><BookOpen size={18}/>計算過程 <ArrowDown size={16}/></a></div>
          {r&&<PressureCurve r={r} unit={unit}/>}
          <details className="panel model-comparison"><summary>摩擦係數模型比較 <ChevronRight size={18}/></summary><div className="expanded-content">{r&&r.f.comparisons.length>0?<><Table className="engineering-table"><TableHeader><TableRow><TableHead>模型</TableHead><TableHead>Darcy f</TableHead><TableHead>直管 kPa</TableHead></TableRow></TableHeader><TableBody>{r.f.comparisons.map(m=><TableRow key={m.id}><TableCell>{m.name}{!m.valid&&<small className="range-label">超出適用範圍</small>}</TableCell><TableCell>{m.valid?n(m.f,6):'—'}</TableCell><TableCell>{m.valid?n(m.f*r.i.length/r.g.dh*r.dynamic/1000):'—'}</TableCell></TableRow>)}</TableBody></Table><p className="fine-print">{r.f.regime==='transition'?'目前為過渡區，表中各式均已套用本工具的平滑插值。':'各式使用相同幾何與流體條件。'} 比較值不是量測誤差範圍。</p></>:<p className="support">{r?.re===0?'零流量時壓降為 0。':'層流使用截面解析式，不直接套用紊流近似式。'}</p>}</div></details>
          </div>
        </aside>
      </div>
      <Formulas r={r}/>
      </>:<SystemAnalysis/>}
    </main>
    <footer className="site-footer"><span>GLYCOL FLOW <b>·</b> 工程估算工具</span><span>EG 50% / PG 25% · vol%</span><Button variant="ghost" onClick={()=>setInstallOpen(true)}>加入主畫面 <ArrowDownToLine size={16}/></Button></footer>
    {view==='single'&&<div className="mobile-result-bar"><div><span>{r?.incomplete?'總壓降待定':'總壓降'}</span><strong>{totalText}<small>{unit}</small></strong></div><a href="#results">查看結果 <ArrowRight size={19}/></a></div>}
    <Dialog open={installOpen} onOpenChange={setInstallOpen}><DialogContent className="help-dialog"><DialogHeader><span className="dialog-icon"><Smartphone/></span><DialogTitle>把計算器放到主畫面</DialogTitle><DialogDescription>加入後可像 App 一樣開啟；離線資料準備完成後，也能離線計算。</DialogDescription></DialogHeader><div className="install-guide"><h3>iPhone / iPad</h3><ol><li>在 <strong>Safari</strong> 開啟此頁。</li><li>點選「分享」，再選「加入主畫面」。</li><li>點「加入」，從主畫面開啟。</li></ol><h3>Android / 電腦</h3><p>使用 Chrome 或 Edge，選擇選單中的「安裝應用程式」／「新增至主畫面」。</p><div className={'install-readiness '+(pwa.ready?'is-ready':'')}><Info size={18}/><p>{pwa.ready?'離線資料已準備完成。':pwa.failed?'離線功能尚未準備完成，請保持連線並重新整理。':'請保持網路連線，等待頁面顯示「可離線計算」。'}</p></div></div>{pwa.canPrompt&&<Button className="dialog-primary" onClick={async()=>{await pwa.install();setInstallOpen(false);}}>安裝 App <Download/></Button>}</DialogContent></Dialog>
    <Dialog open={resetOpen} onOpenChange={setResetOpen}><DialogContent className="help-dialog"><DialogHeader><DialogTitle>重設為範例數值？</DialogTitle><DialogDescription>目前輸入將替換為 EG 50%、45 °C、Ø10 mm、6 L/min 的示範案例。</DialogDescription></DialogHeader><div className="dialog-actions"><Button variant="outline" onClick={()=>setResetOpen(false)}>保留目前設定</Button><Button onClick={()=>{setForm(createDraft());setResetOpen(false);setToast('已恢復範例');}}>重設範例</Button></div></DialogContent></Dialog>
    {toast&&<div className="toast" role="status"><Check size={18}/>{toast}</div>}
  </div>;
}
