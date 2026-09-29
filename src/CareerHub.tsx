import { useState } from 'react'
import { ArrowLeft, Pencil } from 'lucide-react'
import { ARM_SLOTS, extensionOf, pitcherLevel, releaseHeightOf, type PitcherProfile } from './game'
import { TIERS, aggregate, formatIP, seasonRates, serviceTime, tierOf, type Season } from './season'

type View = 'career' | number

function StatGrid({ s }: { s: Season }) {
  const r = seasonRates(s)
  const traditional: [string, string | number][] = [['G', s.games], ['IP', formatIP(s.outs)], ['W', s.wins], ['L', s.losses], ['SV', s.saves], ['ERA', r.ERA], ['WHIP', r.WHIP], ['H', s.hits], ['HR', s.homeRuns], ['BB', s.walks], ['SO', s.strikeouts], ['HBP', s.hbp]]
  const advanced: [string, string | number, string][] = [['FIP', r.FIP, '수비 무관 평균자책'], ['K/9', r['K/9'], '9이닝당 삼진'], ['BB/9', r['BB/9'], '9이닝당 볼넷'], ['K/BB', r['K/BB'], '삼진/볼넷'], ['BAA', r.BAA, '피안타율']]
  return <>
    <h3 className="stat-heading">Traditional</h3>
    <div className="stat-grid">{traditional.map(([k, v]) => <div key={k}><small>{k}</small><strong>{v}</strong></div>)}</div>
    <h3 className="stat-heading">Advanced</h3>
    <div className="stat-grid advanced">{advanced.map(([k, v, hint]) => <div key={k} title={hint}><small>{k}</small><strong>{v}</strong><span>{hint}</span></div>)}</div>
  </>
}

export function CareerHub({ profile, history, current, onClose, onEdit }: { profile: PitcherProfile; history: Season[]; current: Season; onClose: () => void; onEdit: () => void }) {
  const seasons = [...history, current]
  const [view, setView] = useState<View>('career')
  const career = aggregate(seasons)
  const service = serviceTime(history, current)
  const shown = view === 'career' ? career : seasons.find(s => s.number === view) ?? current
  const debut = service.debutSeason ? seasons.find(s => s.number === service.debutSeason) : null
  return <div className="overlay" onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <section className="sheet career-sheet" role="dialog" aria-modal="true" aria-label="커리어 / 선수 프로필">
      <div className="sheet-top"><span className="eyebrow">CAREER · PLAYER PROFILE</span><button className="icon-button" onClick={onClose} aria-label="닫기"><ArrowLeft size={18} /></button></div>
      <header className="career-head">
        <div className="career-badge"><span>{service.label}</span></div>
        <h1>{profile.name}</h1>
        <p>{profile.height}cm · {profile.hand === 'R' ? '우투' : '좌투'} · {ARM_SLOTS[profile.armSlot].label} · 익스텐션 {extensionOf(profile).toFixed(2)}m · 릴리스 {releaseHeightOf(profile).toFixed(2)}m</p>
        <div className="career-meta">
          <div><small>현재 리그</small><b>{tierOf(current.tier).label}</b></div>
          <div><small>데뷔</small><b>{debut ? `S${debut.number} · ${tierOf(debut.tier).short}` : '아마추어'}</b></div>
          <div><small>프로 연차</small><b>{service.proYears}년</b></div>
          <div><small>투수 LV</small><b>{pitcherLevel(profile)}</b></div>
        </div>
        <button className="ghost-button" onClick={onEdit}><Pencil size={14} /> 프로필 수정</button>
      </header>

      <div className="segmented" role="tablist" aria-label="기간">
        <button role="tab" aria-selected={view === 'career'} className={view === 'career' ? 'active' : ''} onClick={() => setView('career')}>통산</button>
        {seasons.map(s => <button role="tab" key={s.number} aria-selected={view === s.number} className={view === s.number ? 'active' : ''} onClick={() => setView(s.number)}>S{s.number}<small>{tierOf(s.tier).short}</small></button>)}
      </div>
      <p className="stat-caption">{view === 'career' ? `${seasons.length}시즌 통산` : `시즌 ${shown.number} · ${tierOf(shown.tier).label}${shown === current ? ' · 진행 중' : ''}`}</p>
      <StatGrid s={shown} />

      <h3 className="stat-heading">Season by season</h3>
      <div className="table-scroll">
        <table className="season-table">
          <thead><tr><th>Season</th><th>Lg</th><th>G</th><th>W-L</th><th>SV</th><th>IP</th><th>ERA</th><th>WHIP</th><th>FIP</th><th>SO</th><th>BB</th><th>K/9</th></tr></thead>
          <tbody>
            {seasons.map(s => { const r = seasonRates(s); return <tr key={s.number} className={view === s.number ? 'on' : ''} onClick={() => setView(s.number)}><td>S{s.number}</td><td>{TIERS[s.tier].short}</td><td>{s.games}</td><td>{s.wins}-{s.losses}</td><td>{s.saves}</td><td>{formatIP(s.outs)}</td><td>{r.ERA}</td><td>{r.WHIP}</td><td>{r.FIP}</td><td>{s.strikeouts}</td><td>{s.walks}</td><td>{r['K/9']}</td></tr> })}
            {(() => { const r = seasonRates(career); return <tr className="total"><td>Career</td><td>—</td><td>{career.games}</td><td>{career.wins}-{career.losses}</td><td>{career.saves}</td><td>{formatIP(career.outs)}</td><td>{r.ERA}</td><td>{r.WHIP}</td><td>{r.FIP}</td><td>{career.strikeouts}</td><td>{career.walks}</td><td>{r['K/9']}</td></tr> })()}
          </tbody>
        </table>
      </div>
      <p className="stat-foot">ERA는 전 실점 기준(비자책 구분 없음). FIP = (13·HR + 3·(BB+HBP) − 2·SO) / IP + 3.10. SV = 9회를 1–3점 차 리드로 시작해 지켜낸 경기. 진행 중인 경기는 종료 후 반영됩니다.</p>
    </section>
  </div>
}
