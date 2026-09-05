/** Isothermal, incompressible, fully filled single-path calculation. SI internally. */
export type Fluid = 'eg50' | 'pg25';
export type Shape = 'circle' | 'rectangle';
export type Method = 'colebrook' | 'churchill' | 'max';
export type BendInput = { angle: 45 | 90 | 180; count: number; radius: number; k: number };
export type Inputs = {
  fluid: Fluid; temperature: number; custom: boolean; density: number; viscosity: number;
  shape: Shape; diameter: number; width: number; height: number; length: number; roughness: number;
  flowMode: 'flow' | 'velocity'; flowUnit: 'lpm' | 'm3h'; flow: number; velocity: number;
  method: Method; bendMode: 'auto' | 'manual'; bends: BendInput[]; extraK: number;
};
export type Notice = { kind: 'info' | 'warning'; text: string };
export const SOURCES = {
  eg50: 'https://www.dynalene.com/wp-content/uploads/2020/07/Dynalene-EG-Tech-Data-Sheet-Rev1.pdf',
  pg25: 'https://www.dynalene.com/wp-content/uploads/2020/07/Dynalene-PG-Tech-Data-Sheet-Rev1.pdf',
  friction: 'https://fluids.readthedocs.io/fluids.friction.html',
  bends: 'https://fluids.readthedocs.io/fluids.fittings.html#fluids.fittings.bend_rounded',
  rectangular: 'https://community.wolfram.com/groups/-/m/t/3707318',
};
export const DEFAULTS: Inputs = {
  fluid: 'eg50', temperature: 45, custom: false, density: 1070, viscosity: 2,
  shape: 'circle', diameter: 10, width: 12, height: 4, length: 2, roughness: 0.0015,
  flowMode: 'flow', flowUnit: 'lpm', flow: 6, velocity: 1, method: 'colebrook',
  bendMode: 'auto', bends: [
    { angle: 45, count: 0, radius: 15, k: 0.2 },
    { angle: 90, count: 2, radius: 15, k: 0.3 },
    { angle: 180, count: 0, radius: 15, k: 0.5 },
  ], extraK: 0,
};

// Dynalene technical data sheets, pp. 3–4. Concentration is BY VOLUME.
// Original T: °F; density: lb/ft³; dynamic viscosity: cP (mPa·s).
const TEMP_F = [20,30,40,50,60,70,80,90,100,120,140,160,180,200];
export const PROPERTY_TABLE = {
  eg50: {
    rho: [68.66,68.49,68.32,68.14,67.96,67.77,67.58,67.38,67.17,66.74,66.28,65.80,65.30,64.78],
    mu: [10.9,8.48,6.77,5.50,4.55,3.81,3.23,2.76,2.39,1.82,1.43,1.15,0.94,0.78],
  },
  pg25: {
    rho: [64.57,64.47,64.35,64.23,64.09,63.95,63.80,63.64,63.47,63.09,62.68,62.23,61.74,61.21],
    mu: [7.63,5.85,4.58,3.66,2.97,2.45,2.05,1.74,1.49,1.14,0.90,0.73,0.61,0.52],
  },
};
export function properties(fluid: Fluid, temperature: number) {
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 90) throw new Error('內建物性適用 0–90 °C；其他溫度請輸入供應商物性。');
  const f = temperature * 1.8 + 32;
  const j = Math.max(0, Math.min(TEMP_F.length - 2, TEMP_F.findIndex(t => t >= f) - 1));
  const weight = (f - TEMP_F[j]) / (TEMP_F[j + 1] - TEMP_F[j]);
  const table = PROPERTY_TABLE[fluid];
  const rho = (table.rho[j] + weight * (table.rho[j + 1] - table.rho[j])) * 16.01846337396014;
  const muMPas = Math.exp(Math.log(table.mu[j]) + weight * Math.log(table.mu[j + 1] / table.mu[j]));
  const mu = muMPas / 1000;
  return { rho, mu, muMPas, nu: mu / rho, t0: (TEMP_F[j] - 32) / 1.8, t1: (TEMP_F[j + 1] - 32) / 1.8, weight };
}
export function geometry(i: Pick<Inputs,'shape'|'diameter'|'width'|'height'>) {
  if (i.shape === 'circle') {
    const d = i.diameter / 1000;
    return { area: Math.PI * d * d / 4, dh: d, aspect: 1, po: 64 };
  }
  const a = i.width / 1000, b = i.height / 1000;
  const r = Math.min(a,b) / Math.max(a,b);
  // Darcy Poiseuille number (four times the Fanning convention).
  const po = 96 * (1 - 1.3553*r + 1.9467*r**2 - 1.7012*r**3 + 0.9564*r**4 - 0.2537*r**5);
  return { area: a*b, dh: 2*a*b/(a+b), aspect: r, po };
}
export function colebrook(re: number, ed: number) {
  let x = -1.8 * Math.log10((ed/3.7)**1.11 + 6.9/re);
  for (let j=0; j<50; j++) {
    const next = -2 * Math.log10(ed/3.7 + 2.51*x/re);
    if (Math.abs(next-x) < 1e-12) { x=next; break; }
    x=next;
  }
  return 1/(x*x);
}
export function turbulentFactors(re: number, ed: number) {
  const a = (2.457*Math.log(1/((7/re)**0.9 + 0.27*ed)))**16;
  const b = (37530/re)**16;
  const zsA = ed/3.7 + 13/re;
  const zsB = ed/3.7 - 5.02/re*Math.log10(zsA);
  return [
    { id:'colebrook', name:'Colebrook', f:colebrook(re,ed), valid:true },
    { id:'moody', name:'Moody 近似', f:0.0055*(1+(2e4*ed+1e6/re)**(1/3)), valid:re>=4000 && re<=1e8 && ed<=0.01 },
    { id:'churchill', name:'Churchill', f:8*((8/re)**12+(a+b)**(-1.5))**(1/12), valid:true },
    { id:'zigrang', name:'Zigrang–Sylvester', f:1/(-2*Math.log10(ed/3.7-5.02/re*Math.log10(zsB)))**2, valid:re>=4000 && re<=1e8 && ed>=4e-5 && ed<=0.05 },
    { id:'romeo', name:'Romeo et al.', f:1/(-2*Math.log10(ed/3.7065-5.0272/re*Math.log10(ed/3.827-4.567/re*Math.log10((ed/7.7918)**0.9924+(5.3326/(208.815+re))**0.9345))))**2, valid:re>=4000 && re<=1.5e8 && ed<=0.05 },
  ];
}
export function friction(re: number, ed: number, po: number, method: Method) {
  if (re===0) return { f:0, regime:'zero' as const, name:'無流動', comparisons:[] };
  if (re<=2300) return { f:po/re, regime:'laminar' as const, name:'層流解析', comparisons:[] };
  const factors=turbulentFactors(Math.max(4000,re),ed);
  const selected=method==='max'
    ? factors.filter(m=>m.id!=='colebrook' && m.valid).reduce((a,b)=>a.f>b.f?a:b)
    : factors.find(m=>m.id===method)!;
  const blend = re<4000 ? (re-2300)/1700 : 1;
  const s=blend*blend*(3-2*blend);
  const comparisons=factors.map(m=>({...m,f:(1-s)*po/re+s*m.f}));
  return { f:(1-s)*po/re+s*selected.f, regime: re<4000 ? 'transition' as const : 'turbulent' as const,
    name:method==='max'?'四式較大值：'+selected.name:selected.name, comparisons };
}
/** Rennels total bend K includes arc wall friction. Do not add arc length to straight L. */
export function roundedBendK(angle: number, radiusRatio: number, fd: number) {
  const theta=angle*Math.PI/180, s=Math.sin(theta/2);
  return fd*theta*radiusRatio+(0.1+2.4*fd)*s+6.6*fd*(Math.sqrt(s)+s)/radiusRatio**(4*theta/Math.PI);
}
export function validate(i: Inputs) {
  const errors: string[]=[];
  const check=(v:number,min:number,max:number,name:string,inclusive=true)=>{
    if(!Number.isFinite(v)||(inclusive?v<min:v<=min)||v>max)errors.push(name);
  };
  if(!['eg50','pg25'].includes(i.fluid))errors.push('請選擇 EG 50% 或 PG 25%。');
  check(i.temperature,-273.15,1000,'請輸入有效平均液溫。',false);
  if(!i.custom&&(i.temperature<0||i.temperature>90))errors.push('內建物性適用 0–90 °C；其他溫度請開啟手動物性。');
  if(i.custom) {check(i.density,0,30000,'密度必須大於 0 kg/m³。',false);check(i.viscosity,0,1e8,'動力黏度必須大於 0 mPa·s。',false);}
  if(i.shape==='circle')check(i.diameter,0,1e5,'管內徑必須大於 0 mm。',false);
  else {check(i.width,0,1e5,'流道寬必須大於 0 mm。',false);check(i.height,0,1e5,'流道高必須大於 0 mm。',false);}
  check(i.length,0,1e7,'直管總長必須是 0 或正數。');
  check(i.roughness,0,1e4,'粗糙度必須是 0 或正數。');
  check(i.flowMode==='flow'?i.flow:i.velocity,0,1e9,'流量／流速必須是 0 或正數。');
  check(i.extraK,0,1e8,'附加 K 必須是 0 或正數。');
  for(const bend of i.bends) {
    if(!Number.isInteger(bend.count)||bend.count<0||bend.count>10000)errors.push(bend.angle+'° 彎頭數量需為 0–10000 的整數。');
    if(bend.count>0) {
      if(i.bendMode==='manual')check(bend.k,0,1e8,bend.angle+'° 彎頭 K 必須是 0 或正數。');
      else check(bend.radius,0,1e7,bend.angle+'° 中心線半徑 R 必須大於 0 mm。',false);
    }
  }
  if(!errors.length) {
    const g=geometry(i);
    if(i.roughness/1000/g.dh>0.05)errors.push('相對粗糙度 ε/Dh 超過 0.05，已超出本工具的計算範圍。');
    if(i.bendMode==='auto') for(const bend of i.bends)if(bend.count>0&&bend.radius/1000/g.dh<=0.5)errors.push(bend.angle+'° 彎頭需 R/Dh > 0.5；更急的轉角請改輸入實測 K。');
  }
  return [...new Set(errors)];
}
export function calculate(i: Inputs) {
  const errors=validate(i);
  if(errors.length)return {ok:false as const, errors};
  const g=geometry(i);
  const p=i.custom? {rho:i.density,mu:i.viscosity/1000,muMPas:i.viscosity,nu:i.viscosity/1000/i.density,t0:i.temperature,t1:i.temperature,weight:0}:properties(i.fluid,i.temperature);
  const q=i.flowMode==='flow'?(i.flowUnit==='lpm'?i.flow/60000:i.flow/3600):i.velocity*g.area;
  const v=q/g.area, re=p.rho*v*g.dh/p.mu, ed=i.roughness/1000/g.dh;
  const f=friction(re,ed,g.po,i.method), dynamic=p.rho*v*v/2;
  const straight=f.f*i.length/g.dh*dynamic;
  const hasAuto=i.bendMode==='auto'&&i.bends.some(b=>b.count>0);
  // A turbulent elbow correlation is not silently extrapolated into glycol laminar flow.
  const incomplete=hasAuto&&re>0&&re<4000;
  const bends=i.bends.map(b=>{
    const ratio=b.radius/1000/g.dh;
    const k=b.count===0||re===0?0:i.bendMode==='manual'?b.k:incomplete?null:roundedBendK(b.angle,ratio,f.f);
    return {...b,ratio,k,dp:k===null?null:k*b.count*dynamic,arc:i.bendMode==='auto'&&b.count>0?b.count*b.radius/1000*b.angle*Math.PI/180:0};
  });
  const bendDrop=incomplete?null:bends.reduce((sum,b)=>sum+(b.dp??0),0);
  const extra=i.extraK*dynamic;
  const total=bendDrop===null?null:straight+bendDrop+extra;
  const notices:Notice[]=[];
  if(f.regime==='transition')notices.push({kind:'warning',text:'Re 介於 2300–4000，流況可能不穩定；直管摩擦係數採平滑插值，結果為過渡區估算。'});
  if(incomplete)notices.push({kind:'warning',text:'目前 Re < 4000，紊流彎頭公式不適用。請在「彎頭與局部損失」改選手動 K，輸入此流況的供應商／實測值；總壓降暫不顯示，直管結果仍可用。'});
  if(i.shape==='rectangle'&&hasAuto&&!incomplete)notices.push({kind:'warning',text:'矩形彎頭以水力直徑代入圓管 Rennels 式估算，未含彎曲方向與截面形狀修正；精算請改用實測 K。'});
  if(hasAuto&&!incomplete&&ed>0.001)notices.push({kind:'warning',text:'彎頭相關式源自光滑管資料；目前粗糙度較高，彎頭損失宜用供應商 K 複核。'});
  const entrance=f.regime==='laminar'?0.05*re*g.dh:0;
  if(q>0&&entrance>i.length&&i.length>0)notices.push({kind:'info',text:'估計層流入口發展長度約 '+entrance.toFixed(2)+' m，大於直管長度；充分發展流假設可能低估入口段壓降。'});
  if(i.custom)notices.push({kind:'info',text:'目前使用手動密度與黏度；修改液溫或液體時，請同步更新物性。'});
  return {ok:true as const, i,g,p,q,v,re,ed,f,dynamic,straight,bends,bendDrop,extra,total,incomplete,notices,
    head:total===null?null:total/(p.rho*9.80665), waterHead:total===null?null:total/9.80665,
    hydraulicPower:total===null?null:total*q, massFlow:p.rho*q,
    arcLength:bends.reduce((s,b)=>s+b.arc,0), entrance};
}
export type SuccessResult = Extract<ReturnType<typeof calculate>,{ok:true}>;
export const PRESSURE_UNITS = { kPa:{factor:0.001,label:'kPa'},Pa:{factor:1,label:'Pa'},bar:{factor:0.00001,label:'bar'},psi:{factor:1/6894.757293168,label:'psi'}};
export function numberText(value:number|null, digits=3):string {
  if(value===null||!Number.isFinite(value))return '—';
  if(value!==0&&(Math.abs(value)<0.001||Math.abs(value)>=1e7))return value.toExponential(3);
  return value.toLocaleString('en-US',{maximumFractionDigits:digits});
}
