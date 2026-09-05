import type { Shape } from '@/lib/hydraulics';

export function FlowDiagram({shape}:{shape:Shape}) {
  return <svg viewBox="0 0 420 130" role="img" aria-label={shape==='circle'?'圓管截面：內徑 D 等於水力直徑 Dh':'矩形流道截面：內部寬 a、高 b，Dh 等於 2ab 除以 a 加 b'} className="flow-diagram">
    <defs><marker id="dimension-arrow" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto-start-reverse"><path d="M0,0 L7,3.5 L0,7" fill="currentColor"/></marker></defs>
    <g fill="none" stroke="currentColor" strokeWidth="2">
    {shape==='circle'?<><circle cx="80" cy="65" r="43" fill="#e1f1eb"/><path d="M42 65H118" markerStart="url(#dimension-arrow)" markerEnd="url(#dimension-arrow)"/><text x="74" y="55" fill="currentColor" stroke="none" fontSize="18">D</text></>:<><rect x="24" y="24" width="110" height="68" rx="2" fill="#e1f1eb"/><path d="M26 111H132" markerStart="url(#dimension-arrow)" markerEnd="url(#dimension-arrow)"/><path d="M152 26V90" markerStart="url(#dimension-arrow)" markerEnd="url(#dimension-arrow)"/><text x="75" y="105" fill="currentColor" stroke="none" fontSize="18">a</text><text x="162" y="65" fill="currentColor" stroke="none" fontSize="18">b</text></>}
    </g><g fill="currentColor" fontFamily="inherit"><text x="202" y="53" fontSize="22" fontWeight="600">{shape==='circle'?'Dh = D':'Dh = 2ab / (a+b)'}</text><text x="202" y="88" fontSize="18">{shape==='circle'?'A = πD² / 4':'A = ab'}</text></g>
  </svg>;
}
