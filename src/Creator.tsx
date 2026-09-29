import { useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowRight, Check, Hand } from 'lucide-react'
import { ARM_SLOTS, PITCHES, STARTER_LEVELS, clamp, createPreviewFlight, extensionOf, planeSteepness, releaseHeightOf, type ArmSlot, type Hand as ThrowHand, type PitcherProfile, type PitchType } from './game'
import { TIERS } from './season'

export function Creator({ initialProfile, onSave, editing, onClose }: { initialProfile: PitcherProfile; onSave: (p: PitcherProfile) => void; editing: boolean; onClose?: () => void }) {
  const [name, setName] = useState(initialProfile.name === 'ROOKIE' && !editing ? '' : initialProfile.name)
  const [height, setHeight] = useState(initialProfile.height)
  const [hand, setHand] = useState<ThrowHand>(initialProfile.hand)
  const [armSlot, setArmSlot] = useState<ArmSlot>(initialProfile.armSlot)
  const [starters, setStarters] = useState<PitchType[]>(['FOUR_SEAM'])
  const valid = name.trim().length >= 2 && (editing || starters.length >= 1)
  const toggleStarter = (id: PitchType) => setStarters(cur => cur.includes(id) ? cur.length > 1 ? cur.filter(p => p !== id) : cur : cur.length < 3 ? [...cur, id] : cur)
  const save = () => {
    if (!valid) return
    const level = STARTER_LEVELS[starters.length]
    const arsenal = editing ? initialProfile.arsenal : Object.fromEntries(PITCHES.map(p => [p.id, {
      ...initialProfile.arsenal[p.id], unlocked: starters.includes(p.id),
      velocityLevel: starters.includes(p.id) ? level : 1, controlLevel: starters.includes(p.id) ? level : 1, breakLevel: starters.includes(p.id) ? level : 1,
    }])) as PitcherProfile['arsenal']
    onSave({ ...initialProfile, name: name.trim().slice(0, 14), height, hand, armSlot, arsenal, created: true })
  }
  // Live physical readout: what this frame does to a four-seamer.
  const body = { height, armSlot }
  const ext = extensionOf(body), rel = releaseHeightOf(body)
  const fs = createPreviewFlight(PITCHES[0], { unlocked: true, velocityLevel: 30, controlLevel: 30, breakLevel: 50, mastery: 0 }, { ...initialProfile, height, armSlot, hand }, { x: 0, y: -.8 })
  const plane = Math.round(planeSteepness(rel) * 100)
  return <div className="overlay creator-overlay">
    <section className="sheet creator-sheet" aria-label="투수 만들기">
      <div className="sheet-top"><span className="eyebrow">{editing ? 'PROFILE' : 'DRAFT DAY'}</span>{editing && <button className="icon-button" onClick={onClose} aria-label="닫기"><ArrowLeft size={18} /></button>}</div>
      <h1>{editing ? '투수 프로필' : <>드래프트 1순위,<br /><em>당신의 에이스.</em></>}</h1>
      <div className="avatar-preview">
        <div className={`avatar-art ${hand === 'L' ? 'lefty' : ''} slot-${armSlot.toLowerCase()}`}>
          <div className="avatar-head" /><div className="avatar-body"><span>{name.trim().slice(0, 2).toUpperCase() || 'AP'}</span></div><div className="avatar-arm" /><div className="avatar-ball" /><div className="avatar-leg one" /><div className="avatar-leg two" />
        </div>
        <div className="preview-facts"><strong>{name.trim() || 'YOUR ACE'}</strong><span>{height}cm · {hand === 'R' ? '우투' : '좌투'} · {ARM_SLOTS[armSlot].label}</span></div>
        <span className="preview-no">#01</span>
      </div>
      <div className="physique" aria-label="신체 조건이 만드는 구위">
        <div><small>익스텐션</small><b>{ext.toFixed(2)}<i>m</i></b></div>
        <div><small>릴리스 높이</small><b>{rel.toFixed(2)}<i>m</i></b></div>
        <div><small>포심 IVB</small><b>{fs.ivb > 0 ? '+' : ''}{fs.ivb}<i>cm</i></b></div>
        <div><small>하이존 VAA</small><b>{fs.vaa.toFixed(1)}<i>°</i></b></div>
        <div className="plane"><small>다운힐 플레인</small><span><i style={{ width: `${plane}%` }} /></span></div>
      </div>
      <label className="form-label" htmlFor="pitcher-name">이름</label>
      <input id="pitcher-name" className="name-input" maxLength={14} value={name} onChange={e => setName(e.target.value)} placeholder="등판할 이름" autoComplete="off" />
      <div className="form-label row-label"><span>키 <small>클수록 익스텐션·릴리스 높이↑</small></span><strong>{height} <small>CM</small></strong></div>
      <input className="height-range" type="range" min="160" max="210" step="1" value={height} onChange={e => setHeight(Number(e.target.value))} aria-label="키" />
      <div className="form-label">던지는 손</div>
      <div className="choice-row"><button className={hand === 'R' ? 'choice active' : 'choice'} onClick={() => setHand('R')}><Hand size={16} /> 우투</button><button className={hand === 'L' ? 'choice active' : 'choice'} onClick={() => setHand('L')}><Hand size={16} /> 좌투</button></div>
      <div className="form-label">팔 각도 <span>오버핸드 = 라이징 · 낮을수록 옆으로 휜다</span></div>
      <div className="slot-grid">{(Object.keys(ARM_SLOTS) as ArmSlot[]).map(slot => <button className={armSlot === slot ? 'slot active' : 'slot'} key={slot} onClick={() => setArmSlot(slot)}><b>{ARM_SLOTS[slot].label}</b><span>{ARM_SLOTS[slot].angle}</span></button>)}</div>
      {!editing && <><div className="form-label">주무기 <span>적게 고를수록 강하게 시작</span></div><div className="starter-grid">{PITCHES.map(p => <button key={p.id} className={starters.includes(p.id) ? 'starter active' : 'starter'} onClick={() => toggleStarter(p.id)} style={{ '--pitch-color': p.color } as CSSProperties}><i /><span>{p.short}</span>{starters.includes(p.id) && <Check size={13} />}</button>)}</div><div className="starter-bonus">{starters.length}개 선택 <span>시작 Lv.{STARTER_LEVELS[clamp(starters.length, 1, 3) as 1 | 2 | 3]}</span></div>
        <div className="ladder" aria-label="리그 단계"><small>커리어 사다리 · 리그가 곧 난이도</small><ol>{TIERS.map((t, i) => <li key={t.id} className={i === 0 ? 'on' : ''}><b>{t.short}</b><span>{t.kr}</span></li>)}</ol></div></>}
      <button className="primary-button creator-submit" disabled={!valid} onClick={save}>{editing ? '저장' : '마운드로'} <ArrowRight size={19} /></button>
    </section>
  </div>
}
