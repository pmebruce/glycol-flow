import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,calculate,geometry,properties,friction,turbulentFactors,colebrook,roundedBendK} from '../lib/hydraulics.ts';
import {createDraft,toInputs,parseNumber,restoreDraft} from '../lib/form-state.ts';

const near=(a,b,rel=1e-9)=>assert.ok(Math.abs(a-b)<=Math.max(1e-12,Math.abs(b)*rel),`${a} differs from ${b}`);
const blankBends=()=>DEFAULTS.bends.map(b=>({...b,count:0}));
const calc=(overrides={})=>{const r=calculate({...structuredClone(DEFAULTS),...overrides});assert.equal(r.ok,true,JSON.stringify(r));return r;};

test('published property anchors and units remain exact',()=>{
  const eg=properties('eg50',10),pg=properties('pg25',10);
  near(eg.muMPas,5.50);near(eg.rho,68.14*16.01846337396014);
  near(pg.muMPas,3.66);near(pg.rho,64.23*16.01846337396014);
  near(eg.nu,0.0055/eg.rho);
});
test('density is linearly interpolated and viscosity is log interpolated',()=>{
  const p=properties('eg50',(55-32)/1.8);
  near(p.muMPas,Math.sqrt(5.5*4.55));near(p.rho,(68.14+67.96)/2*16.01846337396014);
});
test('built-in properties never silently extrapolate',()=>{
  for(const t of [-1,91,NaN,Infinity])assert.throws(()=>properties('eg50',t));
  assert.equal(calculate({...DEFAULTS,temperature:91}).ok,false);
  assert.equal(calc({custom:true,temperature:91}).ok,true);
});
test('round-pipe laminar pressure agrees with Hagen–Poiseuille independently',()=>{
  const r=calc({custom:true,density:1050,viscosity:2,diameter:10,length:2,flow:0.25,bends:blankBends(),roughness:0});
  const expected=128*0.002*2*(0.25/60000)/(Math.PI*0.01**4);
  near(r.total,expected);assert.equal(r.f.regime,'laminar');
  near(calc({...r.i,flow:0.5}).total,expected*2);
  near(calc({...r.i,diameter:20}).total,expected/16);
});
test('rectangular laminar polynomial agrees with independent infinite-series solution',()=>{
  for(const [a,b] of [[0.012,0.004],[0.006,0.006],[0.02,0.001]]) {
    const mu=0.002,L=2,Q=0.05/60000;
    const r=calc({custom:true,density:1050,viscosity:2,shape:'rectangle',width:a*1000,height:b*1000,length:L,flow:0.05,bends:blankBends()});
    let sum=0;for(let m=1;m<1500;m+=2)sum+=Math.tanh(m*Math.PI*a/(2*b))/m**5;
    const exact=12*mu*L*Q/(a*b**3*(1-192*b/(Math.PI**5*a)*sum));
    near(r.total,exact,0.006);
    near(calc({...r.i,width:b*1000,height:a*1000}).total,r.total);
  }
});
test('hydraulic diameter definitions and square Darcy Poiseuille number',()=>{
  near(geometry({...DEFAULTS,diameter:129}).dh,0.129);
  const square=geometry({...DEFAULTS,shape:'rectangle',width:10,height:10});
  near(square.dh,0.01);near(square.po,56.9184);
});
test('five friction correlations agree with published numerical examples',()=>{
  const expected={colebrook:0.018513866077471,moody:0.01809185666808665,churchill:0.018462624566280075,zigrang:0.01850021312358548,romeo:0.018530291219676177};
  for(const row of turbulentFactors(1e5,1e-4))near(row.f,expected[row.id]);
  const f=colebrook(5e5,0.0007);
  near(1/Math.sqrt(f),-2*Math.log10(0.0007/3.7+2.51/(5e5*Math.sqrt(f))));
});
test('transition treatment is continuous at both boundaries',()=>{
  for(const po of [64,56.9184,80])for(const method of ['colebrook','churchill','max'])for(const re of [2300,4000]) {
    near(friction(re-1e-5,1e-4,po,method).f,friction(re+1e-5,1e-4,po,method).f,1e-7);
  }
});
test('maximum selection excludes models outside their published roughness range',()=>{
  const f=friction(1e5,0,64,'max');
  const valid=f.comparisons.filter(m=>m.id!=='colebrook'&&m.valid);
  near(f.f,Math.max(...valid.map(m=>m.f)));
  assert.equal(f.comparisons.find(m=>m.id==='zigrang').valid,false);
});
test('Rennels bend agrees with the documented reference example',()=>{
  near(roundedBendK(30,20/4.020,colebrook(1e5,0)),0.11519070808085191);
});
test('bend arc friction is counted once and quantity scales local loss',()=>{
  const r=calc();
  near(r.total,r.straight+r.bends.reduce((s,b)=>s+b.dp,0));
  const twice=calc({bends:DEFAULTS.bends.map(b=>({...b,count:b.count*2}))});
  near(twice.straight,r.straight);near(twice.bendDrop,2*r.bendDrop);
});
test('auto bends require turbulent flow; manual K completes low-Re calculation',()=>{
  const r=calc({flow:0.25});
  assert.equal(r.incomplete,true);assert.equal(r.total,null);assert.ok(r.straight>0);
  const manual=calc({...r.i,bendMode:'manual'});
  near(manual.total,manual.straight+2*0.3*manual.dynamic);
});
test('manual and additional K use the same velocity basis',()=>{
  const r=calc({flow:0.25,bendMode:'manual',extraK:3});
  near(r.total,r.straight+(0.3*2+3)*r.dynamic);
  near(r.head,r.total/(r.p.rho*9.80665));
  near(r.hydraulicPower,r.total*r.q);
});
test('unit changes and velocity input preserve a physical operating point',()=>{
  const r=calc({flow:6});
  near(calc({flow:0.36,flowUnit:'m3h'}).total,r.total);
  near(calc({flowMode:'velocity',velocity:r.v}).total,r.total);
});
test('zero flow has zero pressure and no invented Reynolds or bend losses',()=>{
  const r=calc({flow:0});
  assert.equal(r.total,0);assert.equal(r.re,0);assert.equal(r.incomplete,false);assert.equal(r.f.regime,'zero');
});
test('invalid physical inputs do not produce apparently valid pressure',()=>{
  for(const change of [{diameter:0},{flow:-1},{flow:NaN},{length:-1},{roughness:2},{custom:true,viscosity:0},{bends:[{angle:90,count:1.5,radius:15,k:0.2}]},{bends:[{angle:90,count:1,radius:5,k:0.2}]}])assert.equal(calculate({...DEFAULTS,...change}).ok,false);
  assert.equal(calc({bends:DEFAULTS.bends.map(b=>({...b,count:0,radius:NaN}))}).ok,true);
});
test('decimal editing and local restoration preserve user input',()=>{
  near(parseNumber('3.5'),3.5);near(parseNumber('.5'),0.5);near(parseNumber('３．５'),3.5);near(parseNumber('1e-3'),0.001);
  for(const s of ['', '.', '1.2.3', 'Infinity', 'abc'])assert.ok(Number.isNaN(parseNumber(s)));
  const draft=createDraft();draft.flow='3.5';draft.roughness='0.001';draft.bends[1].count='3';
  assert.deepEqual(restoreDraft(JSON.stringify({version:1,form:draft})),draft);
  near(toInputs(draft).flow,3.5);
  assert.equal(restoreDraft(JSON.stringify({version:1,form:{shape:'bad',bends:[{angle:999}]}})).shape,'circle');
});
