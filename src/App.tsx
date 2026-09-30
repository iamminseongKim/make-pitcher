import { Challenge } from './Challenge'
import { freshArcade, MISSIONS, performanceBonus, signatureText, traitActive, type Effort } from './arcade'
import { sfx, disposeAudio } from './audio'
import { TIERS, FEAT_TP, gameFeat, seasonAwards, loadUnlockedTier, saveUnlockedTier, aggregate, callUpSchedule, promotionStatus, seasonDone as isSeasonDone, formatIP, newSeason, recordGame, seasonRates, gameTeam, serviceTime, tierOf, type Season } from './season'
import { PitchChart } from './PitchChart'
import { Creator } from './Creator'
import { CareerHub, PromotionCard } from './CareerHub'
import { Logo } from './Logo'
import { LegacyHall, RetirementSheet } from './Legacy'
import { AGE, RETIRE_LABEL, START_AGE, ageEffects, ageStage, buildRetired, legacyBonus, loadLegacy, retirementStatus, saveLegacy, type RetireReason, type RetiredPlayer } from './retirement'
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { Activity, ArrowLeft, ArrowRight, Check, CircleHelp, Crosshair, Eye, Flame, History, LockKeyhole, RotateCcw, Settings2, Sparkles, Trophy, Volume2, VolumeX, Zap } from 'lucide-react'
import {
  DECISION_LABEL, MEATBALL_MISS, MOOD_LABEL, SPECIAL_TP, STAMINA, PITCHES, SAVE_KEY, SWEET_CENTER, WEAK_LABEL, ZONE_LABEL,
  applyOutcome, batterAdaptation, bullpenFinish, canRefuseHook, fatigueAfter, needsHook, pitcherDecision, staminaCost, batterMindset, batterSide, breakScale, clamp, closeInning, createFlight, createPreviewFlight, defaultProfile,
  loadSave, masteryLevel, moodOf, newGame, pitchById, pitcherLevel, resolvePitch, scoutingReport, statSpeed, sweetSpot, tunnelRead, upgradeCost, zoneHeat,
  type Call, type GameState, type InningSummary, type PitchFlight,
  type PitchLog, type PitchResult, type PitcherProfile, type PitchType, type StatKey,
} from './game'
import { renderScene, STAGE, type BatterAnim, type BattedBall } from './render'

type Panel = 'none' | 'training' | 'career' | 'profile' | 'help' | 'legacy' | 'challenge' | 'mission'
type Phase = 'ready' | 'charging' | 'flying' | 'result'
const initial = loadSave()
const IDLE: BatterAnim = { kind: 'idle', at: 0, contact: false, barrel: { x: 0, y: 0 } }
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

const LABELS: Record<StatKey, { label: string; hint: string }> = {
  velocityLevel: { label: '구속', hint: '빠를수록 타자가 늦는다' },
  controlLevel: { label: '제구', hint: '릴리스 창이 넓어지고 탄착이 모인다' },
  breakLevel: { label: '무브먼트', hint: '더 늦게, 더 크게 꺾인다' },
}

function Bases({ bases }: { bases: [boolean, boolean, boolean] }) {
  return <div className="bases" aria-label={`주자: ${bases.map((b, i) => b ? `${i + 1}루` : '').filter(Boolean).join(', ') || '없음'}`}>
    <i className={bases[1] ? 'on' : ''} style={{ left: 13, top: 4 }} />
    <i className={bases[2] ? 'on' : ''} style={{ left: 3, top: 14 }} />
    <i className={bases[0] ? 'on' : ''} style={{ left: 23, top: 14 }} />
  </div>
}

/** 1,234 → 1,234 · 12,627 → 12.6k · 1,250,000 → 1.3M */
const compactTP = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1)}k` : n.toLocaleString()

function PaChips({ pitches }: { pitches: PitchLog[] }) {
  return <span className="pa-chips">{pitches.map((p, i) => { const d = pitchById(p.pitch); return <i key={i} style={{ '--pitch-color': d.color } as CSSProperties} title={`${d.short} ${p.speed.toFixed(0)} · ${p.call}`}>{d.short.slice(0, 1)}{p.meatball && <b>!</b>}</i> })}</span>
}

function App() {
  const [profile, setProfile] = useState<PitcherProfile>(initial.profile)
  const [game, setGame] = useState<GameState>(initial.game)
  const [season, setSeason] = useState<Season>(initial.season)
  const [history, setHistory] = useState<Season[]>(initial.history)
  const [legacy, setLegacy] = useState<RetiredPlayer[]>(loadLegacy)
  const [retired, setRetired] = useState<RetiredPlayer | null>(null)
  // Leagues this device has reached with any character (difficulty unlocks).
  const [unlockedTier, setUnlockedTier] = useState(() => Math.max(loadUnlockedTier(), initial.profile.created ? initial.season.tier : 0, ...initial.history.map(h => h.tier)))
  const [selected, setSelected] = useState<PitchType>(PITCHES.find(p => initial.profile.arsenal[p.id].unlocked)?.id ?? 'FOUR_SEAM')
  const [target, setTarget] = useState({ x: .45, y: .45 })
  const [panel, setPanel] = useState<Panel>('none')
  const [trainingPitch, setTrainingPitch] = useState<PitchType>(selected)
  const [effort, setEffort] = useState<Effort>('normal')
  const [focused, setFocused] = useState(false)
  const pitchMode = useRef({ effort: 'normal' as Effort, focused: false })
  const [phase, setPhase] = useState<Phase>('ready')
  const [callout, setCallout] = useState<{ main: string; sub: string; tone: string }>({ main: 'PLAY BALL', sub: '코스를 찍고 투구', tone: 'ready' })
  const [soundOn, setSoundOn] = useState(true)
  const [showZone, setShowZone] = useState(true)
  const [scout, setScout] = useState(false)
  const [showMemory, setShowMemory] = useState(true)
  const [resetArmed, setResetArmed] = useState(false)
  const [summary, setSummary] = useState<InningSummary | null>(initial.game.over ? { inning: initial.game.inning, allowed: 0, ours: 0, clean: false, finished: initial.game.runsFor > initial.game.runsAgainst ? 'WIN' : initial.game.runsFor < initial.game.runsAgainst ? 'LOSS' : 'TIE' } : null)
  const [tpPop, setTpPop] = useState<{ n: number; key: number } | null>(null)
  const [shake, setShake] = useState(0)
  const [hook, setHook] = useState(() => needsHook(initial.profile.stamina, initial.game) && !initial.game.over)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gaugeElRef = useRef<HTMLDivElement>(null)
  const gaugeFillRef = useRef<HTMLDivElement>(null)
  const gaugeNeedleRef = useRef<HTMLDivElement>(null)
  const meterRef = useRef(0)
  const meterStartedAtRef = useRef<number | null>(null)
  const flightRef = useRef<PitchFlight | null>(null)
  const lastFlightRef = useRef<PitchFlight | null>(null) // previous pitch in this at-bat (tunnel reference)
  const pendingRef = useRef<PitchResult | null>(null)
  const animRef = useRef<BatterAnim>(IDLE)
  const battedRef = useRef<BattedBall | null>(null)
  const resultRef = useRef({ text: '', tone: '', at: 0 })
  const logOverrideRef = useRef<PitchLog[] | null>(null)
  const seenRef = useRef<{ speeds: number[]; types: PitchType[] }>({ speeds: [], types: [] })
  const sceneRef = useRef<Parameters<typeof renderScene>[1] | null>(null)
  const finishRef = useRef<(f: PitchFlight) => void>(() => {})
  const launchRef = useRef<(meter: number) => void>(() => {})
  const lastTapRef = useRef(0)

  const arcade = game.arcade ?? freshArcade()
  const mission = MISSIONS.find(m => m.id === arcade.mission)
  const pitch = pitchById(selected)
  const stat = profile.arsenal[selected]
  const batter = game.lineup[game.batterIndex]
  const side = batterSide(batter, profile.hand)
  const team = gameTeam(game)
  const league = tierOf(game.tier)
  const seasonView = recordGame(season, game)
  const seasonDone = isSeasonDone(seasonView)
  const promo = promotionStatus(seasonView)
  const retireStat = retirementStatus(profile.age, season.tier, promo.canPromote, history.length)
  const aging = ageEffects(profile.age)
  const careerLine = aggregate([...history, seasonView])
  const service = serviceTime(history, seasonView)
  const unlocked = PITCHES.filter(p => profile.arsenal[p.id].unlocked).map(p => p.id)
  const prior = (game.memory ?? {})[batter.id] ?? []
  const confidence = (game.confidence ?? {})[batter.id] ?? 0
  const mood = moodOf(confidence)
  const report = scoutingReport(batter, side, profile.hand, prior, unlocked)
  const preview = profile.created && stat.unlocked ? createPreviewFlight(pitch, stat, profile, target) : null
  const tunnel = preview ? tunnelRead(preview, lastFlightRef.current) : { score: 0, early: 0, late: 0, pair: false }
  const readRisk = batterAdaptation(prior, selected, target).level
  const fastballs = PITCHES.filter(p => profile.arsenal[p.id].unlocked && p.family === 'FASTBALL')
  const fastest = Math.max(...(fastballs.length ? fastballs : PITCHES.filter(p => profile.arsenal[p.id].unlocked)).map(p => statSpeed(p, profile.arsenal[p.id])), 100)
  const showingMemory = showMemory && prior.length > 0

  sceneRef.current = {
    profile, strikeoutChance: game.strikes === 2, batterSide: side, teamColor: team.color, target, flight: null, previousFlight: lastFlightRef.current, previewFlight: preview,
    tunnel: tunnel.score, flightProgress: 0, showZone, heat: scout ? zoneHeat(batter, side) : null, log: logOverrideRef.current ?? game.abLog,
    memory: showingMemory && phase !== 'flying' ? prior : null,
    anim: animRef.current, batted: battedRef.current, result: resultRef.current, now: 0,
  }

  useEffect(() => { if (profile.created && season.tier > unlockedTier) setUnlockedTier(season.tier) }, [profile.created, season.tier, unlockedTier])
  useEffect(() => { saveUnlockedTier(unlockedTier) }, [unlockedTier])
  useEffect(() => { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ profile, game, season, history })) } catch { /* storage optional */ } }, [profile, game, season, history])

  const timers = useRef(new Set<number>())
  const later = (fn: () => void, ms: number) => { const id = window.setTimeout(() => { timers.current.delete(id); fn() }, ms); timers.current.add(id) }
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear(); disposeAudio() }, [])

  function finishPitch(f: PitchFlight) {
    const r = pendingRef.current!
    pendingRef.current = null
    flightRef.current = null
    const spent = f.focused ? { ...game, arcade: { ...arcade, focus: Math.max(0, arcade.focus - 100) } } : game
    const { game: next, events: ev, call } = applyOutcome(spent, f, r)
    const reward = Math.round(ev.reward * league.tp * aging.tpMul)
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

    setFocused(false)
    const technique = next.arcade?.techniques.join(' · ') ?? ''
    const tag = r.tags.filter(t => !call.text.includes(t)).slice(0, 2).join(' · ')
    resultRef.current = { text: ev.immaculate ? 'IMMACULATE INNING!' : ev.strikeout && o === 'SWINGING_STRIKE' ? 'STRIKE THREE!' : o === 'SWINGING_STRIKE' ? (r.tags.includes('유인구') ? 'CHASE!' : 'SWING & MISS') : r.tags.includes('코너 꽉 찬 공') ? 'PAINTED THE CORNER' : call.text.split(' · ')[0], tone: call.tone, at: performance.now() }
    setCallout({ main: call.text, sub: [technique || tag, `${f.pitch.short} ${f.speed.toFixed(0)}km`].filter(Boolean).join(' · '), tone: call.tone })
    playOutcome(call, o, f)
    if (reward) setTpPop({ n: reward, key: performance.now() })

    const stamina = clamp(profile.stamina - staminaCost(f.timingError + SWEET_CENTER, game, profile.height, profile.age) - (f.effort === 'power' ? 1.2 : 0) + (ev.inningOver ? STAMINA.inningRest : 0), 0, 100)
    setProfile(prev => ({
      ...prev, trainingPoints: prev.trainingPoints + reward, stamina,
      arsenal: { ...prev.arsenal, [f.pitch.id]: { ...prev.arsenal[f.pitch.id], mastery: prev.arsenal[f.pitch.id].mastery + ev.mastery } },
    }))

    setPhase('result')
    if (ev.inningOver) {
      const closed = closeInning(next)
      setGame(closed.game)
      later(() => { setSummary(closed.summary); setGame(closed.game) }, 1250)
    } else {
      setGame(next)
      // The manager only comes out between batters.
      later(() => { logOverrideRef.current = null; animRef.current = IDLE; setPhase('ready'); if (ev.paEnded && needsHook(stamina, next)) setHook(true) }, ev.paEnded ? 1250 : 650)
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
      // Needle sweeps up (0→1) and back (1→2); the path position is the timing, the height is the power.
      const meter = started === null ? 0 : (now - started) / (pitchMode.current.focused ? 1550 : pitchMode.current.effort === 'power' ? 950 : 1150)
      const needle = meter <= 1 ? meter : Math.max(0, 2 - meter)
      meterRef.current = meter
      if (gaugeFillRef.current) gaugeFillRef.current.style.width = `${needle * 100}%`
      if (gaugeNeedleRef.current) gaugeNeedleRef.current.style.left = `${needle * 100}%`
      gaugeElRef.current?.classList.toggle('returning', meter > 1)
      if (started !== null && meter >= 2) launchRef.current(2)
      const f = flightRef.current
      const raw = f ? (now - f.startedAt) / f.duration : 0
      const cinematic = !reducedMotion() && pendingRef.current?.outcome === 'SWINGING_STRIKE' && sceneRef.current?.strikeoutChance && (pitchMode.current.focused || (sceneRef.current?.tunnel ?? 0) > .45)
      const t = clamp(cinematic && raw > .7 ? .7 + (raw - .7) * .35 : raw, 0, 1)
      const scene = sceneRef.current
      if (scene) renderScene(ctx, { ...scene, flight: f, flightProgress: t, anim: animRef.current, batted: battedRef.current, result: resultRef.current, log: logOverrideRef.current ?? scene.log, now })
      if (f && t >= 1) finishRef.current(f)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const canPitch = profile.created && !retired && !game.over && panel === 'none' && !summary && !hook && stat.unlocked && (phase === 'ready' || phase === 'charging')
  const launch = (meter: number) => {
    if (meterStartedAtRef.current === null || flightRef.current) return
    meterStartedAtRef.current = null
    gaugeElRef.current?.classList.remove('returning')
    const f = createFlight(pitch, stat, profile, target, meter, pitchMode.current)
    const r = resolvePitch(f, {
      batter, pitcherHand: profile.hand, balls: game.balls, strikes: game.strikes, inning: game.inning, tier: game.tier,
      previous: lastFlightRef.current, seenSpeeds: seenRef.current.speeds, seenTypes: seenRef.current.types, fastest, history: game.abLog,
      memory: prior, confidence,
    })
    pendingRef.current = r
    logOverrideRef.current = null
    battedRef.current = null
    const slowK = r.outcome === 'SWINGING_STRIKE' && game.strikes === 2 && !reducedMotion() && (pitchMode.current.focused || tunnel.score > .45)
    animRef.current = r.swing ? { kind: 'swing', at: f.startedAt + f.duration * (slowK ? .7 + .3 / .35 : 1), contact: r.outcome !== 'SWINGING_STRIKE', barrel: r.barrel } : { ...IDLE, barrel: r.barrel }
    flightRef.current = f
    setPhase('flying')
    if (f.meatball) { setCallout({ main: '실투!', sub: `${pitch.short}가 한가운데로 몰렸다 · ${f.speed.toFixed(1)} km/h`, tone: 'miss' }); navigator.vibrate?.([60]) }
    else setCallout({ main: f.grade, sub: `${pitch.short} ${f.speed.toFixed(1)} km/h · 체감 ${f.perceivedSpeed.toFixed(1)}`, tone: f.grade === 'PERFECT' ? 'perfect' : f.grade === 'GOOD' ? 'good' : 'miss' })
    sfx('release', soundOn, f.speed)
  }
  launchRef.current = launch
  const tapMeter = () => {
    if (!canPitch) return
    const now = performance.now()
    if (now - lastTapRef.current < 160) return
    lastTapRef.current = now
    if (meterStartedAtRef.current === null) { pitchMode.current = { effort, focused }; meterStartedAtRef.current = now; setPhase('charging') }
    else launch(meterRef.current)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLElement && (e.target.matches('input, button, select, textarea') || e.target.isContentEditable))) { e.preventDefault(); tapMeter() } }
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
  const openPanel = (p: Panel) => { if (phase === 'flying') return; meterStartedAtRef.current = null; if (phase === 'charging') setPhase('ready'); setPanel(p) }
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
  const resetAtBatRefs = () => {
    setFocused(false); lastFlightRef.current = null; seenRef.current = { speeds: [], types: [] }; logOverrideRef.current = null; animRef.current = IDLE
  }
  type Move = 'next' | 'promote' | 'repeat' | 'demote' | 'callup'
  const continueGame = (move: Move = 'next') => {
    if (!summary) return
    if (summary.finished) {
      const win = summary.finished === 'WIN', loss = summary.finished === 'LOSS'
      const feat = gameFeat(game)
      const bonus = Math.round(((win ? 150 : loss ? 40 : 70) + performanceBonus(game) + (feat ? FEAT_TP[feat] : 0)) * league.tp * aging.tpMul)
      const fatigue = fatigueAfter(game, profile.stamina)
      setProfile(p => ({ ...p, trainingPoints: p.trainingPoints + bonus, fatigue, stamina: 100 - fatigue }))
      let nextSeason = seasonView
      if (move === 'callup' && promo.callUp) {
        // Mid-season call-up: same year, a new club, the rest of the schedule.
        setHistory(h => [...h, { ...seasonView, age: seasonView.age ?? profile.age, awards: seasonAwards(seasonView) }])
        nextSeason = { ...newSeason(season.tier + 1, season.number + 1, seasonView.year, callUpSchedule(seasonView)), age: profile.age }
      } else if (seasonDone) {
        setHistory(h => [...h, { ...seasonView, age: seasonView.age ?? profile.age, awards: seasonAwards(seasonView) }])
        // New calendar year: one year older.
        setProfile(p => ({ ...p, age: p.age + 1 }))
        const tier = promo.demote ? season.tier - 1 : move === 'promote' && promo.canPromote ? season.tier + 1 : season.tier
        nextSeason = { ...newSeason(tier, season.number + 1, seasonView.year + 1), age: profile.age + 1 }
      }
      setSeason(nextSeason)
      setGame(g => newGame(g, nextSeason.tier))
    }
    resetAtBatRefs()
    setSummary(null); setPhase('ready'); setCallout({ main: 'PLAY BALL', sub: `${summary.finished ? 1 : game.inning}회 초`, tone: 'ready' })
    if (!summary.finished && needsHook(profile.stamina, game)) setHook(true)
  }
  /** Hand the ball to the bullpen: the rest of the game is simulated. */
  const takeHook = () => {
    const done = bullpenFinish(game)
    setHook(false); resetAtBatRefs()
    setGame(done)
    const result = done.runsFor > done.runsAgainst ? 'WIN' : done.runsFor < done.runsAgainst ? 'LOSS' : 'TIE'
    setSummary({ inning: done.inning, allowed: done.bullpenRuns, ours: 0, clean: false, finished: result })
    sfx('ui', soundOn)
  }
  const refuseHook = () => { if (!canRefuseHook(game)) return; setGame(g => ({ ...g, refusals: (g.refusals ?? 0) + 1 })); setHook(false); sfx('ui', soundOn) }
  /** Hang up the spikes: archive the whole career on this device and hand off to a new draftee. */
  const retire = (reason: RetireReason) => {
    const seasons = [...history, { ...seasonView, age: seasonView.age ?? profile.age, awards: seasonDone ? seasonAwards(seasonView) : [] }]
    const rec = buildRetired(profile, seasons, reason)
    const next = [...legacy, rec]
    saveLegacy(next); setLegacy(next); setRetired(rec)
    setSummary(null); setHook(false); setPanel('none'); meterStartedAtRef.current = null
    sfx('cheer', soundOn)
  }
  const resetAll = () => {
    timers.current.forEach(clearTimeout); timers.current.clear()
    resetAtBatRefs(); battedRef.current = null; resultRef.current = { text: '', tone: '', at: 0 }; flightRef.current = null; meterStartedAtRef.current = null; pendingRef.current = null
    setSeason(newSeason()); setHistory([]); setSummary(null); setHook(false); setPhase('ready'); setProfile(defaultProfile()); setGame(newGame()); setSelected('FOUR_SEAM'); setResetArmed(false); setPanel('none')
  }

  const half = sweetSpot(stat.controlLevel) / 2
  const pct = (v: number) => `${clamp(v, 0, 1) * 100}%`
  const dangerLeft = SWEET_CENTER - half - MEATBALL_MISS
  const dangerRight = SWEET_CENTER + half + MEATBALL_MISS
  const goodL = SWEET_CENTER - half - .05, goodR = SWEET_CENTER + half + .05
  const leverage = game.strikes === 2 && game.balls < 3 ? '결정구 타이밍' : game.balls === 3 ? '볼 하나도 부담' : game.balls > game.strikes ? '타자 유리' : game.strikes > game.balls ? '투수 유리' : ''
  const matchup = side === profile.hand ? '같은 손' : '반대 손'
  const handLabel = batter.bats === 'S' ? `스위치(${side === 'R' ? '우' : '좌'})` : side === 'R' ? '우타' : '좌타'
  const careerRates = seasonRates(careerLine)
  const tierLadder = <ol className="tier-ladder" aria-label="리그 단계">{TIERS.map((t, i) => <li key={t.id} className={i < game.tier ? 'done' : i === game.tier ? 'on' : ''} title={t.label}><b>{t.short}</b></li>)}</ol>

  return <div className="app-shell">
    <div className="layout">
      <aside className="side-panel pitcher-panel" aria-label="투수 정보">
        <div className="panel-card">
          <span className="eyebrow">PITCHER</span>
          <h2>{profile.name}</h2>
          <p className="muted">{service.label} · LV.{pitcherLevel(profile)} · {profile.hand === 'R' ? '우투' : '좌투'}</p>
          {tierLadder}
          <p className="tier-full">{league.label}</p>
        </div>
        <div className="panel-card">
          <span className="eyebrow">SEASON {season.number} · CAREER</span>
          <div className="mini-grid">
            <div><small>W-L</small><b>{seasonView.wins}-{seasonView.losses}</b></div><div><small>ERA</small><b>{seasonRates(seasonView).ERA}</b></div><div><small>SO</small><b>{seasonView.strikeouts}</b></div>
            <div><small>통산 IP</small><b>{formatIP(careerLine.outs)}</b></div><div><small>통산 FIP</small><b>{careerRates.FIP}</b></div><div><small>통산 K/9</small><b>{careerRates['K/9']}</b></div>
          </div>
          <button className="ghost-button" onClick={() => openPanel('career')}><Trophy size={14} /> 커리어 기록실</button>
        </div>
        <div className="panel-card">
          <span className="eyebrow">ARSENAL</span>
          <ul className="arsenal-list">{unlocked.map(id => { const d = pitchById(id), s = profile.arsenal[id], pf = createPreviewFlight(d, s, profile, { x: 0, y: 0 }); return <li key={id} style={{ '--pitch-color': d.color } as CSSProperties}><i /><span>{d.short}</span><b>{statSpeed(d, s).toFixed(0)}</b><small>IVB {pf.ivb > 0 ? '+' : ''}{pf.ivb}</small></li> })}</ul>
        </div>
      </aside>

      <main className={`game-shell shake-${shake % 2}`}>
        <header className="app-header">
          <Logo sub={`${profile.age}세 · S${season.number} · G${Math.min(season.scheduled, season.games + 1)}/${season.scheduled} · ${careerLine.wins}승 ${careerLine.losses}패`} />
          <div className="header-actions">
            <div className="tp-pill" aria-label={`훈련 포인트 ${profile.trainingPoints}`}><Zap size={13} fill="currentColor" /><strong>{compactTP(profile.trainingPoints)}</strong>{tpPop && <em key={tpPop.key} className="tp-pop">+{tpPop.n}</em>}</div>
            <button className="icon-button" onClick={() => openPanel('career')} aria-label="커리어 기록실"><Trophy size={17} /></button>
            <button className="icon-button train" onClick={() => { setTrainingPitch(selected); openPanel('training') }} aria-label="훈련실"><Activity size={17} /></button>
            <button className="icon-button" onClick={() => setSoundOn(!soundOn)} aria-label={soundOn ? '소리 끄기' : '소리 켜기'}>{soundOn ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
            <button className="icon-button" onClick={() => openPanel('help')} aria-label="도움말"><CircleHelp size={17} /></button>
          </div>
        </header>

        <div className="tier-banner" aria-label={`현재 리그: ${league.label}`}><b>{league.short}</b><span>{league.label}</span><em>TP ×{league.tp.toFixed(1)}</em></div>

        <div className="arcade-ribbon">
          <button disabled={phase !== 'ready' || Boolean(summary) || hook} onClick={() => openPanel('mission')}><span>등판 목표</span><b>{mission ? `${mission.title} ${arcade.progress}/${mission.goal}${arcade.completed ? ' ✓' : ''}` : game.pitches ? '이번 등판 목표 없음' : '오늘의 도전 선택 →'}</b></button>
          <button disabled={phase === 'flying' || phase === 'charging'} onClick={() => openPanel('challenge')}><span>QUICK PLAY</span><b>챌린지 ↗</b></button>
        </div>
        <div className="scorebug">
          <div className="teams">
            <div><i style={{ background: team.color }} /><span>{team.short}</span><b>{game.runsAgainst}</b></div>
            <div><i style={{ background: 'var(--amber)' }} /><span>ACE</span><b>{game.runsFor}</b></div>
          </div>
          <div className="inning-box"><span>▲</span><b>{game.inning}</b></div>
          <Bases bases={game.bases} />
          <div className="count-box" aria-label={`볼 ${game.balls} 스트라이크 ${game.strikes} 아웃 ${game.outs}`}>
            <div className="dots"><span>B</span>{[0, 1, 2].map(i => <i key={i} className={i < game.balls ? 'b on' : 'b'} />)}</div>
            <div className="dots"><span>S</span>{[0, 1].map(i => <i key={i} className={i < game.strikes ? 's on' : 's'} />)}</div>
            <div className="dots"><span>O</span>{[0, 1].map(i => <i key={i} className={i < game.outs ? 'o on' : 'o'} />)}</div>
          </div>
          <div className="pc-box" aria-label={`투구 수 ${game.pitches}, 체력 ${Math.round(profile.stamina)}`}>
            <span>P {game.pitches}</span>
            <div className={`stamina ${profile.stamina < STAMINA.hookAt ? 'low' : profile.stamina < 50 ? 'mid' : ''}`}><i style={{ width: `${profile.stamina}%` }} /></div>
            <small>{Math.round(profile.stamina)}</small>
          </div>
        </div>

        <section className="stadium-card">
          <canvas ref={canvasRef} className="stadium-canvas" onPointerDown={aim} aria-label="스트라이크 존. 터치해서 코스를 고르세요." />
          <div className={`batter-card ${side === 'R' ? 'left' : 'right'}`}>
            <div className="batter-top"><span className="order">{batter.order}</span><strong>{batter.name}</strong><span className={`hand hand-${side}`}>{handLabel}</span></div>
            <div className="batter-line">{batter.id.startsWith('rival-') && <em className="rival-label">RIVAL · </em>}{batter.avg.toFixed(3).slice(1)} · {batter.hr}HR{prior.length > 0 && <em> · {prior.length + 1}번째 대결</em>}</div>
            <div className={`mood mood-${mood.toLowerCase()}`} aria-label={`타자 기세: ${MOOD_LABEL[mood]}`}><span><i style={{ left: `${(confidence + 1) * 50}%` }} /></span><b>{MOOD_LABEL[mood]}</b></div>
            <div className="scout-line"><Eye size={10} /> {report[prior.length ? Math.min(2, report.length - 1) : 0]}</div>
          </div>
          <div className={`mind-chip ${side === 'R' ? 'right' : 'left'}`}>
            <span>{matchup}</span>
            <b>{batterMindset({ balls: game.balls, strikes: game.strikes, seenTypes: seenRef.current.types })}</b>
          </div>
          {leverage && <div className="leverage">{leverage}</div>}
          <div className="stage-toggles">
            {prior.length > 0 && <button className={showMemory ? 'chip-toggle on memory' : 'chip-toggle'} onClick={() => setShowMemory(!showMemory)} aria-pressed={showMemory}><History size={12} /> 지난 타석</button>}
            <button className={scout ? 'chip-toggle on heat' : 'chip-toggle'} onClick={() => setScout(!scout)} aria-pressed={scout}><Flame size={12} /> 핫존</button>
          </div>
          {showingMemory && phase === 'ready' && <div className="memory-banner" aria-label="지난 타석 기록">{prior.map((pa, i) => <div key={i}><small>{pa.inning}회</small><PaChips pitches={pa.pitches} /><b>{pa.result}</b></div>)}</div>}
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
          <div className="pitch-tactics">
            <div className="effort-switch" aria-label="투구 강도">{(['normal', 'power'] as const).map(mode => <button key={mode} aria-pressed={effort === mode} disabled={phase !== 'ready'} onClick={() => setEffort(mode)}>{mode === 'normal' ? '안정' : '전력 +3km'}</button>)}</div>
            <button className={`focus-trigger ${focused ? 'armed' : ''}`} disabled={arcade.focus < 100 || phase !== 'ready'} aria-pressed={focused} onClick={() => setFocused(v => !v)}><i style={{ width: `${arcade.focus}%` }} /><span>{focused ? '집중 장전 ✓' : arcade.focus >= 100 ? '집중 투구 사용' : `집중 ${arcade.focus}%`}</span></button>
          </div>
          <p className="tactics-hint">{focused ? '다음 한 공 · 느린 미터 + PERFECT 제구 강화' : effort === 'power' ? '빠른 미터 · 탄착 분산 +30% · 체력 추가 소모 1.2' : '배합 성공과 아웃으로 집중 충전 · 100%에서 사용'}</p>
          <div className={`callout tone-${callout.tone}`} aria-live="polite"><b>{phase === 'charging' ? 'RELEASE' : callout.main}</b><span>{phase === 'charging' ? '황금 구간에서 탭 · 빨간 구간은 실투' : callout.sub}</span></div>
          {preview && phase !== 'charging' && <div className="metrics">
            <span title="익스텐션 반영 체감 구속"><small>체감</small>{preview.perceivedSpeed.toFixed(1)}</span>
            <span title="유도 수직 무브먼트"><small>IVB</small>{preview.ivb > 0 ? '+' : ''}{preview.ivb}cm</span>
            <span title="수직 진입각"><small>VAA</small>{preview.vaa.toFixed(1)}°</span>
            {tunnel.score > .3 && <em className="badge tunnel">{tunnel.pair ? 'HI-LO ' : ''}TUNNEL {Math.round(tunnel.score * 100)}</em>}
            {readRisk > .35 && <em className="badge read">읽힘 {Math.round(readRisk * 100)}%</em>}
          </div>}
          <div ref={gaugeElRef} className="gauge" aria-hidden="true">
            <div className="gauge-danger" style={{ left: 0, width: pct(dangerLeft) }} />
            {dangerRight < 1 && <div className="gauge-danger" style={{ left: pct(dangerRight), right: 0 }} />}
            <div className="gauge-good" style={{ left: pct(goodL), width: pct(goodR - goodL) }} />
            <div className="gauge-sweet" style={{ left: pct(SWEET_CENTER - half), width: pct(half * 2) }} />
            <div ref={gaugeFillRef} className="gauge-fill" />
            <div ref={gaugeNeedleRef} className="gauge-needle" />
            <span className="gauge-bang" style={{ left: `calc(${pct(dangerLeft)} / 2)` }}>!</span>
          </div>
          <button className={`pitch-button ${phase === 'charging' ? 'charging' : ''}`} onClick={e => { e.currentTarget.blur(); tapMeter() }} disabled={!canPitch}>
            {phase === 'flying' ? '…' : phase === 'charging' ? '릴리스!' : phase === 'result' ? '다음 공 준비' : <>투구 <small>{pitch.short} · {statSpeed(pitch, stat).toFixed(0)}km</small></>}
          </button>
        </section>
      </main>

      <aside className="side-panel scout-panel" aria-label="스카우팅 리포트">
        <div className="panel-card">
          <span className="eyebrow">SCOUTING REPORT</span>
          <h2>{batter.order}번 {batter.name} <small>{handLabel}</small></h2>
          <p className="muted">{batter.avg.toFixed(3).slice(1)} · {batter.hr}HR · {ZONE_LABEL[batter.zone]}{batter.weakness !== 'NONE' ? ` · ${WEAK_LABEL[batter.weakness]}` : ''}</p>
          {batter.id.startsWith('rival-') && <p className="rival-note">{['끈질긴 교타자', '초구를 노리는 장타자', '냉정한 선구안'][Number(batter.id.split('-').at(-1))]} · {game.rivalArchive?.[batter.id]?.length ? `지난 경기: ${game.rivalArchive[batter.id].map(pa => pa.result).join(' / ')}` : '첫 라이벌 대결'}</p>}
          <ul className="report">{report.map(n => <li key={n}>{n}</li>)}</ul>
          <div className={`mood wide mood-${mood.toLowerCase()}`}><span><i style={{ left: `${(confidence + 1) * 50}%` }} /></span><b>{MOOD_LABEL[mood]}</b></div>
        </div>
        <div className="panel-card">
          <span className="eyebrow">AT-BAT HISTORY</span>
          {prior.length === 0 ? <p className="muted">첫 대결입니다. 같은 구종·같은 코스를 반복하면 다음 타석에서 읽힙니다.</p>
            : <ul className="pa-list">{prior.map((pa, i) => <li key={i}><small>{pa.inning}회 · {i + 1}타석</small><PaChips pitches={pa.pitches} /><b>{pa.result}</b></li>)}</ul>}
          <p className="muted small">현재 타석</p>
          <PaChips pitches={game.abLog} />
        </div>
      </aside>
    </div>

    {summary && panel === 'none' && <div className="overlay"><section className="sheet inning-sheet" role="dialog" aria-modal="true" aria-label={seasonDone ? 'Season Summary' : summary.finished ? 'Game Summary' : 'Inning Summary'}>
      <span className="eyebrow">{summary.finished ? `FINAL · ${league.short} · ${DECISION_LABEL[pitcherDecision(game)]}` : `${summary.inning}회 종료`}</span>
      <h1>{summary.finished && gameFeat(game) && gameFeat(game) !== '완투' ? `${gameFeat(game)}!` : summary.finished === 'WIN' ? (game.saveOpp ? '세이브 상황 사수!' : '승리!') : summary.finished === 'LOSS' ? '패전…' : summary.finished === 'TIE' ? '무승부' : summary.allowed === 0 ? (summary.clean ? '삼자범퇴' : '무실점') : `${summary.allowed}실점`}</h1>
      <div className="table-scroll"><table className="linescore"><thead><tr><th />{game.lineScore.slice(0, summary.inning).map((_, i) => <th key={i}>{i + 1}</th>)}<th>R</th></tr></thead>
        <tbody><tr><td>{team.short}</td>{game.lineScore.slice(0, summary.inning).map((n, i) => <td key={i}>{n}</td>)}<td><b>{game.runsAgainst}</b></td></tr>
          <tr><td>ACE</td>{game.lineScore.slice(0, summary.inning).map((_, i) => <td key={i}>{summary.finished === 'WIN' && summary.ours === 0 && i === summary.inning - 1 && summary.inning >= 9 ? 'X' : game.ourScore[i] ?? ''}</td>)}<td><b>{game.runsFor}</b></td></tr></tbody></table></div>
      {!summary.finished && <p className="inning-note">{summary.ours ? `우리 타선 ${summary.ours}점 지원!` : '우리 타선 침묵.'}{summary.clean ? '  클린 이닝 보너스 +TP' : ''}</p>}
      {!summary.finished && summary.immaculate && <p className="special-tp">무결점 이닝 · 9구 3삼진 <b>+{Math.round(SPECIAL_TP.immaculate * league.tp * aging.tpMul)} TP</b></p>}
      {summary.finished && (gameFeat(game) || (game.feats ?? []).length > 0) && <p className="special-tp">{[...(game.feats ?? []), gameFeat(game)].filter(Boolean).join(' · ')}{gameFeat(game) && <b> +{Math.round(FEAT_TP[gameFeat(game)!] * league.tp * aging.tpMul)} TP</b>}</p>}
      {summary.finished && game.pulled && <p className="inning-note">{formatIP(game.totalOuts)}이닝 후 강판 · 불펜 {game.bullpenRuns}실점 · 교체 시점 {game.exitLead > 0 ? `${game.exitLead}점 리드` : game.exitLead < 0 ? `${-game.exitLead}점 열세` : '동점'}</p>}
      {summary.finished && <div className="performance-card"><span>YOUR PERFORMANCE</span><strong>개인 활약 +{Math.round(performanceBonus(game) * league.tp * aging.tpMul)} TP</strong><small>기술 보상 {arcade.points} TP (기본값) · {arcade.completed ? '등판 목표 달성' : '다음 등판에서 다시 도전'}</small></div>}
      {summary.finished && <p className="fatigue-note">다음 등판 시작 체력 <b>{100 - fatigueAfter(game, profile.stamina)}</b>{fatigueAfter(game, profile.stamina) > 0 ? ' · 혹사 여파' : ' · 정상 휴식'}</p>}
      {summary.finished && <p className="inning-note">{formatIP(game.totalOuts)} IP · {game.strikeouts}K · {game.hits}피안타 · {game.homeRuns ?? 0}HR · {game.walks}볼넷 · {game.pitches}구</p>}
      {summary.finished && <><PitchChart pitches={game.pitchLog} /><div className="season-stats">{Object.entries(seasonRates(seasonView)).slice(0, 4).map(([k, v]) => <div key={k}><small>{k}</small><strong>{v}</strong></div>)}</div><p>Season {season.number} · {seasonView.games}/{seasonView.scheduled} games · {seasonView.wins}W–{seasonView.losses}L{seasonView.saves ? ` · ${seasonView.saves}SV` : ''}</p>
        {seasonDone && <h2 className="season-title">Season Summary · {league.label}</h2>}
        {seasonDone && (seasonAwards(seasonView).length > 0 || (seasonView.feats ?? []).length > 0) && <ul className="award-list big">{seasonAwards(seasonView).map(a => <li key={a} className="award"><Trophy size={14} /> {a}</li>)}{(seasonView.feats ?? []).map(f => <li key={f} className="feat"><Sparkles size={13} /> {f}</li>)}</ul>}
        {seasonDone && seasonAwards(seasonView).length === 0 && <p className="age-hint">이번 시즌 수상 없음 · 리그별 수상 기준은 커리어 기록실에서 확인</p>}
        <PromotionCard season={seasonView} done={seasonDone} /></>}
      {!summary.finished ? <button className="primary-button" onClick={() => continueGame()}>{summary.inning + 1}회 초 등판 <ArrowRight size={18} /></button>
        : seasonDone && retireStat.forced ? <><p className="retire-note">{RETIRE_LABEL[retireStat.forced]} — {retireStat.forced === 'AGE' ? `${profile.age}세, 몸이 더는 버티지 못합니다.` : `${profile.age}세까지 프로 계약을 따내지 못했습니다.`}</p><button className="primary-button" onClick={() => retire(retireStat.forced!)}>은퇴식 <ArrowRight size={18} /></button></>
        : seasonDone ? (promo.demote ? <button className="primary-button" onClick={() => continueGame('demote')}>강등 → {TIERS[game.tier - 1].label} <ArrowRight size={18} /></button>
          : promo.canPromote ? <><button className="primary-button" onClick={() => continueGame('promote')}>승격 → {TIERS[game.tier + 1].label} <ArrowRight size={18} /></button><button className="secondary-button" onClick={() => continueGame('repeat')}>현재 리그 잔류</button></>
          : <button className="primary-button" onClick={() => continueGame('repeat')}>{league.short} 새 시즌 <ArrowRight size={18} /></button>)
        : promo.callUp ? <><button className="primary-button" onClick={() => continueGame('callup')}>콜업 수락 → {TIERS[game.tier + 1].label} <ArrowRight size={18} /></button><button className="secondary-button" onClick={() => continueGame()}>잔류하고 다음 경기</button></>
        : <button className="primary-button" onClick={() => continueGame()}>다음 경기 <ArrowRight size={18} /></button>}
      {summary.finished && seasonDone && !retireStat.forced && profile.age >= AGE.voluntary && <button className="secondary-button danger" onClick={() => retire('VOLUNTARY')}>여기서 은퇴 <small>{profile.age}세 · 커리어를 역대 선수에 기록</small></button>}
      {summary.finished && seasonDone && !retireStat.forced && <p className="age-hint">다음 시즌 {profile.age + 1}세 · {ageStage(profile.age + 1)}{season.tier === 0 && profile.age + 1 >= AGE.amateurDeadline ? ` · ${AGE.amateurDeadline}세 시즌까지 프로 입성 못 하면 은퇴` : ''}{profile.age + 1 >= 38 ? ` · ${AGE.forceRetire}세 강제 은퇴` : ''}</p>}
      {summary.finished && <div className="sheet-actions"><button className="secondary-button" onClick={() => openPanel('training')}><Zap size={15} /> 구종 강화</button><button className="secondary-button" onClick={() => openPanel('career')}>커리어 기록실</button></div>}
    </section></div>}

    {hook && !summary && panel === 'none' && <div className="overlay"><section className="sheet hook-sheet" role="alertdialog" aria-modal="true" aria-label="교체 신호">
      <span className="eyebrow">MOUND VISIT</span>
      <h1>감독이 올라옵니다</h1>
      <div className="hook-stats">
        <div><small>체력</small><b className={profile.stamina < STAMINA.hookAt ? 'danger' : ''}>{Math.round(profile.stamina)}</b></div>
        <div><small>투구 수</small><b>{game.pitches}</b></div>
        <div><small>이닝</small><b>{formatIP(game.totalOuts)}</b></div>
        <div><small>점수</small><b>{game.runsFor}:{game.runsAgainst}</b></div>
      </div>
      <p>체력이 떨어지면 구속이 빠지고 탄착이 퍼집니다. 무리하면 <b>다음 경기 시작 체력</b>이 깎입니다 (현재 예상 {100 - fatigueAfter(game, profile.stamina)}). 교체되면 이 경기 등판은 끝나고 결과 정리 → 다음 경기 / 구종 강화로 넘어갑니다. 5이닝 이상 + 리드 상태로 내려가야 승리 요건입니다.</p>
      <button className="primary-button" onClick={takeHook}>공 넘기기 · 등판 종료 <ArrowRight size={18} /></button>
      {canRefuseHook(game)
        ? <button className="secondary-button danger" onClick={refuseHook}>한 타자만 더! <small>경기당 1번만 거부 가능 · 다음 경기 피로 +6</small></button>
        : <p className="hook-final">이미 한 번 버텼습니다. 이번엔 공을 넘겨야 합니다.</p>}
    </section></div>}
    {!profile.created && <Creator initialProfile={profile} unlockedTier={unlockedTier} legacyBonus={legacyBonus(legacy)} legacyCount={legacy.length} onSave={(p, tier) => { setProfile({ ...p, age: START_AGE[tier], startAge: START_AGE[tier], trainingPoints: p.trainingPoints + legacyBonus(legacy) }); const first = PITCHES.find(def => p.arsenal[def.id].unlocked)!.id; setSelected(first); setTrainingPitch(first); setSeason({ ...newSeason(tier), age: START_AGE[tier] }); setHistory([]); setGame(newGame(undefined, tier)) }} editing={false} />}
    {panel === 'profile' && profile.created && <Creator initialProfile={profile} onSave={p => { setProfile(p); setPanel('career') }} editing onClose={() => setPanel('career')} />}
    {panel === 'career' && <CareerHub profile={profile} history={history} current={seasonView} onClose={() => setPanel('none')} onEdit={() => setPanel('profile')}
      onLegacy={() => setPanel('legacy')} legacyCount={legacy.length} onRetire={retireStat.canRetire && phase !== 'flying' ? () => retire('VOLUNTARY') : null} />}
    {panel === 'legacy' && <LegacyHall legacy={legacy} onClose={() => setPanel(profile.created ? 'career' : 'none')} />}
    {retired && <RetirementSheet player={retired} legacy={legacy} onNext={() => { resetAll(); setRetired(null) }} />}
    {panel === 'challenge' && <Challenge onClose={() => setPanel('none')} />}
    {panel === 'mission' && <div className="overlay"><section className="sheet" role="dialog" aria-modal="true" aria-label="등판 목표"><div className="sheet-top"><span className="eyebrow">START WITH A PURPOSE</span><button className="secondary-button" onClick={() => setPanel('none')}>닫기</button></div><h1>오늘은 어떤 에이스?</h1><p className="muted">첫 투구 전에 하나 선택 · 달성 +60 TP × 리그·나이 배율 · 실패 페널티 없음</p><div className="challenge-grid">{MISSIONS.map(m => <button key={m.id} disabled={game.pitches > 0 || (m.id === 'variety' && unlocked.length < 2)} aria-pressed={arcade.mission === m.id} onClick={() => { setGame(g => ({ ...g, arcade: { ...(g.arcade ?? freshArcade()), mission: m.id } })); setPanel('none') }}><strong>{m.title}</strong><span>{m.text}</span><small>{m.id === 'variety' && unlocked.length < 2 ? '구종 2개 해금 필요' : arcade.mission === m.id ? '선택됨' : '도전 선택'}</small></button>)}</div>{game.pitches > 0 && <p>이미 시작한 등판의 목표는 변경할 수 없습니다.</p>}</section></div>}
    {panel === 'training' && <div className="overlay" onPointerDown={e => { if (e.target === e.currentTarget) setPanel('none') }}><section className="sheet training-sheet" role="dialog" aria-modal="true" aria-label="훈련실">
      <div className="sheet-top"><span className="eyebrow">PITCH LAB</span><button className="icon-button" onClick={() => setPanel('none')} aria-label="닫기"><ArrowLeft size={18} /></button></div>
      <div className="sheet-title"><h1>훈련실</h1><div className="tp-large"><Zap size={16} fill="currentColor" /> {profile.trainingPoints} <small>TP</small></div></div>
      <div className="training-tabs">{PITCHES.map(p => <button key={p.id} className={trainingPitch === p.id ? 'active' : ''} onClick={() => setTrainingPitch(p.id)}>{p.short}{!profile.arsenal[p.id].unlocked && <LockKeyhole size={10} />}</button>)}</div>
      {(() => {
        const p = pitchById(trainingPitch), s = profile.arsenal[trainingPitch]
        const moveCm = (Math.hypot(p.moveX, p.moveY) * breakScale(s.breakLevel)).toFixed(1)
        return <>
          <div className="training-feature" style={{ '--pitch-color': p.color } as CSSProperties}><span className="feature-orb">⚾</span><div><small>{p.family} · {s.unlocked ? `숙련 Lv.${masteryLevel(s.mastery)}` : 'LOCKED'}</small><h2>{p.name}</h2><p>{p.description}</p></div><b>{s.unlocked ? statSpeed(p, s).toFixed(1) : '–'} <small>KM/H · {moveCm}CM</small></b></div>
          {s.unlocked && <div className="trait-picker"><span className="eyebrow">MASTERY / 숙련 Lv.4 해금</span><p>{s.mastery < 225 ? `특성까지 ${225 - s.mastery} XP` : '구종당 특성 하나 · 등판 사이에 자유롭게 변경'}</p><div>{(['command', 'signature'] as const).map(trait => <button key={trait} aria-pressed={traitActive(s) === trait} disabled={s.mastery < 225 || (game.pitches > 0 && !game.over)} onClick={() => setProfile(p => ({ ...p, arsenal: { ...p.arsenal, [trainingPitch]: { ...p.arsenal[trainingPitch], trait } } }))}><strong>{trait === 'command' ? '핀포인트' : '시그니처'}</strong><small>{trait === 'command' ? '기본 탄착 분산 20% 감소' : signatureText(trainingPitch)}</small></button>)}</div></div>}
          {s.unlocked ? <div className="upgrade-list">{(['velocityLevel', 'controlLevel', 'breakLevel'] as StatKey[]).map(key => {
            const level = s[key], cost = upgradeCost(level), isMax = level >= 99
            return <div className="upgrade-row" key={key}><div className="upgrade-icon">{key === 'velocityLevel' ? <Zap size={18} /> : key === 'controlLevel' ? <Crosshair size={18} /> : <Sparkles size={18} />}</div><div className="upgrade-info"><div><strong>{LABELS[key].label}</strong><span>LV.{level}</span></div><small>{isMax ? '최고 단계' : key === 'velocityLevel' ? `${statSpeed(p, s).toFixed(1)} → ${statSpeed(p, { ...s, velocityLevel: level + 1 }).toFixed(1)} km/h` : key === 'controlLevel' ? `PERFECT ${(sweetSpot(level) * 100).toFixed(1)} → ${(sweetSpot(level + 1) * 100).toFixed(1)}%` : `변화량 ${moveCm} → ${(Math.hypot(p.moveX, p.moveY) * breakScale(level + 1)).toFixed(1)} cm`} · {LABELS[key].hint}</small><div className="upgrade-track"><span style={{ width: `${level}%` }} /></div></div><button aria-label={`${LABELS[key].label} 강화 ${cost} TP`} onClick={() => upgrade(key)} disabled={isMax || profile.trainingPoints < cost}>{isMax ? 'MAX' : <>{cost} <Zap size={12} fill="currentColor" /></>}</button></div>
          })}</div> : <div className="unlock-area"><LockKeyhole size={22} /><p>새 무기를 장착하세요.</p><button className="primary-button" disabled={profile.trainingPoints < p.unlockCost} onClick={unlock}>{p.unlockCost} TP 해금 <ArrowRight size={17} /></button></div>}
        </>
      })()}
      <div className="velocity-lab"><span className="eyebrow">VELOCITY MAP / 구속 분포</span><p>현재 보유 구종의 기본 구속 · 기준 구속과의 간격을 함께 보세요.</p>{PITCHES.filter(d => profile.arsenal[d.id].unlocked).map(d => { const speed = statSpeed(d, profile.arsenal[d.id]); return <div key={d.id}><span>{d.short}</span><i><b style={{ width: `${(speed - 90) / 85 * 100}%`, background: d.color }} /></i><strong>{speed.toFixed(1)}</strong><small>{(speed - fastest).toFixed(1)} km</small></div> })}<p>큰 차이도 구종을 읽히면 적응합니다. 파울은 구속 차이만으로 결정되지 않으며, 체인지업은 빨라질수록 직구와의 간격이 줄 수 있습니다.</p></div>
      <div className="training-foot"><span>LV.{pitcherLevel(profile)} · 통산 {careerLine.strikeouts}K · {formatIP(careerLine.outs)}이닝</span></div>
    </section></div>}
    {panel === 'help' && <div className="overlay" onPointerDown={e => { if (e.target === e.currentTarget) setPanel('none') }}><section className="sheet help-sheet" role="dialog" aria-modal="true" aria-label="승부의 기술">
      <div className="sheet-top"><span className="eyebrow">SCOUTING NOTES</span><button className="icon-button" onClick={() => setPanel('none')} aria-label="닫기"><ArrowLeft size={18} /></button></div>
      <h1>승부의 기술</h1>
      <div className="help-step"><b>01</b><div><strong>릴리스 타이밍</strong><p>황금 구간 한가운데일수록 탄착이 모입니다. 구간을 벗어난 만큼 퍼지고, 빨간 구간이나 정점 이후에 놓치면 <em>!</em> 실투 — 한가운데 행잉볼이 됩니다.</p></div></div>
      <div className="help-step"><b>02</b><div><strong>타자는 기억한다</strong><p>두 번째·세 번째 대결에서 같은 구종·같은 코스를 반복하면 타자가 노리고 들어옵니다. 존 위의 ◆ 표시가 지난 타석 투구입니다.</p></div></div>
      <div className="help-step"><b>03</b><div><strong>IVB · VAA · 피치 터널</strong><p>큰 키·오버핸드는 포심 IVB와 다운힐 플레인을 키워 하이 패스트볼이 떠오르는 것처럼 보입니다. 하이 포심 뒤 같은 길로 오다 떨어지는 공은 <em>HI-LO TUNNEL</em>.</p></div></div>
      <div className="help-step"><b>04</b><div><strong>기세와 스카우팅</strong><p>헛스윙·삼진이 쌓인 타자는 조급해져 유인구에 더 손이 나가고, 안타를 친 타자는 감을 잡습니다. 타자 카드의 한 줄 리포트를 확인하세요.</p></div></div>
      <div className="help-options">
        <button onClick={() => setShowZone(!showZone)}><Settings2 size={16} /> 스트라이크 존 선 <span>{showZone ? 'ON' : 'OFF'}</span></button>
        <button className={resetArmed ? 'reset-confirm' : ''} onClick={() => { if (resetArmed) resetAll(); else setResetArmed(true) }}><RotateCcw size={16} /> {resetArmed ? '한 번 더 누르면 기록 삭제 (리그 해금은 유지)' : '새 선수로 시작'} <span>{resetArmed ? '확인' : 'RESET'}</span></button>
      </div>
      <button className="primary-button" onClick={() => { setResetArmed(false); setPanel('none') }}>마운드로 <Check size={18} /></button>
    </section></div>}
  </div>
}

export default App
