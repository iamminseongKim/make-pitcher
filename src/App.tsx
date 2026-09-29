import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { Activity, ArrowLeft, ArrowRight, Check, ChevronRight, CircleHelp, Crosshair, Hand, LockKeyhole, RotateCcw, Settings2, Sparkles, Volume2, VolumeX, Zap } from 'lucide-react'
import {
  ARM_SLOTS, DIFFICULTIES, PITCHES, STARTER_LEVELS, breakScale, clamp, createFlight, createPreviewFlight, defaultProfile, defaultProgress, loadSave, masteryLevel,
  pitcherLevel, resolvePitch, statSpeed, sweetSpot, upgradeCost,
  type ArmSlot, type Difficulty, type GameProgress, type Hand as ThrowHand, type PitchFlight, type PitchOutcome, type PitcherProfile, type PitchType, type StatKey,
} from './game'
import { renderScene, STAGE } from './render'

type Panel = 'none' | 'training' | 'profile' | 'help'
const initial = loadSave()

const LABELS: Record<StatKey, { label: string; hint: string }> = {
  velocityLevel: { label: '구속', hint: '비행 시간 · 잔상' },
  controlLevel: { label: '제구', hint: '퍼펙트 폭 · 정확도' },
  breakLevel: { label: '무브먼트', hint: '변화량 · 헛스윙' },
}

function playSound(kind: 'release' | 'perfect' | 'catch' | 'hit', enabled: boolean, speed = 130) {
  if (!enabled) return
  try {
    const AudioCtx = window.AudioContext
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    const t = ctx.currentTime
    if (kind === 'release') {
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(250 + speed * 2, t); osc.frequency.exponentialRampToValueAtTime(100 + speed, t + .2)
      gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(.045, t + .025); gain.gain.exponentialRampToValueAtTime(.0001, t + .25)
      osc.start(t); osc.stop(t + .26)
    } else {
      osc.type = kind === 'hit' ? 'triangle' : 'square'
      osc.frequency.setValueAtTime(kind === 'perfect' ? 150 : kind === 'hit' ? 120 : 90, t)
      osc.frequency.exponentialRampToValueAtTime(48, t + .13)
      gain.gain.setValueAtTime(.12, t); gain.gain.exponentialRampToValueAtTime(.0001, t + .16)
      osc.start(t); osc.stop(t + .17)
    }
    window.setTimeout(() => { void ctx.close() }, 500)
  } catch { /* Audio is optional on unsupported browsers. */ }
}

function profileRank(level: number) {
  if (level >= 60) return 'LEGEND'
  if (level >= 30) return 'ALL-STAR'
  if (level >= 12) return 'PROSPECT'
  return 'ROOKIE'
}

function Creator({ initialProfile, onSave, editing, onClose }: { initialProfile: PitcherProfile; onSave: (p: PitcherProfile) => void; editing: boolean; onClose?: () => void }) {
  const [name, setName] = useState(initialProfile.name === 'ROOKIE' && !editing ? '' : initialProfile.name)
  const [height, setHeight] = useState(initialProfile.height)
  const [hand, setHand] = useState<ThrowHand>(initialProfile.hand)
  const [armSlot, setArmSlot] = useState<ArmSlot>(initialProfile.armSlot)
  const [difficulty, setDifficulty] = useState<Difficulty>(initialProfile.difficulty)
  const [starters, setStarters] = useState<PitchType[]>(['FOUR_SEAM'])
  const valid = name.trim().length >= 2 && (editing || starters.length >= 1)
  const toggleStarter = (id: PitchType) => setStarters(current => current.includes(id) ? current.length > 1 ? current.filter(p => p !== id) : current : current.length < 3 ? [...current, id] : current)
  const save = () => {
    if (!valid) return
    const level = STARTER_LEVELS[starters.length]
    const arsenal = editing ? initialProfile.arsenal : Object.fromEntries(PITCHES.map(p => [p.id, {
      ...initialProfile.arsenal[p.id], unlocked: starters.includes(p.id),
      velocityLevel: starters.includes(p.id) ? level : 1,
      controlLevel: starters.includes(p.id) ? level : 1,
      breakLevel: starters.includes(p.id) ? level : 1,
    }])) as PitcherProfile['arsenal']
    onSave({ ...initialProfile, name: name.trim().slice(0, 14), height, hand, armSlot, difficulty, arsenal, created: true })
  }
  return <div className="overlay creator-overlay">
    <section className="sheet creator-sheet" aria-label="투수 캐릭터 생성">
      <div className="sheet-top"><span className="eyebrow">PLAYER PROFILE / 01</span>{editing && <button className="icon-button" onClick={onClose} aria-label="닫기"><ArrowLeft size={18} /></button>}</div>
      <h1>{editing ? '투수 프로필' : <>너만의 에이스를<br /><em>만들어 봐.</em></>}</h1>
      <p className="creator-sub">마운드 위의 모든 공은 여기서 시작됩니다.</p>
      <div className="avatar-preview">
        <div className={`avatar-art ${hand === 'L' ? 'lefty' : ''} slot-${armSlot.toLowerCase()}`}>
          <div className="avatar-head" /><div className="avatar-body"><span>{name.trim().slice(0, 2).toUpperCase() || 'AP'}</span></div><div className="avatar-arm" /><div className="avatar-ball" /><div className="avatar-leg one" /><div className="avatar-leg two" />
        </div>
        <div className="preview-facts"><strong>{name.trim() || 'YOUR ACE'}</strong><span>{height} CM · {hand === 'R' ? '우투' : '좌투'} · {ARM_SLOTS[armSlot].label}</span></div>
        <span className="preview-no">#01</span>
      </div>
      <label className="form-label" htmlFor="pitcher-name">선수 이름 <span>2–14자</span></label>
      <input id="pitcher-name" className="name-input" maxLength={14} value={name} onChange={e => setName(e.target.value)} placeholder="이름을 입력하세요" autoComplete="off" />
      <div className="form-label row-label"><span>키</span><strong>{height} <small>CM</small></strong></div>
      <input className="height-range" type="range" min="160" max="210" step="1" value={height} onChange={e => setHeight(Number(e.target.value))} aria-label="키" />
      <div className="range-ends"><span>160 CM</span><span>210 CM</span></div>
      <div className="form-label">투구 손</div>
      <div className="choice-row"><button className={hand === 'R' ? 'choice active' : 'choice'} onClick={() => setHand('R')}><Hand size={16} /> 오른손</button><button className={hand === 'L' ? 'choice active' : 'choice'} onClick={() => setHand('L')}><Hand size={16} /> 왼손</button></div>
      <div className="form-label">팔각도 <span>릴리스 위치와 변화 방향에 반영</span></div>
      <div className="slot-grid">{(Object.keys(ARM_SLOTS) as ArmSlot[]).map(slot => <button className={armSlot === slot ? 'slot active' : 'slot'} key={slot} onClick={() => setArmSlot(slot)}><b>{ARM_SLOTS[slot].label}</b><span>{ARM_SLOTS[slot].angle}</span></button>)}</div>
      {!editing && <><div className="form-label">시작 구종 <span>1–3개 · 적게 고를수록 스탯 상승</span></div><div className="starter-grid">{PITCHES.map(p => <button key={p.id} className={starters.includes(p.id) ? 'starter active' : 'starter'} onClick={() => toggleStarter(p.id)} style={{ '--pitch-color': p.color } as CSSProperties}><i /><span>{p.short}</span>{starters.includes(p.id) && <Check size={13} />}</button>)}</div><div className="starter-bonus">선택 {starters.length}개 <span>시작 구종의 구속·제구·무브먼트 Lv.{levelForStarters(starters.length)}</span></div></>}
      <div className="form-label">타격 난이도 <span>높을수록 TP 보너스</span></div>
      <div className="difficulty-grid">{(Object.keys(DIFFICULTIES) as Difficulty[]).map(d => <button key={d} className={difficulty === d ? 'difficulty active' : 'difficulty'} onClick={() => setDifficulty(d)}><b>{DIFFICULTIES[d].label}</b><span>TP ×{DIFFICULTIES[d].tpMultiplier.toFixed(1)}</span></button>)}</div>
      <button className="primary-button creator-submit" disabled={!valid} onClick={save}>{editing ? '변경사항 저장' : '마운드에 오르기'} <ArrowRight size={19} /></button>
    </section>
  </div>
}

function levelForStarters(count: number) { return STARTER_LEVELS[clamp(count, 1, 3) as 1 | 2 | 3] }

function App() {
  const [profile, setProfile] = useState<PitcherProfile>(initial.profile)
  const [progress, setProgress] = useState<GameProgress>(initial.progress)
  const [selected, setSelected] = useState<PitchType>(PITCHES.find(p => initial.profile.arsenal[p.id].unlocked)?.id ?? 'FOUR_SEAM')
  const [target, setTarget] = useState({ x: 0, y: 0 })
  const [panel, setPanel] = useState<Panel>('none')
  const [trainingPitch, setTrainingPitch] = useState<PitchType>(PITCHES.find(p => initial.profile.arsenal[p.id].unlocked)?.id ?? 'FOUR_SEAM')
  const [phase, setPhase] = useState<'ready' | 'charging' | 'flying'>('ready')
  const [announcement, setAnnouncement] = useState('존을 터치해 코스를 선택하세요')
  const [gradeText, setGradeText] = useState('')
  const [soundOn, setSoundOn] = useState(true)
  const [showZone, setShowZone] = useState(true)
  const [pitchMenuOpen, setPitchMenuOpen] = useState(false)
  const [resetArmed, setResetArmed] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gaugeFillRef = useRef<HTMLDivElement>(null)
  const gaugeNeedleRef = useRef<HTMLDivElement>(null)
  const gaugeRef = useRef(0)
  const meterStartedAtRef = useRef<number | null>(null)
  const flightRef = useRef<PitchFlight | null>(null)
  const previousFlightRef = useRef<PitchFlight | null>(null)
  const pendingOutcomeRef = useRef<PitchOutcome | null>(null)
  const targetRef = useRef(target)
  const profileRef = useRef(profile)
  const previewRef = useRef<PitchFlight | null>(null)
  const resultRef = useRef({ text: '', at: 0 })
  const finishRef = useRef<(f: PitchFlight) => void>(() => {})
  const launchRef = useRef<(power: number) => void>(() => {})
  const lastTapRef = useRef(0)

  targetRef.current = target
  profileRef.current = profile
  previewRef.current = profile.created && profile.arsenal[selected].unlocked ? createPreviewFlight(PITCHES.find(p => p.id === selected)!, profile.arsenal[selected], profile, target) : null
  useEffect(() => { localStorage.setItem('ace-project-save-v1', JSON.stringify({ profile, progress })) }, [profile, progress])

  function finishPitch(f: PitchFlight) {
    const outcome = pendingOutcomeRef.current ?? resolvePitch(f, progress.inning, profile.difficulty)
    pendingOutcomeRef.current = null
    let next = { ...progress, pitches: progress.pitches + 1 }
    let message = '', reward = 0, mastery = 5
    if (outcome === 'BALL') { next.balls++; message = 'BALL' }
    else if (outcome === 'CALLED_STRIKE') { next.strikes++; message = '루킹 스트라이크'; reward = 2; mastery = 8 }
    else if (outcome === 'SWINGING_STRIKE') { next.strikes++; message = '헛스윙!'; reward = 3; mastery = 10 }
    else if (outcome === 'FOUL') { next.strikes = Math.min(2, next.strikes + 1); message = '파울'; reward = 1 }
    else if (outcome === 'HIT') { next.hits++; next.streak = 0; next.balls = 0; next.strikes = 0; message = '안타 허용'; mastery = 2 }
    else { next.outs++; next.streak++; next.bestStreak = Math.max(next.bestStreak, next.streak); next.balls = 0; next.strikes = 0; reward = 12; mastery = 13; message = outcome === 'GROUND_OUT' ? '땅볼 아웃' : '뜬공 아웃' }
    if (next.strikes >= 3) {
      next.strikeouts++; next.outs++; next.streak++; next.bestStreak = Math.max(next.bestStreak, next.streak)
      next.balls = 0; next.strikes = 0; reward += 22; mastery += 15; message = outcome === 'CALLED_STRIKE' ? '루킹 삼진!' : '삼진!'
    }
    if (next.balls >= 4) { next.walks++; next.streak = 0; next.balls = 0; next.strikes = 0; message = '볼넷 허용' }
    const inningOver = next.outs >= 3
    if (inningOver) { next.inning++; next.outs = 0; next.balls = 0; next.strikes = 0; reward += 40; message += ' · 이닝 종료' }
    reward = Math.round(reward * DIFFICULTIES[profile.difficulty].tpMultiplier)
    setProgress(next)
    setProfile(prev => ({
      ...prev, trainingPoints: prev.trainingPoints + reward,
      stamina: inningOver ? Math.min(100, prev.stamina + 42) : Math.max(0, prev.stamina - 5),
      arsenal: { ...prev.arsenal, [f.pitch.id]: { ...prev.arsenal[f.pitch.id], mastery: prev.arsenal[f.pitch.id].mastery + mastery } },
    }))
    const note = `${message}${reward ? `  +${reward} TP` : ''}`
    setAnnouncement(note); resultRef.current = { text: message, at: performance.now() }
    playSound(outcome === 'HIT' ? 'hit' : f.grade === 'PERFECT' ? 'perfect' : 'catch', soundOn, f.speed)
    if (f.grade === 'PERFECT') navigator.vibrate?.([15, 30, 20])
    else if (f.speed >= 160) navigator.vibrate?.(60)
    previousFlightRef.current = f
    flightRef.current = null; setPhase('ready')
  }
  finishRef.current = finishPitch

  useEffect(() => {
    let raf = 0
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const scale = Math.min(window.devicePixelRatio || 1, 2)
    canvasRef.current!.width = STAGE.width * scale
    canvasRef.current!.height = STAGE.height * scale
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    const tick = (now: number) => {
      const started = meterStartedAtRef.current
      const power = started === null ? 0 : clamp((now - started) / 1700, 0, 1)
      gaugeRef.current = power
      if (gaugeFillRef.current) gaugeFillRef.current.style.width = `${power * 100}%`
      if (gaugeNeedleRef.current) gaugeNeedleRef.current.style.left = `${power * 100}%`
      if (started !== null && power >= 1) launchRef.current(1)
      const f = flightRef.current
      const t = f ? clamp((now - f.startedAt) / f.duration, 0, 1) : 0
      ctx.save()
      if (f && t >= .96 && f.speed >= 160) ctx.translate(Math.sin(now * .17) * 3, Math.cos(now * .21) * 3)
      renderScene(ctx, { profile: profileRef.current, target: targetRef.current, flight: f, previousFlight: previousFlightRef.current, previewFlight: previewRef.current, flightProgress: t, showZone, result: resultRef.current.text, resultAt: resultRef.current.at, now, batterSwings: pendingOutcomeRef.current !== null && !['BALL', 'CALLED_STRIKE'].includes(pendingOutcomeRef.current) })
      ctx.restore()
      if (f && t >= 1) finishRef.current(f)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [showZone])

  const pitch = PITCHES.find(p => p.id === selected)!
  const stat = profile.arsenal[selected]
  const gaugeWidth = sweetSpot(stat.controlLevel) * 100
  const movementCm = Math.round(Math.hypot(pitch.moveX, pitch.moveY) * breakScale(stat.breakLevel))
  const canPitch = profile.created && phase !== 'flying' && panel === 'none' && stat.unlocked
  const launch = (power: number) => {
    if (meterStartedAtRef.current === null || flightRef.current) return
    meterStartedAtRef.current = null
    const f = createFlight(pitch, stat, profile, target, power)
    pendingOutcomeRef.current = resolvePitch(f, progress.inning, profile.difficulty)
    previousFlightRef.current = null
    flightRef.current = f
    setGradeText(f.grade)
    setPhase('flying')
    setAnnouncement(`${pitch.short} · ${f.speed.toFixed(1)} KM/H · 파워 ${Math.round(power * 100)}%`)
    playSound('release', soundOn, f.speed)
  }
  launchRef.current = launch
  const tapMeter = () => {
    if (!canPitch) return
    const now = performance.now()
    if (now - lastTapRef.current < 180) return
    lastTapRef.current = now
    if (meterStartedAtRef.current === null) {
      setPitchMenuOpen(false)
      meterStartedAtRef.current = now
      setPhase('charging')
      setAnnouncement('파워 미터가 올라갑니다 · 밝은 구간에서 다시 누르세요')
    } else launch(gaugeRef.current)
  }
  const aim = (event: PointerEvent<HTMLCanvasElement>) => {
    if (phase !== 'ready' || panel !== 'none') return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width * STAGE.width
    const y = (event.clientY - rect.top) / rect.height * STAGE.height
    setTarget({ x: clamp((x - STAGE.zoneX) / (STAGE.zoneW / 2), -1.45, 1.45), y: clamp((y - STAGE.zoneY) / (STAGE.zoneH / 2), -1.45, 1.45) })
    setAnnouncement('코스 선택 완료 · 미터를 시작하세요')
  }
  const upgrade = (key: StatKey) => {
    const level = profile.arsenal[trainingPitch][key]
    const cost = upgradeCost(level)
    if (level >= 99 || profile.trainingPoints < cost) return
    setProfile(prev => ({ ...prev, trainingPoints: prev.trainingPoints - cost, arsenal: { ...prev.arsenal, [trainingPitch]: { ...prev.arsenal[trainingPitch], [key]: level + 1 } } }))
    playSound('perfect', soundOn)
  }
  const unlock = () => {
    const def = PITCHES.find(p => p.id === trainingPitch)!
    if (profile.trainingPoints < def.unlockCost) return
    setProfile(prev => ({ ...prev, trainingPoints: prev.trainingPoints - def.unlockCost, arsenal: { ...prev.arsenal, [trainingPitch]: { ...prev.arsenal[trainingPitch], unlocked: true } } }))
    setSelected(trainingPitch)
    playSound('perfect', soundOn)
  }

  return <div className="app-shell">
    <div className="top-line" />
    <main className="game-shell">
      <header className="app-header">
        <div className="brand"><div className="brand-mark">A<span>★</span></div><div><strong>ACE PROJECT</strong><small>ROAD TO THE SHOW</small></div></div>
        <div className="header-actions"><button className="icon-button" onClick={() => { meterStartedAtRef.current = null; setPhase('ready'); setTrainingPitch(selected); setPitchMenuOpen(false); setPanel('training') }} aria-label="투수 훈련실"><Activity size={18} /></button><button className="icon-button" onClick={() => setSoundOn(!soundOn)} aria-label={soundOn ? '소리 끄기' : '소리 켜기'}>{soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}</button><button className="icon-button" onClick={() => { meterStartedAtRef.current = null; setPhase('ready'); setPitchMenuOpen(false); setPanel('help') }} aria-label="게임 방법"><CircleHelp size={19} /></button></div>
      </header>

      <section className="player-card" onClick={() => { meterStartedAtRef.current = null; setPhase('ready'); setPanel('profile') }} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') { meterStartedAtRef.current = null; setPhase('ready'); setPanel('profile') } }} aria-label="투수 프로필 수정">
        <div className="player-badge">{profile.name.slice(0, 1).toUpperCase()}</div>
        <div className="player-details"><div className="player-name"><strong>{profile.created ? profile.name : 'YOUR ACE'}</strong><span>LV.{pitcherLevel(profile)} {profileRank(pitcherLevel(profile))}</span></div><div className="stamina-label"><span>STAMINA</span><b>{profile.stamina}/100</b></div><div className="stamina-track"><span style={{ width: `${profile.stamina}%` }} /></div></div>
        <ChevronRight size={17} className="muted" />
      </section>

      <div className="score-strip">
        <div className="inning"><span>INNING · {DIFFICULTIES[profile.difficulty].label}</span><b>{progress.inning}<small>회</small></b></div>
        <div className="count-wrap"><div className="count-row"><span>B</span>{[0, 1, 2].map(i => <i className={i < progress.balls ? 'ball on' : 'ball'} key={i} />)}</div><div className="count-row"><span>S</span>{[0, 1].map(i => <i className={i < progress.strikes ? 'strike on' : 'strike'} key={i} />)}</div><div className="count-row"><span>O</span>{[0, 1].map(i => <i className={i < progress.outs ? 'out on' : 'out'} key={i} />)}</div></div>
        <div className="tp-pill"><Zap size={15} fill="currentColor" /><strong>{profile.trainingPoints.toLocaleString()}</strong><span>TP</span></div>
      </div>

      <section className="stadium-card">
        <div className="stadium-head"><span><i className="live-dot" /> LIVE AT BAT</span><span className="stage-coordinate">K {progress.strikeouts} · P {progress.pitches}</span></div>
        <canvas ref={canvasRef} className="stadium-canvas" onPointerDown={aim} aria-label="스트라이크 존. 터치하여 투구 위치를 선택하세요." />
        <div className={`field-pitch-picker ${profile.hand === 'L' ? 'left' : 'right'}`}>
          <button className="field-pitch-toggle" disabled={phase !== 'ready' || !profile.created} onClick={() => setPitchMenuOpen(!pitchMenuOpen)} aria-label={`구종 선택: ${pitch.short}`} aria-expanded={pitchMenuOpen} style={{ '--pitch-color': pitch.color } as CSSProperties}><i /><span>{pitch.short}</span><ChevronRight size={13} /></button>
          {pitchMenuOpen && <div className="field-pitch-options">{PITCHES.filter(p => profile.arsenal[p.id].unlocked).map(p => <button key={p.id} className={selected === p.id ? 'active' : ''} onClick={() => { setSelected(p.id); setPitchMenuOpen(false) }}><i style={{ background: p.color }} /><span>{p.short}</span><small>{statSpeed(p, profile.arsenal[p.id])}</small></button>)}</div>}
        </div>
        <div className="stage-bottom"><span>● {pitch.family} · BREAK {movementCm}CM</span><span>{profile.hand === 'R' ? 'RHP' : 'LHP'} · {ARM_SLOTS[profile.armSlot].label.toUpperCase()}</span></div>
      </section>

      <div className="callout"><span className={gradeText === 'PERFECT' && phase === 'flying' ? 'grade perfect' : 'grade'}>{phase === 'flying' ? gradeText : phase === 'charging' ? 'POWER' : 'READY'}</span><span className="callout-text">{announcement}</span></div>

      <section className="release-card"><div className="release-title"><span>POWER METER</span><strong>정확한 파워 구간 <em>{gaugeWidth.toFixed(1)}%</em></strong></div><div className="gauge"><div className="gauge-sweet" style={{ width: `${gaugeWidth}%`, left: `${82 - gaugeWidth / 2}%` }} /><div ref={gaugeFillRef} className="gauge-fill" /><div ref={gaugeNeedleRef} className="gauge-needle" /></div><div className="release-labels"><span>컨트롤</span><span>최적 파워</span><span>강속구 · 실투 위험</span></div><button className="pitch-button" onClick={e => { e.currentTarget.blur(); tapMeter() }} disabled={!canPitch}><span className="button-ball">⚾</span><span>{phase === 'flying' ? '투구 중...' : phase === 'charging' ? '파워 결정!' : '미터 시작'}</span><ArrowRight size={20} /></button></section>

    </main>

    {!profile.created && <Creator initialProfile={profile} onSave={p => { setProfile(p); const first = PITCHES.find(def => p.arsenal[def.id].unlocked)!.id; setSelected(first); setTrainingPitch(first) }} editing={false} />}
    {panel === 'profile' && profile.created && <Creator initialProfile={profile} onSave={p => { setProfile(p); setPanel('none') }} editing onClose={() => setPanel('none')} />}
    {panel === 'training' && <div className="overlay" onPointerDown={e => { if (e.target === e.currentTarget) setPanel('none') }}><section className="sheet training-sheet"><div className="sheet-top"><span className="eyebrow">PITCH LAB / TRAINING</span><button className="icon-button" onClick={() => setPanel('none')} aria-label="닫기"><ArrowLeft size={18} /></button></div><div className="sheet-title"><div><h1>투수 훈련실</h1><p>한 포인트가 다음 투구를 바꿉니다.</p></div><div className="tp-large"><Zap size={16} fill="currentColor" /> {profile.trainingPoints} <small>TP</small></div></div><div className="training-tabs">{PITCHES.map(p => <button key={p.id} className={trainingPitch === p.id ? 'active' : ''} onClick={() => setTrainingPitch(p.id)}>{p.short}{!profile.arsenal[p.id].unlocked && <LockKeyhole size={10} />}</button>)}</div>{(() => { const p = PITCHES.find(x => x.id === trainingPitch)!; const s = profile.arsenal[trainingPitch]; return <><div className="training-feature" style={{ '--pitch-color': p.color } as CSSProperties}><span className="feature-orb">⚾</span><div><small>{p.family} / {s.unlocked ? `MASTER Lv.${masteryLevel(s.mastery)}` : 'LOCKED'}</small><h2>{p.name}</h2><p>{p.description}</p></div><b>{s.unlocked ? statSpeed(p, s) : '–––'} <small>KM/H</small></b></div>{s.unlocked ? <div className="upgrade-list">{(['velocityLevel', 'controlLevel', 'breakLevel'] as StatKey[]).map(key => { const level = s[key], cost = upgradeCost(level), isMax = level >= 99; return <div className="upgrade-row" key={key}><div className="upgrade-icon">{key === 'velocityLevel' ? <Zap size={18} /> : key === 'controlLevel' ? <Crosshair size={18} /> : <Sparkles size={18} />}</div><div className="upgrade-info"><div><strong>{LABELS[key].label}</strong><span>LV.{level} / 99</span></div><small>{LABELS[key].hint}</small><div className="upgrade-track"><span style={{ width: `${level}%` }} /></div></div><button onClick={() => upgrade(key)} disabled={isMax || profile.trainingPoints < cost}>{isMax ? 'MAX' : <>{cost} <Zap size={12} fill="currentColor" /></>}</button></div> })}</div> : <div className="unlock-area"><LockKeyhole size={22} /><p>새 구종을 연마하고 레퍼토리를 넓히세요.</p><button className="primary-button" disabled={profile.trainingPoints < p.unlockCost} onClick={unlock}>{p.unlockCost} TP로 해금 <ArrowRight size={17} /></button></div>}</> })()}<div className="training-foot"><span>훈련 포인트는 아웃과 삼진, 이닝 종료로 획득합니다.</span></div></section></div>}
    {panel === 'help' && <div className="overlay" onPointerDown={e => { if (e.target === e.currentTarget) setPanel('none') }}><section className="sheet help-sheet"><div className="sheet-top"><span className="eyebrow">HOW TO PLAY</span><button className="icon-button" onClick={() => setPanel('none')} aria-label="닫기"><ArrowLeft size={18} /></button></div><h1>에이스가 되는 법</h1><div className="help-step"><b>01</b><div><strong>코스를 고르세요</strong><p>스트라이크 존을 터치하면 조준점이 이동합니다. 존 밖으로 유인구도 던질 수 있습니다.</p></div></div><div className="help-step"><b>02</b><div><strong>타이밍을 맞추세요</strong><p>구종과 제구 위치를 고른 뒤 미터를 시작하세요. 밝은 파워 구간에서 다시 누르면 공이 출발합니다. 제구가 높을수록 예상 범위가 좁아집니다.</p></div></div><div className="help-step"><b>03</b><div><strong>훈련하고 성장하세요</strong><p>삼진과 아웃으로 TP를 벌어 구속·제구·무브먼트를 강화하고 새 구종을 해금하세요.</p></div></div><div className="help-options"><button onClick={() => setShowZone(!showZone)}><Settings2 size={16} /> 스트라이크 존 {showZone ? '표시' : '숨김'} <span>{showZone ? 'ON' : 'OFF'}</span></button><button onClick={() => { setProfile(prev => ({ ...prev, stamina: 100 })); setAnnouncement('휴식 완료 · 스태미나 회복'); setPanel('none') }}><RotateCcw size={16} /> 휴식하고 체력 회복 <span>FREE</span></button><button className={resetArmed ? 'reset-confirm' : ''} onClick={() => { if (resetArmed) { flightRef.current = null; previousFlightRef.current = null; meterStartedAtRef.current = null; pendingOutcomeRef.current = null; setPhase('ready'); setProfile(defaultProfile()); setProgress(defaultProgress()); setSelected('FOUR_SEAM'); setTarget({ x: 0, y: 0 }); setAnnouncement('존을 터치해 코스를 선택하세요'); setResetArmed(false); setPanel('none') } else setResetArmed(true) }}><RotateCcw size={16} /> {resetArmed ? '한 번 더 누르면 기록이 삭제됩니다' : '새 선수로 시작'} <span>{resetArmed ? '확인' : 'RESET'}</span></button></div><button className="primary-button" onClick={() => { setResetArmed(false); setPanel('none') }}>마운드로 돌아가기 <Check size={18} /></button></section></div>}
  </div>
}

export default App
