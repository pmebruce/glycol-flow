"""CoolProp liquid-state lookup grid at 300 kPa absolute. Regenerate with CoolProp 8.0.0."""
from pathlib import Path
import json
import CoolProp
from CoolProp.CoolProp import PropsSI
root=Path(__file__).resolve().parents[1]
series=[]
for kind,name in [('water','水'),('MEG','乙二醇 EG'),('MPG','丙二醇 PG')]:
 for pct in ([0] if kind=='water' else [10,20,25,30,40,50,60]):
  fluid='Water' if kind=='water' else f'INCOMP::{kind}-{pct}%'
  freeze=0 if kind=='water' else PropsSI('T_freeze','T',298.15,'P',300000,fluid)-273.15
  data=[[t,*[PropsSI(k,'T',t+273.15,'P',300000,fluid) for k in ['D','V','C','L']]] for t in range(0,91)]
  series.append({'id':kind+'-'+str(pct),'name':name if kind=='water' else f'{name} {pct} wt%','fluid':fluid,'fraction_wt_pct':pct,'freeze_c':freeze,'rows':data})
out={'version':CoolProp.__version__,'pressure_pa':300000,'columns':['temperature_c','density_kg_m3','viscosity_pa_s','cp_j_kg_k','conductivity_w_m_k'],'temperature_step_c':1,'series':series}
path=root/'lib/coolprop-data.json';path.write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('Generated',len(series),'liquid series')
