'use client';
import { useMemo } from 'react';
import { CartesianGrid,Line,LineChart,XAxis,YAxis,ReferenceLine } from 'recharts';
import { ChartContainer,ChartTooltip,ChartTooltipContent } from '@/components/ui/chart';
import { calculate,numberText,type SuccessResult,PRESSURE_UNITS } from '@/lib/hydraulics';

export function PressureCurve({r,unit}:{r:SuccessResult;unit:keyof typeof PRESSURE_UNITS}) {
  const data=useMemo(()=>{
    const max=Math.max(r.q*60000*2,1), factor=PRESSURE_UNITS[unit].factor;
    return Array.from({length:41},(_,j)=>{
      const flow=max*j/40;
      const calculateAt=(fluid:'eg50'|'pg25')=>{
        const c=calculate({...r.i,fluid,flowMode:'flow',flowUnit:'lpm',flow});
        return c.ok&&c.total!==null?c.total*factor:null;
      };
      return {flow,eg50:calculateAt('eg50'),pg25:r.i.custom?null:calculateAt('pg25')};
    });
  },[r,unit]);
  return <section className="panel curve-panel" aria-label="流量與壓降曲線">
    <div className="panel-heading compact"><h2>流量 × 壓降</h2><span className="quiet">{unit}</span></div>
    <p className="support">同一幾何、液溫與配件，查看不同流量的總壓降。</p>
    <ChartContainer className="pressure-chart" config={{eg50:{label:r.i.custom?'手動物性':'EG 50%',color:'#176c61'},pg25:{label:'PG 25%',color:'#bf702d'}}}>
      <LineChart data={data} margin={{top:10,right:14,bottom:5,left:0}} accessibilityLayer>
        <CartesianGrid vertical={false} strokeDasharray="3 5"/>
        <XAxis dataKey="flow" type="number" domain={['dataMin','dataMax']} tickFormatter={v=>numberText(v,1)} tickLine={false} axisLine={false} minTickGap={25}/>
        <YAxis tickFormatter={v=>numberText(v,1)} tickLine={false} axisLine={false} width={52}/>
        <ChartTooltip content={<ChartTooltipContent className="curve-tooltip" labelFormatter={(_,payload)=>`${numberText(Number(payload?.[0]?.payload?.flow),2)} L/min`} formatter={(v,name)=><><span>{name==='eg50'?(r.i.custom?'手動物性':'EG 50%'):'PG 25%'}</span><b>{numberText(Number(v))} {unit}</b></>}/>}/>
        <ReferenceLine x={r.q*60000} stroke="#8a9591" strokeDasharray="4 4"/>
        <Line dataKey="eg50" name="eg50" type="linear" stroke="var(--color-eg50)" strokeWidth={3} dot={false} connectNulls={false} isAnimationActive={false}/>
        {!r.i.custom&&<Line dataKey="pg25" name="pg25" type="linear" stroke="var(--color-pg25)" strokeWidth={3} dot={false} connectNulls={false} isAnimationActive={false}/>}
      </LineChart>
    </ChartContainer>
    <div className="chart-bottom"><span className="chart-key"><i/>{r.i.custom?'手動物性':'EG 50%'}</span>{!r.i.custom&&<span className="chart-key pg"><i/>PG 25%</span>}<span className="chart-axis">流量 L/min</span></div>
    {r.i.bendMode==='auto'&&r.i.bends.some(b=>b.count>0)&&<p className="fine-print">低 Re、彎頭公式不適用的區段留白；虛線為目前流量。</p>}
  </section>;
}
