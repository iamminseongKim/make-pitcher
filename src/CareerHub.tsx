import { useState } from 'react'
import { ArrowLeft, Flag, Landmark, Pencil } from 'lucide-react'
import { ageEffects, ageStage } from './retirement'
import { ARM_SLOTS, extensionOf, pitcherLevel, releaseHeightOf, type PitcherProfile } from './game'
import { AWARDS, PROMOTION, TIERS, trophyCase, aggregate, formatIP, promotionStatus, seasonRates, serviceTime, tierOf, type Criterion, type Season } from './season'

type View = 'career' | number

function Checklist({ items }: { items: Criterion[] }) {
  return <table className="criteria-table"><thead><tr><th>항목</th><th>현재</th><th>기준</th><th /></tr></thead>
    <tbody>{items.map(c => <tr key={c.label} className={c.met ? 'met' : ''}><td>{c.label}</td><td>{c.value}</td><td>{c.goal}</td><td>{c.met ? '✓' : '—'}</td></tr>)}</tbody></table>
}
/** Promotion rules for the season in progress (season end + mid-season call-up + demotion line). */
export function PromotionCard({ season, done }: { season: Season; done: boolean }) {
  const p = promotionStatus(season)
  const tier = tierOf(season.tier), next = TIERS[season.tier + 1]
  if (p.top) return <div className="promo-card"><header><b>MLB</b><span>최고 무대입니다. ERA {(p.threshold + PROMOTION.demoteMargin).toFixed(2)} 이상({PROMOTION.demoteMinOuts / 3}이닝+)이면 시즌 후 AAA 강등.</span></header></div>
  return <div className={`promo-card ${p.canPromote || p.callUp ? 'ready' : ''} ${p.demote ? 'danger' : ''}`}>
    <header><b>{tier.short} → {next.short}</b><span>{done ? (p.demote ? '강등 기준에 걸렸습니다' : p.canPromote ? '승격 조건 달성!' : '승격 조건 미달') : p.callUp ? '콜업 조건 달성!' : '시즌 종료 시 승격 조건'}</span></header>
    <Checklist items={p.season} />
    {!done && <><p className="promo-sub">시즌 중 콜업 ({PROMOTION.callUpGames}경기 이상 압도적 성적)</p><Checklist items={p.callUpCriteria} /></>}
    {season.tier > 0 && <p className="promo-sub warn">강등: ERA {(p.threshold + PROMOTION.demoteMargin).toFixed(2)} 이상 ({PROMOTION.demoteMinOuts / 3}이닝 이상) 시 시즌 후 한 단계 하락</p>}
  </div>
}

export function StatGrid({ s }: { s: Season }) {
  const r = seasonRates(s)
  const traditional: [string, string | number][] = [['G', s.games], ['IP', formatIP(s.outs)], ['W', s.wins], ['L', s.losses], ['SV', s.saves], ['ERA', r.ERA], ['WHIP', r.WHIP], ['H', s.hits], ['HR', s.homeRuns], ['BB', s.walks], ['SO', s.strikeouts], ['HBP', s.hbp]]
  const advanced: [string, string | number, string][] = [['FIP', r.FIP, '수비 무관 평균자책'], ['K/9', r['K/9'], '9이닝당 삼진'], ['BB/9', r['BB/9'], '9이닝당 볼넷'], ['K/BB', r['K/BB'], '삼진/볼넷'], ['BAA', r.BAA, '피안타율']]
  return <>
    <h3 className="stat-heading">Traditional</h3>
    <div className="table-scroll"><table className="stat-table"><thead><tr>{traditional.map(([k]) => <th key={k}>{k}</th>)}</tr></thead><tbody><tr>{traditional.map(([k, v]) => <td key={k}>{v}</td>)}</tr></tbody></table></div>
    <h3 className="stat-heading">Advanced</h3>
    <div className="table-scroll"><table className="stat-table advanced"><thead><tr>{advanced.map(([k, , hint]) => <th key={k} title={hint}>{k}</th>)}</tr></thead><tbody><tr>{advanced.map(([k, v, hint]) => <td key={k} title={hint}>{v}</td>)}</tr></tbody></table></div>
  </>
}

/** Awards and single-game feats across a career. */
export function TrophyCase({ seasons }: { seasons: Season[] }) {
  const items = trophyCase(seasons)
  if (!items.length) return <p className="muted small">아직 수상 경력이 없습니다.</p>
  return <ul className="award-list">{items.map((t, i) => <li key={i} className={t.kind}><small>S{t.season} · {TIERS[t.tier].short}</small>{t.name}</li>)}</ul>
}

/** Period tabs + stat grid + season-by-season table. Shared by the live career hub and the legacy hall. */
export function SeasonBook({ seasons, current }: { seasons: Season[]; current?: Season }) {
  const [view, setView] = useState<View>('career')
  const career = aggregate(seasons)
  const shown = view === 'career' ? career : seasons.find(s => s.number === view) ?? career
  return <>
    <div className="segmented" role="tablist" aria-label="기간">
      <button role="tab" aria-selected={view === 'career'} className={view === 'career' ? 'active' : ''} onClick={() => setView('career')}>통산</button>
      {seasons.map(s => <button role="tab" key={s.number} aria-selected={view === s.number} className={view === s.number ? 'active' : ''} onClick={() => setView(s.number)}>S{s.number}<small>{tierOf(s.tier).short}</small></button>)}
    </div>
    <p className="stat-caption">{view === 'career' ? `${seasons.length}시즌 통산` : `시즌 ${shown.number}${shown.age ? ` · ${shown.age}세` : ''} · ${tierOf(shown.tier).label}${shown === current ? ' · 진행 중' : ''}`}</p>
    <StatGrid s={shown} />
    <h3 className="stat-heading">Season by season</h3>
    <div className="table-scroll">
      <table className="season-table">
        <thead><tr><th>Season</th><th>Age</th><th>Lg</th><th>G</th><th>W-L</th><th>SV</th><th>IP</th><th>ERA</th><th>WHIP</th><th>FIP</th><th>SO</th><th>BB</th><th>K/9</th></tr></thead>
        <tbody>
          {seasons.map(s => { const r = seasonRates(s); return <tr key={s.number} className={view === s.number ? 'on' : ''} onClick={() => setView(s.number)}><td>S{s.number}</td><td>{s.age ?? '—'}</td><td>{TIERS[s.tier].short}</td><td>{s.games}</td><td>{s.wins}-{s.losses}</td><td>{s.saves}</td><td>{formatIP(s.outs)}</td><td>{r.ERA}</td><td>{r.WHIP}</td><td>{r.FIP}</td><td>{s.strikeouts}</td><td>{s.walks}</td><td>{r['K/9']}</td></tr> })}
          {(() => { const r = seasonRates(career); return <tr className="total"><td>Career</td><td>—</td><td>—</td><td>{career.games}</td><td>{career.wins}-{career.losses}</td><td>{career.saves}</td><td>{formatIP(career.outs)}</td><td>{r.ERA}</td><td>{r.WHIP}</td><td>{r.FIP}</td><td>{career.strikeouts}</td><td>{career.walks}</td><td>{r['K/9']}</td></tr> })()}
        </tbody>
      </table>
    </div>
  </>
}

export function CareerHub({ profile, history, current, onClose, onEdit, onLegacy, onRetire, legacyCount }: { profile: PitcherProfile; history: Season[]; current: Season; onClose: () => void; onEdit: () => void; onLegacy: () => void; onRetire: (() => void) | null; legacyCount: number }) {
  const seasons = [...history, current]
  const service = serviceTime(history, current)
  const [confirmRetire, setConfirmRetire] = useState(false)
  const debut = service.debutSeason ? seasons.find(s => s.number === service.debutSeason) : null
  return <div className="overlay" onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <section className="sheet career-sheet" role="dialog" aria-modal="true" aria-label="커리어 / 선수 프로필">
      <div className="sheet-top"><span className="eyebrow">CAREER · PLAYER PROFILE</span><button className="icon-button" onClick={onClose} aria-label="닫기"><ArrowLeft size={18} /></button></div>
      <header className="career-head">
        <div className="career-badge"><span>{service.label}</span></div>
        <h1>{profile.name}</h1>
        <p>{profile.height}cm · {profile.hand === 'R' ? '우투' : '좌투'} · {ARM_SLOTS[profile.armSlot].label} · 익스텐션 {extensionOf(profile).toFixed(2)}m · 릴리스 {releaseHeightOf(profile).toFixed(2)}m</p>
        <table className="info-table"><tbody>
          <tr><th>현재 리그</th><td>{tierOf(current.tier).label}</td></tr>
          <tr><th>데뷔</th><td>{debut ? `시즌 ${debut.number} · ${tierOf(debut.tier).label}` : '아마추어 (프로 데뷔 전)'}</td></tr>
          <tr><th>프로 연차</th><td>{service.proYears}년</td></tr>
          <tr><th>나이</th><td>{profile.age}세 · {ageStage(profile.age)}</td></tr>
        </tbody></table>
        <div className="career-actions">
          <button className="ghost-button" onClick={onEdit}><Pencil size={14} /> 프로필 수정</button>
          <button className="ghost-button" onClick={onLegacy}><Landmark size={14} /> 역대 선수{legacyCount ? ` ${legacyCount}` : ''}</button>
          {onRetire && <button className={confirmRetire ? 'ghost-button danger armed' : 'ghost-button danger'} onClick={() => confirmRetire ? onRetire() : setConfirmRetire(true)}><Flag size={14} /> {confirmRetire ? '한 번 더 누르면 은퇴' : '은퇴 선언'}</button>}
        </div>
        <p className="age-note">LV.{pitcherLevel(profile)} · {profile.age <= 24 ? '성장기: TP +20%' : profile.age <= 31 ? '전성기' : `에이징: 구속 −${ageEffects(profile.age).veloLoss.toFixed(1)}km/h · 체력 소모 +${Math.round((ageEffects(profile.age).staminaMul - 1) * 100)}%`} · 42세 강제 은퇴</p>
      </header>

      <h3 className="stat-heading">Awards · 수상 경력</h3>
      <TrophyCase seasons={seasons} />
      <details className="award-rules"><summary>{tierOf(current.tier).short} 리그 수상 기준</summary><ul>{AWARDS[current.tier].map(a => <li key={a.name}>{a.name}</li>)}</ul><p>시즌 종료 시 ERA·FIP·이닝·승·탈삼진으로 결정됩니다. 완투 경기의 퍼펙트게임·노히터·완봉승은 기록으로 남습니다.</p></details>
      <h3 className="stat-heading">Promotion</h3>
      <PromotionCard season={current} done={current.games >= current.scheduled} />
      <SeasonBook seasons={seasons} current={current} />
      <p className="stat-foot">ERA는 전 실점 기준(비자책 구분 없음). FIP = (13·HR + 3·(BB+HBP) − 2·SO) / IP + 3.10. SV = 9회를 1–3점 차 리드로 시작해 지켜낸 경기. 진행 중인 경기는 종료 후 반영됩니다.</p>
    </section>
  </div>
}
