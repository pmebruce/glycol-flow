import { DEFAULTS, type Inputs } from './hydraulics.ts';

export const NUMERIC_FIELDS = ['temperature','density','viscosity','diameter','width','height','length','roughness','flow','velocity','extraK'] as const;
export type NumericField = typeof NUMERIC_FIELDS[number];
export type Draft = Omit<Inputs,NumericField|'bends'> & Record<NumericField,string> & {
  bends: {angle:45|90|180;count:string;radius:string;k:string}[];
};
export function createDraft(i:Inputs=DEFAULTS):Draft {
  const numeric=Object.fromEntries(NUMERIC_FIELDS.map(k=>[k,String(i[k])])) as Record<NumericField,string>;
  return {...i,...numeric,
    bends:i.bends.map(b=>({...b,count:String(b.count),radius:String(b.radius),k:String(b.k)}))};
}
export function parseNumber(s:string):number {
  const normalized=s.trim().replace(/[０-９]/g,c=>String(c.charCodeAt(0)-0xff10)).replace(/．/g,'.').replace(/−/g,'-');
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)?Number(normalized):NaN;
}
export function toInputs(d:Draft):Inputs {
  const numeric=Object.fromEntries(NUMERIC_FIELDS.map(k=>[k,parseNumber(d[k])])) as Record<NumericField,number>;
  return {...d,...numeric,
    bends:d.bends.map(b=>({...b,count:parseNumber(b.count),radius:parseNumber(b.radius),k:parseNumber(b.k)}))};
}
export function restoreDraft(raw:string):Draft {
  const parsed=JSON.parse(raw);
  if(parsed?.version!==1||!parsed.form||typeof parsed.form!=='object')return createDraft();
  const draft=createDraft(), f=parsed.form;
  for(const key of NUMERIC_FIELDS)if(typeof f[key]==='string'&&f[key].length<60)draft[key]=f[key];
  for(const [key,choices] of Object.entries({fluid:['eg50','pg25'],shape:['circle','rectangle'],flowMode:['flow','velocity'],flowUnit:['lpm','m3h'],method:['colebrook','churchill','max'],bendMode:['auto','manual']})) {
    if(choices.includes(f[key]))Object.assign(draft,{[key]:f[key]});
  }
  if(typeof f.custom==='boolean')draft.custom=f.custom;
  if(Array.isArray(f.bends))draft.bends=draft.bends.map((b,j)=>{
    const old=f.bends[j];
    for(const key of ['count','radius','k'] as const)if(old&&typeof old[key]==='string'&&old[key].length<60)b[key]=old[key];
    return b;
  });
  return draft;
}
