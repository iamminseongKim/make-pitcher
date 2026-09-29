import { PITCHES, type PitchLog } from './game'

/** Shared normalized catcher coordinates: zone edges are ±1, y grows downward. */
export function chartGeometry(pitches: PitchLog[]) {
  const extent = Math.max(2.3, ...pitches.flatMap(p => [Math.abs(p.x) + .2, Math.abs(p.y) + .2]))
  const scale = 140 / extent
  return { scale, x: (v: number) => 160 + v * scale, y: (v: number) => 160 + v * scale }
}
export function PitchChart({ pitches }: { pitches: PitchLog[] }) {
  const { scale, x, y } = chartGeometry(pitches)
  return <section className="pitch-chart" aria-label="Full game pitch location chart">
    <header><strong>PITCH BREAKDOWN</strong><span>{pitches.length} PITCHES · CATCHER VIEW</span></header>
    <svg viewBox="0 0 320 360" role="img" aria-label={`${pitches.length} pitches, colored by pitch type. Strike zone divided into nine cells.`}>
      <rect x={x(-1)} y={y(-1)} width={scale * 2} height={scale * 2} fill="#eef1f5" stroke="#233145" strokeWidth="1.5" />
      {[-1 / 3, 1 / 3].map(v => <g key={v} stroke="#a5adb9" strokeDasharray="3 3"><path d={`M ${x(v)} ${y(-1)} V ${y(1)}`} /><path d={`M ${x(-1)} ${y(v)} H ${x(1)}`} /></g>)}
      <path d={`M ${x(-1)} 322 L ${x(1)} 322 L ${x(1)} 336 L 160 352 L ${x(-1)} 336 Z`} fill="#e4e7eb" stroke="#a5adb9" />
      {pitches.map((p, i) => <circle key={i} cx={x(p.x)} cy={y(p.y)} r="4.3" fill={PITCHES.find(d => d.id === p.pitch)!.color} stroke="#253349" strokeWidth=".7" opacity=".85"><title>{i + 1}. {p.pitch} · {p.speed} km/h · {p.call}</title></circle>)}
    </svg>
    <ul>{PITCHES.filter(d => pitches.some(p => p.pitch === d.id)).map(d => { const n = pitches.filter(p => p.pitch === d.id).length; return <li key={d.id}><i style={{ background: d.color }} /><span>{d.id.replaceAll('_', ' ')}</span><b>{n} · {Math.round(n / pitches.length * 100)}%</b></li> })}</ul>
    {!pitches.length && <p>No pitch locations recorded for this saved game.</p>}
  </section>
}
