import data from './coolprop-data.json' with {type:'json'};
export const COOLPROP=data;
export function coolpropLookup(id:string,t:number){
 const s=data.series.find(s=>s.id===id);
 if(!s||!Number.isFinite(t)||t<0||t>90)throw new Error('請選擇物性資料，並輸入 0–90 °C；本工具不外推。');
 if(t<s.freeze_c)throw new Error('目前溫度低於此濃度的冰點，不能使用液態物性。');
 const j=Math.min(89,Math.floor(t)),a=s.rows[j],b=s.rows[j+1],w=t-j;
 const linear=(k:number)=>a[k]+w*(b[k]-a[k]);
 return {name:s.name,fluid:s.fluid,t,rho:linear(1),mu:Math.exp(Math.log(a[2])+w*Math.log(b[2]/a[2])),cp:linear(3),k:linear(4),freeze:s.freeze_c,pressurePa:data.pressure_pa};
}
