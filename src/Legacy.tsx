import { useState } from 'react'
import { ArrowLeft, ArrowRight, Crown, Landmark } from 'lucide-react'
import { ARM_SLOTS } from './game'
import { SeasonBook, TrophyCase } from './CareerHub'
import { RETIRE_LABEL, careerLine, legacyBonus, type RetiredPlayer } from './retirement'
import { aggregate, formatIP, seasonRates, tierOf } from './season'

function Plaque({ p }: { p: RetiredPlayer }) {
  const c = aggregate(p.seasons), r = seasonRates(c)
  const years = new Set(p.seasons.map(s => s.year)).size
  return <div className={p.hallOfFame ? 'plaque hof' : 'plaque'}>
    {p.hallOfFame && <span className="hof-badge"><Crown size={13} /> HALL OF FAME</span>}
    <h2>{p.name}</h2>
    <p>{p.height}cm · {p.hand === 'R' ? '우투' : '좌투'} · {ARM_SLOTS[p.armSlot].label} · {p.startAge}–{p.retiredAge}세 · {years}년 · 최고 {tierOf(p.peakTier).label}</p>
    <div className="table-scroll"><table className="stat-table plaque-table">
      <thead><tr><th>W-L</th><th>SV</th><th>IP</th><th>ERA</th><th>FIP</th><th>SO</th></tr></thead>
      <tbody><tr><td>{c.wins}-{c.losses}</td><td>{c.saves}</td><td>{formatIP(c.outs)}</td><td>{r.ERA}</td><td>{r.FIP}</td><td>{c.strikeouts}</td></tr></tbody>
    </table></div>
    <p className="plaque-reason">{RETIRE_LABEL[p.reason]}{p.honors.length ? ` · ${p.honors.join(' · ')}` : ''}</p>
    <TrophyCase seasons={p.seasons} />
  </div>
}

/** Farewell screen shown the moment a pitcher retires. */
export function RetirementSheet({ player, legacy, onNext }: { player: RetiredPlayer; legacy: RetiredPlayer[]; onNext: () => void }) {
  return <div className="overlay"><section className="sheet retire-sheet" role="dialog" aria-modal="true" aria-label="은퇴식">
    <span className="eyebrow">{player.reason === 'VOLUNTARY' ? 'FAREWELL' : 'END OF THE ROAD'}</span>
    <h1>{player.hallOfFame ? '명예의 전당 헌액' : '마운드를 내려갑니다'}</h1>
    <Plaque p={player} />
    <SeasonBook seasons={player.seasons} />
    <div className="legacy-next">
      <Landmark size={16} /><span>역대 선수 {legacy.length}명 · 다음 신인 레거시 보너스 <b>+{legacyBonus(legacy)} TP</b> · 해금한 리그는 그대로 유지</span>
    </div>
    <button className="primary-button" onClick={onNext}>새 신인 드래프트 <ArrowRight size={18} /></button>
  </section></div>
}

/** Every retired character on this device. */
export function LegacyHall({ legacy, onClose }: { legacy: RetiredPlayer[]; onClose: () => void }) {
  const [open, setOpen] = useState<string | null>(null)
  const sorted = [...legacy].sort((a, b) => Number(b.hallOfFame) - Number(a.hallOfFame) || aggregate(b.seasons).wins - aggregate(a.seasons).wins)
  const picked = legacy.find(p => p.id === open)
  return <div className="overlay" onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <section className="sheet career-sheet" role="dialog" aria-modal="true" aria-label="역대 선수">
      <div className="sheet-top"><span className="eyebrow">LEGACY · HALL OF FAME</span><button className="icon-button" onClick={() => picked ? setOpen(null) : onClose()} aria-label={picked ? '목록으로' : '닫기'}><ArrowLeft size={18} /></button></div>
      {picked ? <><Plaque p={picked} /><SeasonBook seasons={picked.seasons} /></> : <>
        <h1>역대 선수</h1>
        <p>은퇴한 캐릭터의 전체 기록입니다. 명예의 전당: 통산 150승 · 2000K · MLB 5시즌 · MLB 3시즌 이상 ERA 3.00 이하(500이닝+) · 사이영상 2회 · KBO 골든글러브 3회 중 하나.</p>
        {sorted.length === 0 ? <p className="muted">아직 은퇴한 선수가 없습니다.</p> : <ul className="legacy-list">{sorted.map(p => <li key={p.id}><button onClick={() => setOpen(p.id)}>
          <span>{p.hallOfFame && <Crown size={13} />}<b>{p.name}</b><small>{p.startAge}–{p.retiredAge}세 · {tierOf(p.peakTier).short}</small></span>
          <em>{careerLine(p)}</em>
        </button></li>)}</ul>}
      </>}
    </section>
  </div>
}
