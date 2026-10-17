import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {coolpropLookup,COOLPROP} from '../lib/coolprop.ts';
import {createDraft,restoreDraft,toInputs} from '../lib/form-state.ts';import {DEFAULTS,calculate} from '../lib/hydraulics.ts';
const fixtures=JSON.parse(fs.readFileSync(new URL('./coolprop-fixtures.json',import.meta.url)));
test('CoolProp table interpolation matches engine within 0.1% over 120 independent points',()=>{
 for(const f of fixtures){const r=coolpropLookup(f.id,f.t);for(const [v,e] of [r.rho,r.mu,r.cp,r.k].map((v,j)=>[v,f.expected[j]]))assert.ok(Math.abs(v/e-1)<.001);}
});
test('CoolProp bounds and concentration basis cannot silently change',()=>{
 assert.equal(COOLPROP.pressure_pa,300000);assert.equal(COOLPROP.series.length,15);
 assert.ok(coolpropLookup('MEG-50',25).name.includes('wt%'));
 for(const t of [-.01,90.01,NaN,Infinity])assert.throws(()=>coolpropLookup('MEG-50',t));assert.throws(()=>coolpropLookup('MEG-51',25));
});
test('selected property point survives local restoration and drives pipe density and viscosity',()=>{
 const p=coolpropLookup('MEG-30',37.5),draft=createDraft({...DEFAULTS,custom:true,customFluidName:p.name,temperature:p.t,density:p.rho,viscosity:p.mu*1000});
 const i=toInputs(restoreDraft(JSON.stringify({version:1,form:draft})));assert.equal(i.customFluidName,p.name);
 const r=calculate(i);assert.equal(r.ok,true);assert.ok(Math.abs(r.p.rho-p.rho)<1e-9);assert.ok(Math.abs(r.p.mu-p.mu)<1e-12);
});
