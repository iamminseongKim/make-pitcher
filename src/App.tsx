import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { Activity, ArrowLeft, ArrowRight, Check, CircleHelp, Crosshair, Flame, Hand, LockKeyhole, RotateCcw, Settings2, Sparkles, Volume2, VolumeX, Zap } from 'lucide-react'
import {
  ARM_SLOTS, DIFFICULTIES, LEAGUE_TIERS, PITCHES, SAVE_KEY, STARTER_LEVELS, TEAMS, WEAK_LABEL, ZONE_LABEL,
  applyOutcome, batterMindset, batterSide, breakScale, clamp, closeInning, createFlight, createPreviewFlight, defaultCareer, defaultProfile,
  leagueTier, loadSave, masteryLevel, newGame, pitchById, pitcherLevel, resolvePitch, statSpeed, sweetSpot, tunnelScore, upgradeCost, zoneHeat,
  type ArmSlot, type Call, type CareerStats, type Difficulty, type GameState, type Hand as ThrowHand, type InningSummary, type PitchFlight,
  type PitchLog, type PitchResult, type PitcherProfile, type PitchType, type StatKey,
} from './game'
import { renderScene, STAGE, type BatterAnim, type BattedBall } from './render'

type Panel = 'none' | 'training' | 'profile' | 'help'
type Phase = 'ready' | 'charging' | 'flying' | 'result'
const initial = loadSave()

const LABELS: Record<StatKey, { label: string; hint: string }> = {
  velocityLevel: { label: '구속', hint: '빠를수록 타자가 늦는다' },
  controlLevel: { label: '제구', hint: '원하는 곳에 꽂힌다' },
  breakLevel: { label: '무브먼트', hint: '더 늦게, 더 크게 꺾인다' },
}

/* ───────────── Sound ───────────── */
let audio: AudioContext | null = null
function tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0) {
  audio ??= new AudioContext()
  const t = audio.currentTime + delay
  const osc = audio.createOscillator(), gain = audio.createGain()
  osc.type = type; osc.frequency.setValueAtTime(freq, t)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(vol, t + .01); gain.gain.exponentialRampToValueAtTime(.0001, t + dur)
  osc.connect(gain); gain.connect(audio.destination); osc.start(t); osc.stop(t + dur + .02)
}
function noise(dur: number, vol: number, delay = 0) {
  audio ??= new AudioContext()
  const t = audio.currentTime + delay
  const buf = audio.createBuffer(1, Math.floor(audio.sampleRate * dur), audio.sampleRate)
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
  const src = audio.createBufferSource(), gain = audio.createGain(), filter = audio.createBiquadFilter()
  filter.type = 'bandpass'; filter.frequency.value = 900; src.buffer = buf
  gain.gain.value = vol; src.connect(filter); filter.connect(gain); gain.connect(audio.destination); src.start(t)
}
type Sfx = 'release' | 'mitt' | 'pop' | 'bat' | 'crack' | 'whiff' | 'cheer' | 'ui' | 'k'
function sfx(kind: Sfx, on: boolean, speed = 140) {
  if (!on) return
  try {
    if (kind === 'release') tone(220 + speed * 2, .22, 'sawtooth', .025, 100 + speed)
    if (kind === 'mitt') { tone(95, .09, 'square', .1, 45); noise(.05, .25) }
    if (kind === 'pop') { tone(150, .07, 'square', .14, 50); noise(.06, .45) }
    if (kind === 'whiff') noise(.18, .12)
    if (kind === 'bat') { tone(420, .06, 'triangle', .12, 180); noise(.05, .3) }
    if (kind === 'crack') { tone(900, .05, 'square', .12, 300); noise(.09, .7) }
    if (kind === 'cheer') { for (let i = 0; i < 6; i++) noise(.5, .06, i * .08) }
    if (kind === 'k') { tone(660, .09, 'triangle', .07); tone(880, .12, 'triangle', .07, undefined, .09) }
    if (kind === 'ui') tone(540, .05, 'triangle', .05)
  } catch { /* Audio is optional. */ }
}

function Creator({ initialProfile, onSave, editing, onClose }: { initialProfile: PitcherProfile; onSave: (p: PitcherProfile) => void; editing: boolean; onClose?: () => void }) {
  const [name, setName] = useState(initialProfile.name === 'ROOKIE' && !editing ? '' : initialProfile.name)
  const [height, setHeight] = useState(initialProfile.height)
  const [hand, setHand] = useState<ThrowHand>(initialProfile.hand)
  const [armSlot, setArmSlot] = useState<ArmSlot>(initialProfile.armSlot)
  const [difficulty, setDifficulty] = useState<Difficulty>(initialProfile.difficulty)
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
    onSave({ ...initialProfile, name: name.trim().slice(0, 14), height, hand, armSlot, difficulty, arsenal, created: true })
  }
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
      <label className="form-label" htmlFor="pitcher-name">이름</label>
      <input id="pitcher-name" className="name-input" maxLength={14} value={name} onChange={e => setName(e.target.value)} placeholder="등판할 이름" autoComplete="off" />
      <div className="form-label row-label"><span>키</span><strong>{height} <small>CM</small></strong></div>
      <input className="height-range" type="range" min="160" max="210" step="1" value={height} onChange={e => setHeight(Number(e.target.value))} aria-label="키" />
      <div className="form-label">던지는 손</div>
      <div className="choice-row"><button className={hand === 'R' ? 'choice active' : 'choice'} onClick={() => setHand('R')}><Hand size={16} /> 우투</button><button className={hand === 'L' ? 'choice active' : 'choice'} onClick={() => setHand('L')}><Hand size={16} /> 좌투</button></div>
      <div className="form-label">팔 각도 <span>낮을수록 옆으로 휜다</span></div>
      <div className="slot-grid">{(Object.keys(ARM_SLOTS) as ArmSlot[]).map(slot => <button className={armSlot === slot ? 'slot active' : 'slot'} key={slot} onClick={() => setArmSlot(slot)}><b>{ARM_SLOTS[slot].label}</b><span>{ARM_SLOTS[slot].angle}</span></button>)}</div>
      {!editing && <><div className="form-label">주무기 <span>적게 고를수록 강하게 시작</span></div><div className="starter-grid">{PITCHES.map(p => <button key={p.id} className={starters.includes(p.id) ? 'starter active' : 'starter'} onClick={() => toggleStarter(p.id)} style={{ '--pitch-color': p.color } as CSSProperties}><i /><span>{p.short}</span>{starters.includes(p.id) && <Check size={13} />}</button>)}</div><div className="starter-bonus">{starters.length}개 선택 <span>시작 Lv.{STARTER_LEVELS[clamp(starters.length, 1, 3) as 1 | 2 | 3]}</span></div></>}
      <div className="form-label">난이도</div>
      <div className="difficulty-grid">{(Object.keys(DIFFICULTIES) as Difficulty[]).map(d => <button key={d} className={difficulty === d ? 'difficulty active' : 'difficulty'} onClick={() => setDifficulty(d)}><b>{DIFFICULTIES[d].label}</b><span>TP ×{DIFFICULTIES[d].tpMultiplier.toFixed(1)}</span></button>)}</div>
      <button className="primary-button creator-submit" disabled={!valid} onClick={save}>{editing ? '저장' : '마운드로'} <ArrowRight size={19} /></button>
    </section>
  </div>
}

function Bases({ bases }: { bases: [boolean, boolean, boolean] }) {
  return <div className="bases" aria-label="주자 상황">
    <i className={bases[1] ? 'on' : ''} style={{ left: 11, top: 0 }} />
    <i className={bases[2] ? 'on' : ''} style={{ left: 0, top: 11 }} />
    <i className={bases[0] ? 'on' : ''} style={{ left: 22, top: 11 }} />
  </div>
}

function App() {
  const [profile, setProfile] = useState<PitcherProfile>(initial.profile)
  const [game, setGame] = useState<GameState>(initial.game)
  const [career, setCareer] = useState<CareerStats>(initial.career)
  const [selected, setSelected] = useState<PitchType>(PITCHES.find(p => initial.profile.arsenal[p.id].unlocked)?.id ?? 'FOUR_SEAM')
  const [target, setTarget] = useState({ x: .45, y: .45 })
  const [panel, setPanel] = useState<Panel>('none')
  const [trainingPitch, setTrainingPitch] = useState<PitchType>(selected)
  const [phase, setPhase] = useState<Phase>('ready')
  const [callout, setCallout] = useState<{ main: string; sub: string; tone: string }>({ main: 'PLAY BALL', sub: '코스를 찍고 투구', tone: 'ready' })
  const [soundOn, setSoundOn] = useState(true)
  const [showZone, setShowZone] = useState(true)
  const [scout, setScout] = useState(false)
  const [resetArmed, setResetArmed] = useState(false)
  const [summary, setSummary] = useState<InningSummary | null>(null)
  const [tpPop, setTpPop] = useState<{ n: number; key: number } | null>(null)
  const [shake, setShake] = useState(0)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gaugeFillRef = useRef<HTMLDivElement>(null)
  const gaugeNeedleRef = useRef<HTMLDivElement>(null)
  const gaugeRef = useRef(0)
  const meterStartedAtRef = useRef<number | null>(null)
  const flightRef = useRef<PitchFlight | null>(null)
  const lastFlightRef = useRef<PitchFlight | null>(null) // previous pitch in this at-bat (tunnel reference)
  const pendingRef = useRef<PitchResult | null>(null)
  const animRef = useRef<BatterAnim>({ kind: 'idle', at: 0, contact: false, barrel: { x: 0, y: 0 } })
  const battedRef = useRef<BattedBall | null>(null)
  const resultRef = useRef({ text: '', tone: '', at: 0 })
  const logOverrideRef = useRef<PitchLog[] | null>(null)
  const seenRef = useRef<{ speeds: number[]; types: PitchType[] }>({ speeds: [], types: [] })
  const sceneRef = useRef<Parameters<typeof renderScene>[1] | null>(null)
  const finishRef = useRef<(f: PitchFlight) => void>(() => {})
  const launchRef = useRef<(power: number) => void>(() => {})
  const lastTapRef = useRef(0)

  const pitch = pitchById(selected)
  const stat = profile.arsenal[selected]
  const batter = game.lineup[game.batterIndex]
  const side = batterSide(batter, profile.hand)
  const team = TEAMS[game.opponent]
  const tier = leagueTier(career.wins)
  const preview = profile.created && stat.unlocked ? createPreviewFlight(pitch, stat, profile, target) : null
  const tunnel = preview ? tunnelScore(preview, lastFlightRef.current) : 0
  const fastest = Math.max(...PITCHES.filter(p => profile.arsenal[p.id].unlocked && p.family === 'FASTBALL').map(p => statSpeed(p, profile.arsenal[p.id])), 125)

  sceneRef.current = {
    profile, batterSide: side, teamColor: team.color, target, flight: null, previousFlight: lastFlightRef.current, previewFlight: preview,
    tunnel, flightProgress: 0, showZone, heat: scout ? zoneHeat(batter, side) : null, log: logOverrideRef.current ?? game.abLog,
    anim: animRef.current, batted: battedRef.current, result: resultRef.current, now: 0,
  }

  useEffect(() => { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ profile, game, career })) } catch { /* storage optional */ } }, [profile, game, career])

  function finishPitch(f: PitchFlight) {
    const r = pendingRef.current!
    pendingRef.current = null
    flightRef.current = null
    const { game: next, events: ev, call } = applyOutcome(game, f, r)
    const mult = DIFFICULTIES[profile.difficulty].tpMultiplier
    const reward = Math.round(ev.reward * mult)
    seenRef.current = ev.paEnded ? { speeds: [], types: [] } : { speeds: [...seenRef.current.speeds, f.speed], types: [...seenRef.current.types, f.pitch.id] }
    lastFlightRef.current = ev.paEnded ? null : f
    logOverrideRef.current = ev.paEnded ? [...game.abLog, { pitch: f.pitch.id, speed: f.speed, x: f.landing.x, y: f.landing.y, px: r.barrel.x, py: r.barrel.y, call: call.text, tag: r.tags[0] ?? '' }] : null

    // Batted ball flight
    const o = r.outcome
    if (o === 'FOUL' || ['GROUND_OUT', 'FLY_OUT', 'LINE_OUT', 'POP_OUT', 'SINGLE', 'DOUBLE', 'HOME_RUN'].includes(o)) {
      const type = o === 'FOUL' ? 'FOUL' : o === 'HOME_RUN' ? 'HR' : o === 'GROUND_OUT' ? 'GROUND' : o === 'POP_OUT' ? 'POP' : o === 'LINE_OUT' ? 'LINE' : o === 'SINGLE' ? (Math.random() < .5 ? 'GROUND' : 'LINE') : 'FLY'
      const spray = o === 'FOUL' ? (r.sprayAngle >= 0 ? 1 : -1) * (1.1 + Math.random() * .3) : clamp(r.sprayAngle * .8, -.9, .9)
      battedRef.current = { at: performance.now(), spray, type, from: f.landing }
    } else battedRef.current = null
    if (!r.swing) animRef.current = { ...animRef.current, kind: o === 'HIT_BY_PITCH' ? 'hbp' : 'take', at: performance.now() }

    const tag = r.tags.filter(t => !call.text.includes(t)).slice(0, 2).join(' · ')
    resultRef.current = { text: call.text.split(' · ')[0], tone: call.tone, at: performance.now() }
    setCallout({ main: call.text, sub: [tag, `${f.pitch.short} ${f.speed.toFixed(0)}km`].filter(Boolean).join(' · '), tone: call.tone })
    playOutcome(call, o, f)
    if (reward) setTpPop({ n: reward, key: performance.now() })

    const staminaCost = f.power > .9 ? 5 : 3
    setProfile(prev => ({
      ...prev, trainingPoints: prev.trainingPoints + reward, stamina: clamp(prev.stamina - staminaCost + (ev.inningOver ? 30 : 0), 0, 100),
      arsenal: { ...prev.arsenal, [f.pitch.id]: { ...prev.arsenal[f.pitch.id], mastery: prev.arsenal[f.pitch.id].mastery + ev.mastery } },
    }))
    if (ev.strikeout) setCareer(c => ({ ...c, strikeouts: c.strikeouts + 1 }))
    if (ev.runs) setCareer(c => ({ ...c, runs: c.runs + ev.runs }))

    setPhase('result')
    if (ev.inningOver) {
      const closed = closeInning(next)
      setGame(next)
      window.setTimeout(() => {
        setSummary(closed.summary)
        setGame(closed.game)
        setCareer(c => ({ ...c, innings: c.innings + 1 }))
      }, 1250)
    } else {
      setGame(next)
      window.setTimeout(() => { logOverrideRef.current = null; animRef.current = { kind: 'idle', at: 0, contact: false, barrel: { x: 0, y: 0 } }; setPhase('ready') }, ev.paEnded ? 1250 : 650)
    }
  }
  finishRef.current = finishPitch

  function playOutcome(call: Call, o: PitchResult['outcome'], f: PitchFlight) {
    if (o === 'HOME_RUN') { sfx('crack', soundOn); sfx('cheer', soundOn); setShake(s => s + 1) }
    else if (o === 'SINGLE' || o === 'DOUBLE') { sfx('crack', soundOn); sfx('cheer', soundOn) }
    else if (o === 'FOUL' || o.endsWith('_OUT')) { sfx('bat', soundOn); if (o !== 'FOUL') sfx('mitt', soundOn) }
    else if (o === 'SWINGING_STRIKE') { sfx('whiff', soundOn); sfx(f.grade === 'PERFECT' ? 'pop' : 'mitt', soundOn) }
    else sfx(f.grade === 'PERFECT' && o === 'CALLED_STRIKE' ? 'pop' : 'mitt', soundOn)
    if (call.tone === 'k') { sfx('k', soundOn); navigator.vibrate?.([20, 40, 30]) }
    else if (f.grade === 'PERFECT') navigator.vibrate?.([15, 30, 20])
    if (f.speed >= 158 && (o === 'SWINGING_STRIKE' || o === 'CALLED_STRIKE')) setShake(s => s + 1)
  }

  useEffect(() => {
    let raf = 0
    const canvas = canvasRef.current, ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const scale = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = STAGE.width * scale; canvas.height = STAGE.height * scale
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    const tick = (now: number) => {
      const started = meterStartedAtRef.current
      // Needle sweeps up and back; staying too long costs you.
      const elapsed = started === null ? 0 : (now - started) / 1150
      const power = started === null ? 0 : elapsed <= 1 ? elapsed : Math.max(0, 2 - elapsed)
      gaugeRef.current = power
      if (gaugeFillRef.current) gaugeFillRef.current.style.width = `${power * 100}%`
      if (gaugeNeedleRef.current) gaugeNeedleRef.current.style.left = `${power * 100}%`
      if (started !== null && elapsed >= 2) launchRef.current(0)
      const f = flightRef.current
      const t = f ? clamp((now - f.startedAt) / f.duration, 0, 1) : 0
      const scene = sceneRef.current
      if (scene) renderScene(ctx, { ...scene, flight: f, flightProgress: t, anim: animRef.current, batted: battedRef.current, result: resultRef.current, log: logOverrideRef.current ?? scene.log, now })
      if (f && t >= 1) finishRef.current(f)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const canPitch = profile.created && panel === 'none' && !summary && stat.unlocked && (phase === 'ready' || phase === 'charging')
  const launch = (power: number) => {
    if (meterStartedAtRef.current === null || flightRef.current) return
    meterStartedAtRef.current = null
    const f = createFlight(pitch, stat, profile, target, power)
    const r = resolvePitch(f, {
      batter, pitcherHand: profile.hand, balls: game.balls, strikes: game.strikes, inning: game.inning, difficulty: profile.difficulty,
      previous: lastFlightRef.current, seenSpeeds: seenRef.current.speeds, seenTypes: seenRef.current.types, fastest,
    })
    pendingRef.current = r
    logOverrideRef.current = null
    battedRef.current = null
    animRef.current = r.swing ? { kind: 'swing', at: f.startedAt + f.duration, contact: !['SWINGING_STRIKE'].includes(r.outcome), barrel: r.barrel } : { kind: 'idle', at: 0, contact: false, barrel: r.barrel }
    flightRef.current = f
    setPhase('flying')
    setCallout({ main: f.grade, sub: `${pitch.short} ${f.speed.toFixed(1)} km/h`, tone: f.grade === 'PERFECT' ? 'perfect' : f.grade === 'GOOD' ? 'good' : 'miss' })
    sfx('release', soundOn, f.speed)
  }
  launchRef.current = launch
  const tapMeter = () => {
    if (!canPitch) return
    const now = performance.now()
    if (now - lastTapRef.current < 160) return
    lastTapRef.current = now
    if (meterStartedAtRef.current === null) { meterStartedAtRef.current = now; setPhase('charging') }
    else launch(gaugeRef.current)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); tapMeter() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const aim = (event: PointerEvent<HTMLCanvasElement>) => {
    if (phase !== 'ready' || panel !== 'none') return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width * STAGE.width
    const y = (event.clientY - rect.top) / rect.height * STAGE.height
    setTarget({ x: clamp((x - STAGE.zoneX) / (STAGE.zoneW / 2), -1.7, 1.7), y: clamp((y - STAGE.zoneY) / (STAGE.zoneH / 2), -1.7, 1.7) })
  }
  const openPanel = (p: Panel) => { meterStartedAtRef.current = null; if (phase === 'charging') setPhase('ready'); setPanel(p) }
  const upgrade = (key: StatKey) => {
    const level = profile.arsenal[trainingPitch][key], cost = upgradeCost(level)
    if (level >= 99 || profile.trainingPoints < cost) return
    setProfile(prev => ({ ...prev, trainingPoints: prev.trainingPoints - cost, arsenal: { ...prev.arsenal, [trainingPitch]: { ...prev.arsenal[trainingPitch], [key]: level + 1 } } }))
    sfx('ui', soundOn)
  }
  const unlock = () => {
    const def = pitchById(trainingPitch)
    if (profile.trainingPoints < def.unlockCost) return
    setProfile(prev => ({ ...prev, trainingPoints: prev.trainingPoints - def.unlockCost, arsenal: { ...prev.arsenal, [trainingPitch]: { ...prev.arsenal[trainingPitch], unlocked: true } } }))
    setSelected(trainingPitch); sfx('k', soundOn)
  }
  const continueGame = () => {
    if (!summary) return
    if (summary.finished) {
      const win = summary.finished === 'WIN', loss = summary.finished === 'LOSS'
      const bonus = Math.round((win ? 150 : loss ? 40 : 70) * DIFFICULTIES[profile.difficulty].tpMultiplier)
      setCareer(c => ({ ...c, games: c.games + 1, wins: c.wins + (win ? 1 : 0), losses: c.losses + (loss ? 1 : 0) }))
      setProfile(p => ({ ...p, trainingPoints: p.trainingPoints + bonus, stamina: 100 }))
      setGame(g => newGame(g, profile.difficulty, leagueTier(career.wins + (win ? 1 : 0))))
    }
    lastFlightRef.current = null; seenRef.current = { speeds: [], types: [] }; logOverrideRef.current = null
    animRef.current = { kind: 'idle', at: 0, contact: false, barrel: { x: 0, y: 0 } }
    setSummary(null); setPhase('ready'); setCallout({ main: 'PLAY BALL', sub: `${summary.finished ? 1 : game.inning}회 초`, tone: 'ready' })
  }

  const gaugeWidth = sweetSpot(stat.controlLevel) * 100
  const count = `${game.balls}-${game.strikes}`
  const leverage = game.strikes === 2 && game.balls < 3 ? '결정구 타이밍' : game.balls === 3 ? '풀카운트급 부담' : game.balls > game.strikes ? '타자 유리' : game.strikes > game.balls ? '투수 유리' : ''
  const matchup = side === profile.hand ? '같은 손' : '반대 손'
  const handLabel = batter.bats === 'S' ? `스위치(${side === 'R' ? '우' : '좌'})` : side === 'R' ? '우타' : '좌타'
  const lastPitch = game.abLog[game.abLog.length - 1]

  return <div className="app-shell">
    <main className={`game-shell shake-${shake % 2}`}>
      <header className="app-header">
        <div className="brand"><div className="brand-mark">A</div><div><strong>ACE PROJECT</strong><small>{LEAGUE_TIERS[tier]} · {career.wins}승 {career.losses}패</small></div></div>
        <div className="header-actions">
          <div className="tp-pill"><Zap size={13} fill="currentColor" /><strong>{profile.trainingPoints.toLocaleString()}</strong>{tpPop && <em key={tpPop.key} className="tp-pop">+{tpPop.n}</em>}</div>
          <button className="icon-button train" onClick={() => { setTrainingPitch(selected); openPanel('training') }} aria-label="훈련실"><Activity size={17} /></button>
          <button className="icon-button" onClick={() => setSoundOn(!soundOn)} aria-label={soundOn ? '소리 끄기' : '소리 켜기'}>{soundOn ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
          <button className="icon-button" onClick={() => openPanel('help')} aria-label="도움말"><CircleHelp size={17} /></button>
        </div>
      </header>

      <div className="scorebug">
        <div className="teams">
          <div><i style={{ background: team.color }} /><span>{team.short}</span><b>{game.runsAgainst}</b></div>
          <div><i style={{ background: '#e6ff7a' }} /><span>ACE</span><b>{game.runsFor}</b></div>
        </div>
        <div className="inning-box"><span>▲</span><b>{game.inning}</b></div>
        <Bases bases={game.bases} />
        <div className="count-box">
          <div className="count-num">{count}</div>
          <div className="outs">{[0, 1].map(i => <i key={i} className={i < game.outs ? 'on' : ''} />)}<span>OUT</span></div>
        </div>
        <div className="pc-box" onClick={() => openPanel('profile')} role="button" tabIndex={0} aria-label="투수 프로필">
          <span>P {game.pitches}</span>
          <div className="stamina"><i style={{ width: `${profile.stamina}%`, background: profile.stamina < 30 ? '#ff6b5b' : undefined }} /></div>
        </div>
      </div>

      <section className="stadium-card">
        <canvas ref={canvasRef} className="stadium-canvas" onPointerDown={aim} aria-label="스트라이크 존. 터치해서 코스를 고르세요." />
        <div className={`batter-card ${side === 'R' ? 'left' : 'right'}`}>
          <div className="batter-top"><span className="order">{batter.order}번</span><strong>{batter.name}</strong><span className={`hand hand-${side}`}>{handLabel}</span></div>
          <div className="batter-line">{batter.avg.toFixed(3).slice(1)} · {batter.hr}HR</div>
          <div className="batter-tags"><span>{ZONE_LABEL[batter.zone]}</span>{batter.weakness !== 'NONE' && <span className="weak">{WEAK_LABEL[batter.weakness]}</span>}</div>
        </div>
        <div className={`mind-chip ${side === 'R' ? 'right' : 'left'}`}>
          <span>{matchup}</span>
          <b>{batterMindset({ balls: game.balls, strikes: game.strikes, seenTypes: seenRef.current.types })}</b>
        </div>
        <button className={scout ? 'scout-toggle on' : 'scout-toggle'} onClick={() => setScout(!scout)} aria-pressed={scout}><Flame size={13} /> 핫존</button>
        {leverage && <div className="leverage">{leverage}</div>}
        {lastPitch && phase === 'ready' && <div className="last-pitch">{lastPitch.call}{lastPitch.tag && <em> · {lastPitch.tag}</em>}</div>}
      </section>

      <div className="pitch-bar" role="radiogroup" aria-label="구종">
        {PITCHES.filter(p => profile.arsenal[p.id].unlocked).map(p => {
          const s = profile.arsenal[p.id]
          return <button key={p.id} role="radio" aria-checked={selected === p.id} className={selected === p.id ? 'pitch-chip active' : 'pitch-chip'} style={{ '--pitch-color': p.color } as CSSProperties}
            disabled={phase === 'flying' || phase === 'charging'} onClick={() => { setSelected(p.id); sfx('ui', soundOn) }}>
            <i /><span>{p.short}</span><small>{statSpeed(p, s).toFixed(0)}</small>
          </button>
        })}
        {PITCHES.some(p => !profile.arsenal[p.id].unlocked) && <button className="pitch-chip add" onClick={() => { setTrainingPitch(PITCHES.find(p => !profile.arsenal[p.id].unlocked)!.id); openPanel('training') }} aria-label="구종 추가"><LockKeyhole size={13} /></button>}
      </div>

      <section className="control-card">
        <div className={`callout tone-${callout.tone}`}><b>{phase === 'charging' ? 'POWER' : callout.main}</b><span>{phase === 'charging' ? '밝은 구간에서 탭' : callout.sub}</span>{tunnel > .35 && phase === 'ready' && <em className="tunnel-badge">TUNNEL {Math.round(tunnel * 100)}</em>}</div>
        <div className="gauge">
          <div className="gauge-sweet" style={{ width: `${gaugeWidth}%`, left: `${82 - gaugeWidth / 2}%` }} />
          <div ref={gaugeFillRef} className="gauge-fill" />
          <div ref={gaugeNeedleRef} className="gauge-needle" />
        </div>
        <button className={`pitch-button ${phase === 'charging' ? 'charging' : ''}`} onClick={e => { e.currentTarget.blur(); tapMeter() }} disabled={!canPitch}>
          {phase === 'flying' ? '…' : phase === 'charging' ? '릴리스!' : phase === 'result' ? '다음 공 준비' : <>투구 <small>{pitch.short} · {statSpeed(pitch, stat).toFixed(0)}km</small></>}
        </button>
      </section>
    </main>

    {summary && <div className="overlay"><section className="sheet inning-sheet">
      <span className="eyebrow">{summary.finished ? 'FINAL' : `${summary.inning}회 종료`}</span>
      <h1>{summary.finished === 'WIN' ? '승리!' : summary.finished === 'LOSS' ? '패전…' : summary.finished === 'TIE' ? '무승부' : summary.allowed === 0 ? (summary.clean ? '삼자범퇴' : '무실점') : `${summary.allowed}실점`}</h1>
      <table className="linescore"><thead><tr><th />{game.lineScore.slice(0, summary.inning).map((_, i) => <th key={i}>{i + 1}</th>)}<th>R</th></tr></thead>
        <tbody><tr><td>{team.short}</td>{game.lineScore.slice(0, summary.inning).map((n, i) => <td key={i}>{n}</td>)}<td><b>{game.runsAgainst}</b></td></tr>
          <tr><td>ACE</td>{game.lineScore.slice(0, summary.inning).map((_, i) => <td key={i}>{summary.finished === 'WIN' && summary.ours === 0 && i === summary.inning - 1 && summary.inning >= 9 ? 'X' : game.ourScore[i] ?? ''}</td>)}<td><b>{game.runsFor}</b></td></tr></tbody></table>
      {!summary.finished && <p className="inning-note">{summary.ours ? `우리 타선 ${summary.ours}점 지원!` : '우리 타선 침묵.'}{summary.clean ? '  클린 이닝 보너스 +TP' : ''}</p>}
      {summary.finished && <p className="inning-note">{game.strikeouts}K · {game.hits}피안타 · {game.walks}볼넷 · {game.pitches}구</p>}
      <button className="primary-button" onClick={continueGame}>{summary.finished ? '다음 경기' : `${summary.inning + 1}회 초 등판`} <ArrowRight size={18} /></button>
    </section></div>}

    {!profile.created && <Creator initialProfile={profile} onSave={p => { setProfile(p); const first = PITCHES.find(def => p.arsenal[def.id].unlocked)!.id; setSelected(first); setTrainingPitch(first); setGame(newGame(undefined, p.difficulty)) }} editing={false} />}
    {panel === 'profile' && profile.created && <Creator initialProfile={profile} onSave={p => { setProfile(p); setPanel('none') }} editing onClose={() => setPanel('none')} />}
    {panel === 'training' && <div className="overlay" onPointerDown={e => { if (e.target === e.currentTarget) setPanel('none') }}><section className="sheet training-sheet">
      <div className="sheet-top"><span className="eyebrow">PITCH LAB</span><button className="icon-button" onClick={() => setPanel('none')} aria-label="닫기"><ArrowLeft size={18} /></button></div>
      <div className="sheet-title"><h1>훈련실</h1><div className="tp-large"><Zap size={16} fill="currentColor" /> {profile.trainingPoints} <small>TP</small></div></div>
      <div className="training-tabs">{PITCHES.map(p => <button key={p.id} className={trainingPitch === p.id ? 'active' : ''} onClick={() => setTrainingPitch(p.id)}>{p.short}{!profile.arsenal[p.id].unlocked && <LockKeyhole size={10} />}</button>)}</div>
      {(() => {
        const p = pitchById(trainingPitch), s = profile.arsenal[trainingPitch]
        const moveCm = Math.round(Math.hypot(p.moveX, p.moveY) * breakScale(s.breakLevel))
        return <>
          <div className="training-feature" style={{ '--pitch-color': p.color } as CSSProperties}><span className="feature-orb">⚾</span><div><small>{p.family} · {s.unlocked ? `숙련 Lv.${masteryLevel(s.mastery)}` : 'LOCKED'}</small><h2>{p.name}</h2><p>{p.description}</p></div><b>{s.unlocked ? statSpeed(p, s).toFixed(1) : '–'} <small>KM/H · {moveCm}CM</small></b></div>
          {s.unlocked ? <div className="upgrade-list">{(['velocityLevel', 'controlLevel', 'breakLevel'] as StatKey[]).map(key => {
            const level = s[key], cost = upgradeCost(level), isMax = level >= 99
            return <div className="upgrade-row" key={key}><div className="upgrade-icon">{key === 'velocityLevel' ? <Zap size={18} /> : key === 'controlLevel' ? <Crosshair size={18} /> : <Sparkles size={18} />}</div><div className="upgrade-info"><div><strong>{LABELS[key].label}</strong><span>LV.{level}</span></div><small>{LABELS[key].hint}</small><div className="upgrade-track"><span style={{ width: `${level}%` }} /></div></div><button onClick={() => upgrade(key)} disabled={isMax || profile.trainingPoints < cost}>{isMax ? 'MAX' : <>{cost} <Zap size={12} fill="currentColor" /></>}</button></div>
          })}</div> : <div className="unlock-area"><LockKeyhole size={22} /><p>새 무기를 장착하세요.</p><button className="primary-button" disabled={profile.trainingPoints < p.unlockCost} onClick={unlock}>{p.unlockCost} TP 해금 <ArrowRight size={17} /></button></div>}
        </>
      })()}
      <div className="training-foot"><span>LV.{pitcherLevel(profile)} · 통산 {career.strikeouts}K · {career.innings}이닝</span></div>
    </section></div>}
    {panel === 'help' && <div className="overlay" onPointerDown={e => { if (e.target === e.currentTarget) setPanel('none') }}><section className="sheet help-sheet">
      <div className="sheet-top"><span className="eyebrow">SCOUTING NOTES</span><button className="icon-button" onClick={() => setPanel('none')} aria-label="닫기"><ArrowLeft size={18} /></button></div>
      <h1>승부의 기술</h1>
      <div className="help-step"><b>01</b><div><strong>존 밖으로도 던져라</strong><p>2스트라이크 뒤 존 밖 유인구는 헛스윙을 부르지만, 타자가 참으면 볼입니다.</p></div></div>
      <div className="help-step"><b>02</b><div><strong>하이 패스트볼</strong><p>포심을 존 위쪽 경계로. 타자는 떠오르는 공 아래를 휘두릅니다.</p></div></div>
      <div className="help-step"><b>03</b><div><strong>피치 터널</strong><p>직전 공과 같은 길로 오다 갈라지면 <em>TUNNEL</em>이 뜹니다. 직구 뒤 같은 높이에서 떨어지는 공이 제일 무섭습니다.</p></div></div>
      <div className="help-step"><b>04</b><div><strong>손을 봐라</strong><p>같은 손 타자엔 도망가는 슬라이더·스위퍼, 반대 손 타자엔 체인지업·스플리터가 잘 통합니다.</p></div></div>
      <div className="help-options">
        <button onClick={() => setShowZone(!showZone)}><Settings2 size={16} /> 스트라이크 존 선 <span>{showZone ? 'ON' : 'OFF'}</span></button>
        <button className={resetArmed ? 'reset-confirm' : ''} onClick={() => {
          if (resetArmed) { flightRef.current = null; lastFlightRef.current = null; meterStartedAtRef.current = null; pendingRef.current = null; setPhase('ready'); setProfile(defaultProfile()); setGame(newGame()); setCareer(defaultCareer()); setSelected('FOUR_SEAM'); setResetArmed(false); setPanel('none') } else setResetArmed(true)
        }}><RotateCcw size={16} /> {resetArmed ? '한 번 더 누르면 기록 삭제' : '새 선수로 시작'} <span>{resetArmed ? '확인' : 'RESET'}</span></button>
      </div>
      <button className="primary-button" onClick={() => { setResetArmed(false); setPanel('none') }}>마운드로 <Check size={18} /></button>
    </section></div>}
  </div>
}

export default App
