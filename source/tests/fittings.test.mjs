import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,calculate} from '../lib/hydraulics.ts';
import {createDraft,toInputs,restoreDraft} from '../lib/form-state.ts';
const base={...structuredClone(DEFAULTS),custom:true,density:1000,viscosity:1,flow:12,bends:DEFAULTS.bends.map(b=>({...b,count:0}))};
const fit=(change={})=>({kind:'manual',count:1,diameter:10,outlet:20,k:2,...change});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} vs ${b}`);
test('different reference diameters use individual velocities and add losses',()=>{
 const r=calculate({...base,fittings:[fit(),fit({diameter:20,count:2})]});assert.equal(r.ok,true);
 const v1=(12/60000)/(Math.PI*.01**2/4),v2=v1/4;
 const expected=2*1000*v1**2/2+2*2*1000*v2**2/2;
 near(r.fittingDrop,expected);near(r.total,r.straight+expected);
 near(r.head,r.total/9806.65);near(r.hydraulicPower,r.total*r.q);
});
test('reference cases match fluids inlet, exit and Rennels sudden expansion',()=>{
 const r=calculate({...base,fittings:[fit({kind:'entrance'}),fit({kind:'exit'}),fit({kind:'expansion'})]});assert.equal(r.ok,true);
 near(r.fittings[0].k,.57);near(r.fittings[1].k,1);near(r.fittings[2].k,.5625);
});
test('low-Re automatic fittings require a measured K; invalid dimensions are rejected',()=>{
 for(const fitting of [fit({kind:'expansion',outlet:5}),fit({diameter:0}),fit({k:-1}),fit({count:1.5}),fit({kind:'other'})])assert.equal(calculate({...base,fittings:[fitting]}).ok,false);
 assert.equal(calculate({...base,flow:.1,fittings:[fit({kind:'entrance'})]}).ok,false);
 assert.equal(calculate({...base,flow:.1,fittings:[fit()]}).ok,true);
 const zero=calculate({...base,flow:0,fittings:[fit({kind:'entrance'})]});assert.equal(zero.ok,true);near(zero.total,0);
 const unused=calculate({...base,fittings:[fit({count:0,diameter:NaN,k:NaN})]});assert.equal(unused.ok,true);near(unused.fittingDrop,0);
});
test('new and legacy local settings round trip without losing numeric edits',()=>{
 const draft=createDraft({...base,fittings:[fit({diameter:12.5,count:2})]});
 const restored=restoreDraft(JSON.stringify({version:1,form:draft}));assert.deepEqual(restored,draft);
 near(toInputs(restored).fittings[0].diameter,12.5);
 assert.deepEqual(restoreDraft(JSON.stringify({version:1,form:{flow:'3.5'}})).fittings,[]);
});
