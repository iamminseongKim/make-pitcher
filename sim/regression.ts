import './arcade-regression'
import './commute-regression'
import assert from 'node:assert/strict'
import {
  PITCHES, createFlight, createPreviewFlight, defaultProfile, pointOnFlight, newGame, applyOutcome, closeInning, loadSave, SAVE_KEY, resolvePitch,
  releaseQuality, SWEET_CENTER, sweetSpot, batterAdaptation, batterPlan, tunnelRead, extensionOf, releaseHeightOf, zoneCell, scoutingReport, batterSide, HITS,
  physiqueCost, staminaCost, needsHook, canRefuseHook, fatigueAfter, bullpenFinish, pitcherDecision, STAMINA,
  type PitchFlight, type PitchResult, type PlateAppearance, type PitchLog, type AtBatContext,
} from '../src/game'
import { newSeason, recordGame, seasonRates, TIERS, aggregate, formatIP, serviceTime, normalizeSeason, promotionStatus, callUpSchedule, seasonDone, PROMOTION_ERA, loadUnlockedTier, saveUnlockedTier, UNLOCK_KEY } from '../src/season'
import { chartGeometry } from '../src/PitchChart'
import { canvasToZone } from '../src/render'
import { ageEffects, retirementStatus, hallOfFame, buildRetired, legacyBonus, loadLegacy, saveLegacy, LEGACY_KEY, START_AGE } from '../src/retirement'
import { seasonAwards, gameFeat, trophyCase } from '../src/season'
;(globalThis as any).performance ??= { now: () => Date.now() }

const seeded = (seed: number) => { Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return (seed + 1) / 4294967297 } }
const original = Math.random
const p = defaultProfile()

/* ── Continuous physics for every pitch / slot / hand / level ── */
for (const hand of ['R', 'L'] as const) for (const slot of ['OVERHAND', 'THREE_QUARTER', 'SIDEARM', 'SUBMARINE'] as const) for (const d of PITCHES) for (const level of [1, 50, 99]) {
  p.hand = hand; p.armSlot = slot
  const f = createPreviewFlight(d, { unlocked: true, velocityLevel: level, controlLevel: level, breakLevel: level, mastery: 0 }, p, { x: .8, y: .9 })
  assert.deepEqual(pointOnFlight(f, 0), { ...f.release, z: 18.44 })
  assert(Math.abs(pointOnFlight(f, 1).x - .8) < 1e-10)
  assert(Math.abs(pointOnFlight(f, 1).y - .9) < 1e-10)
  for (let t = .01; t < .99; t += .01) {
    const a = pointOnFlight(f, t - .0001), b = pointOnFlight(f, t), c = pointOnFlight(f, t + .0001)
    assert(Math.hypot(c.x - 2 * b.x + a.x, c.y - 2 * b.y + a.y) < .000001)
  }
  assert(Number.isFinite(f.vaa) && f.vaa < 0, 'VAA is a descending angle')
}
p.hand = 'R'; p.armSlot = 'THREE_QUARTER'

/* ── Pitch silhouettes: smooth paths with distinct, handed movement ── */
{
  const stat = { unlocked: true, velocityLevel: 50, controlLevel: 50, breakLevel: 50, mastery: 0 }
  const right = { ...defaultProfile(), hand: 'R' as const, armSlot: 'OVERHAND' as const }
  const left = { ...right, hand: 'L' as const }
  const path = (id: typeof PITCHES[number]['id'], profile = right, level = 50) => {
    const flight = createPreviewFlight(PITCHES.find(d => d.id === id)!, { ...stat, breakLevel: level }, profile, { x: 0, y: 0 })
    const p = pointOnFlight(flight, .72)
    return { flight, p, linearX: flight.release.x * .28, linearY: flight.release.y * .28 }
  }
  const sinker = path('SINKER'), cutter = path('CUTTER'), curve = path('CURVE'), four = path('FOUR_SEAM')
  assert(sinker.p.x - sinker.linearX > .05 && cutter.p.x - cutter.linearX < -.05, 'sinker and cutter peel in opposite directions')
  assert(path('SINKER', left).p.x - path('SINKER', left).linearX < -.05, 'arm-side run mirrors for a lefty')
  assert(curve.p.y - curve.linearY < four.p.y - four.linearY - .25, 'curve has a clear vertical drop')
  assert(Math.abs(path('SLIDER').p.x - path('SLIDER').linearX) > Math.abs(cutter.p.x - cutter.linearX), 'slider sweeps farther than cutter')
  assert(Math.abs(path('SLIDER', right, 99).p.x - path('SLIDER', right, 99).linearX) > Math.abs(path('SLIDER', right, 1).p.x - path('SLIDER', right, 1).linearX), 'movement stat strengthens the same shape')
  for (const level of [1, 50, 99]) {
    const rh = path('SINKER', { ...right, armSlot: 'THREE_QUARTER' }, level).flight
    const lh = path('SINKER', { ...left, armSlot: 'THREE_QUARTER' }, level).flight
    assert(pointOnFlight(rh, .8).x > pointOnFlight(rh, .95).x && pointOnFlight(rh, .95).x > pointOnFlight(rh, 1).x, 'righty sinker finishes arm-side')
    assert(pointOnFlight(lh, .8).x < pointOnFlight(lh, .95).x && pointOnFlight(lh, .95).x < pointOnFlight(lh, 1).x, 'lefty sinker mirrors the finish')
  }
  for (const batter of ['R', 'L'] as const) for (const pitcher of ['R', 'L'] as const) {
    const cx = 210 + (batter === 'R' ? -6 : 6) + (pitcher === 'R' ? 3 : -3)
    const aim = canvasToZone('broadcast', cx, 200, batter, pitcher)
    assert(Math.abs(aim.x) < 1e-10 && aim.y === 0, 'aim follows both hands')
  }
}

/* ── Release meter: strict, continuous dispersion and critical miss ── */
{
  const lvl = 30, half = sweetSpot(lvl) / 2
  const center = releaseQuality(SWEET_CENTER, lvl)
  assert.equal(center.grade, 'PERFECT'); assert(center.spreadMul <= .1 + 1e-9)
  let last = -1
  for (let e = 0; e <= .3; e += .01) { const q = releaseQuality(SWEET_CENTER - e, lvl); assert(q.spreadMul >= last - 1e-9, 'spread grows with distance from sweet spot'); last = q.spreadMul }
  assert.equal(releaseQuality(SWEET_CENTER - half - .03, lvl).grade, 'GOOD')
  assert.equal(releaseQuality(SWEET_CENTER - half - .1, lvl).grade, 'EARLY')
  assert.equal(releaseQuality(SWEET_CENTER - half - .15, lvl).meatball, true)
  assert.equal(releaseQuality(1.5, lvl).meatball, true, 'late release on the return sweep hangs')
  assert.equal(releaseQuality(2, lvl).meatball, true, 'meter timeout hangs')
  assert(sweetSpot(99) > sweetSpot(1))
  // Meatballs drift over the heart of the plate regardless of target.
  seeded(3)
  const stat = { unlocked: true, velocityLevel: 30, controlLevel: 30, breakLevel: 30, mastery: 0 }
  let middle = 0
  for (let i = 0; i < 400; i++) { const f = createFlight(PITCHES[5], stat, p, { x: 1.3, y: 1.3 }, 1.6); assert(f.meatball); if (Math.abs(f.landing.x) < .5 && Math.abs(f.landing.y) < .5) middle++ }
  assert(middle > 330, `meatballs land middle (${middle}/400)`)
  // Perfect release spreads far less than a poor one.
  const spreadOf = (meter: number) => { let s = 0; for (let i = 0; i < 400; i++) { const f = createFlight(PITCHES[0], stat, p, { x: .5, y: .5 }, meter); s += Math.hypot(f.landing.x - .5, f.landing.y - .5) } return s / 400 }
  assert(spreadOf(SWEET_CENTER) * 3 < spreadOf(SWEET_CENTER - half - .09))
  Math.random = original
}

/* ── Physique: height, slot, extension, IVB, VAA ── */
{
  const tall = { ...defaultProfile(), height: 205, armSlot: 'OVERHAND' as const }, short = { ...defaultProfile(), height: 170, armSlot: 'SIDEARM' as const }
  const stat = { unlocked: true, velocityLevel: 50, controlLevel: 50, breakLevel: 50, mastery: 0 }
  const ft = createPreviewFlight(PITCHES[0], stat, tall, { x: 0, y: -.9 }), fs = createPreviewFlight(PITCHES[0], stat, short, { x: 0, y: -.9 })
  assert(extensionOf(tall) > extensionOf(short)); assert(releaseHeightOf(tall) > releaseHeightOf(short))
  assert(ft.ivb > fs.ivb + 10, 'over-the-top tall pitcher rides the four-seamer')
  assert(ft.perceivedSpeed > ft.speed && ft.duration < fs.duration, 'extension shortens the hitter\'s clock')
  const high = createPreviewFlight(PITCHES[0], stat, tall, { x: 0, y: -.9 }), low = createPreviewFlight(PITCHES[0], stat, tall, { x: 0, y: .9 })
  assert(high.vaa > low.vaa, 'high fastballs arrive flatter than low ones')
  assert(ft.vaa > -7 && ft.vaa < -2, `plausible VAA (${ft.vaa})`)
}

/* ── Physique trade-offs: tall = worse command & stamina, compact = better ── */
{
  assert.deepEqual(physiqueCost(183), { commandMul: 1, staminaMul: 1 })
  assert(physiqueCost(208).commandMul > 1.25 && physiqueCost(208).staminaMul > 1.15)
  assert(physiqueCost(165).commandMul < 1 && physiqueCost(165).staminaMul < 1)
  const calm = newGame()
  assert(staminaCost(SWEET_CENTER, calm, 208) > staminaCost(SWEET_CENTER, calm, 183))
  seeded(5)
  const stat = { unlocked: true, velocityLevel: 40, controlLevel: 40, breakLevel: 40, mastery: 0 }
  const spread = (height: number) => { let d = 0; for (let i = 0; i < 2000; i++) { const fl = createFlight(PITCHES[0], stat, { ...defaultProfile(), height }, { x: .5, y: .5 }, SWEET_CENTER - .08); d += Math.hypot(fl.landing.x - .5, fl.landing.y - .5) } return d }
  assert(spread(208) > spread(183) * 1.15, 'tall pitchers scatter more')
  Math.random = original
}

/* ── Tunneling: wider window, high-IVB + drop pairing ── */
{
  const tall = { ...defaultProfile(), height: 198, armSlot: 'OVERHAND' as const }
  const stat = { unlocked: true, velocityLevel: 50, controlLevel: 50, breakLevel: 60, mastery: 0 }
  const heat = createPreviewFlight(PITCHES[0], stat, tall, { x: 0, y: -.8 })
  const split = createPreviewFlight(PITCHES.find(d => d.id === 'SPLITTER')!, stat, tall, { x: 0, y: .8 })
  const read = tunnelRead(split, heat)
  assert(read.score > .5, `high heat → splitter tunnels (${read.score.toFixed(2)})`)
  assert(read.pair, 'north-south pairing detected')
  const lazy = createPreviewFlight(PITCHES[0], stat, tall, { x: 1.2, y: 1.2 })
  assert(tunnelRead(lazy, heat).score < read.score, 'different early paths do not tunnel')
}

/* ── Game accounting ── */
let g = newGame(); const f = createPreviewFlight(PITCHES[0], p.arsenal.FOUR_SEAM, p, { x: 0, y: 0 })
const result = (outcome: PitchResult['outcome']): PitchResult => ({ outcome, swing: true, perceived: f.landing, tunnel: 0, adaptation: 0, tags: [], barrel: f.landing, sprayAngle: 0 })
const leadoff = g.lineup[0].id
for (let i = 0; i < 4; i++) g = applyOutcome(g, f, result('BALL')).game
assert.equal(g.walks, 1); assert.equal(g.atBats, 0)
assert.equal(g.memory[leadoff].length, 1, 'walk is remembered'); assert.equal(g.memory[leadoff][0].pitches.length, 4)
assert(g.confidence[leadoff] > 0, 'a walk builds confidence')
g = applyOutcome(g, f, result('HIT_BY_PITCH')).game
assert.equal(g.walks, 1); assert.equal(g.hbp, 1)
g = applyOutcome(g, f, result('HOME_RUN')).game
assert.equal(g.atBats, 1); assert.equal(g.homeRuns, 1)
const kVictim = g.lineup[g.batterIndex].id
for (let i = 0; i < 3; i++) g = applyOutcome(g, f, result('SWINGING_STRIKE')).game
assert(g.confidence[kVictim] < -.3, 'a strikeout rattles the hitter')
assert.equal(g.totalOuts, 1); assert.equal(g.atBats, 2); assert.equal(g.pitchLog.length, 9); assert.equal(g.abLog.length, 0)
const meatFlight = { ...f, meatball: true } as PitchFlight
g = applyOutcome(g, meatFlight, result('SINGLE')).game
assert.equal(g.pitchLog.at(-1)!.meatball, true)

/* ── Save situation and season bookkeeping ── */
{
  let s8 = { ...newGame(), inning: 8, outs: 3, runsFor: 4, runsAgainst: 2, lineScore: [0, 0, 0, 0, 0, 0, 0, 2] }
  Math.random = () => .1 // our half: 0 runs
  const into9 = closeInning(s8).game
  assert(into9.saveOpp && into9.inning === 9)
  const fin = closeInning({ ...into9, outs: 3, totalOuts: 27 }).game
  assert(fin.over)
  Math.random = original
  const s = recordGame(newSeason(2), { ...fin, homeRuns: 1, hbp: 1, strikeouts: 9, walks: 2 })
  assert.equal(s.saves, 0, 'the winning pitcher cannot also get a save'); assert.equal(s.wins, 1); assert.equal(s.homeRuns, 1)
  s8 = { ...s8, runsFor: 9 }
  assert(!closeInning(s8).game.saveOpp, 'big lead is not a save situation')
}
g = { ...g, inning: 9, outs: 3, totalOuts: 27, runsFor: 100 }
g = closeInning(g).game
assert(g.over)
const s = recordGame(newSeason(), g)
assert.equal(s.games, 1); assert.deepEqual(recordGame(s, g), s)
assert.equal(seasonRates({ ...s, runs: 3, hits: 6, walks: 3, strikeouts: 9, atBats: 30 }).ERA, '3.00')
assert.equal(seasonRates({ ...s, hits: 6, walks: 3 }).WHIP, '1.00')
// FIP = (13·HR + 3·(BB+HBP) − 2·K)/IP + 3.10 → (13 + 9 − 18)/9 + 3.10 = 3.54
assert.equal(seasonRates({ ...newSeason(), outs: 27, homeRuns: 1, walks: 2, hbp: 1, strikeouts: 9 }).FIP, '4.64') // (13+9-18)/9 + 4.20 (AMA)
assert.equal(seasonRates({ ...newSeason(4), outs: 27, homeRuns: 1, walks: 2, hbp: 1, strikeouts: 9 }).FIP, '4.44') // MLB constant 4.00
assert.equal(seasonRates({ ...newSeason(), outs: 3, strikeouts: 3 }).FIP, '0.00', 'immaculate inning: FIP is floored at 0, never negative')
{ const c = aggregate([{ ...newSeason(0), outs: 300 }, { ...newSeason(4), outs: 100 }]); assert(Math.abs(c.fipConstant! - (4.2 * 3 + 4) / 4) < 1e-9, 'career FIP uses the IP-weighted constant') }
assert.equal(seasonRates({ ...newSeason(), outs: 27, walks: 2, strikeouts: 9 })['K/BB'], '4.50')
assert.equal(seasonRates({ ...newSeason(), outs: 27, walks: 2, strikeouts: 9 })['BB/9'], '2.0')
assert.equal(formatIP(14), '4.2'); assert.equal(formatIP(27), '9.0')
const history = [{ ...newSeason(0, 1), games: 5 }, { ...newSeason(1, 2), games: 5 }]
assert.equal(serviceTime(history, newSeason(2, 3)).label, 'Year 2 Pro'); assert.equal(serviceTime(history, newSeason(2, 3)).debutSeason, 2)
assert.equal(serviceTime([], newSeason(0, 1)).label, 'Amateur Year 1')
assert.equal(aggregate([{ ...newSeason(), wins: 2, outs: 10 }, { ...newSeason(), wins: 3, outs: 5 }]).wins, 5)
assert.equal(normalizeSeason({ number: 3, tier: 9 } as any).tier, TIERS.length - 1)
for (let tier = 0; tier < TIERS.length; tier++) { const game = newGame(undefined, tier); assert.equal(game.tier, tier); assert.equal(game.lineup.length, 9) }
assert.deepEqual(TIERS.map(t => t.label), ['Amateur', 'KBO Futures (2nd Team)', 'KBO League (1st Team)', 'Minor League (AAA)', 'Major League Baseball (MLB)'])
const geom = chartGeometry(g.pitchLog); assert.equal(geom.x(0), 160); assert(geom.y(-1) < geom.y(1))

/* ── Save round-trip and legacy migration ── */
const memory = new Map<string, string>(); Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v) } })
assert.equal(loadUnlockedTier(), 0, 'a fresh device starts in Amateur')
saveUnlockedTier(3); assert.equal(loadUnlockedTier(), 3); saveUnlockedTier(9); assert.equal(loadUnlockedTier(), 4)
memory.set(UNLOCK_KEY, 'garbage'); assert.equal(loadUnlockedTier(), 0)
p.created = true
memory.set(SAVE_KEY, JSON.stringify({ profile: { ...p, difficulty: 'LEGEND' }, game: g, season: s, history }))
assert.equal(loadSave().game.pitchLog.length, g.pitchLog.length); assert.equal(loadSave().season.games, 1); assert.equal(loadSave().history.length, 2)
assert.equal('difficulty' in loadSave().profile, false, 'legacy difficulty modifier is dropped')
const oldGame = { ...g } as Partial<typeof g>; delete oldGame.pitchLog; delete oldGame.totalOuts; delete oldGame.atBats; delete oldGame.memory; delete oldGame.confidence; delete oldGame.arcade; delete oldGame.rivalArchive
memory.set(SAVE_KEY, JSON.stringify({ profile: p, game: oldGame, season: { number: 1, tier: 1, games: 2 } }))
assert.equal(loadSave().game.totalOuts, 27); assert.deepEqual(loadSave().game.pitchLog, []); assert.deepEqual(loadSave().game.memory, {})
assert.equal(loadSave().game.arcade!.focus, 0); assert.deepEqual(loadSave().game.rivalArchive, {});
assert.equal(loadSave().season.saves, 0); assert.deepEqual(loadSave().history, [])

/* ── Batter AI: seeded distributions ── */
{
  for (let balls = 0; balls <= 3; balls++) for (let strikes = 0; strikes <= 2; strikes++) {
    const plan = batterPlan({ balls, strikes, fastest: 150 })
    assert(plan.fastballChance > 0 && plan.fastballChance < 1 && Number.isFinite(plan.expectedSpeed), `${balls}-${strikes} has a usable read`)
  }
  const fast: PitchLog = { pitch: 'FOUR_SEAM', speed: 150, x: 0, y: 0, px: 0, py: 0, call: '', tag: '' }
  const afterOne = batterPlan({ balls: 0, strikes: 1, history: [fast], fastest: 150 })
  const afterTwo = batterPlan({ balls: 0, strikes: 2, history: [fast, fast], fastest: 150 })
  assert(!afterOne.expectFastball && afterTwo.expectFastball, 'one fastball suggests a change; repetition becomes a pattern')
  assert(batterPlan({ balls: 3, strikes: 0 }).fastballChance > batterPlan({ balls: 0, strikes: 2 }).fastballChance, 'count shifts the hitter’s guess')
}
// Hold the hitter constant: randomized rival archetypes must not change test baselines.
const aiBatter = { ...g.lineup[3], bats: 'R' as const, contact: .62, power: .6, eye: .6, aggression: .6, zone: 'LOW' as const, weakness: 'NONE' as const }
const hitsOver = (n: number, flight: () => PitchFlight, ctx: Partial<AtBatContext>, seed = 17) => {
  seeded(seed); let hits = 0, swings = 0
  for (let i = 0; i < n; i++) { const r = resolvePitch(flight(), { batter: aiBatter, pitcherHand: 'R', balls: 1, strikes: 1, inning: 1, tier: 2, previous: null, seenTypes: [], seenSpeeds: [], fastest: f.speed, ...ctx }); if (HITS.includes(r.outcome)) hits++; if (r.swing) swings++ }
  Math.random = original; return { hits, swings }
}
{
  const stat = { unlocked: true, velocityLevel: 35, controlLevel: 35, breakLevel: 35, mastery: 0 }
  const edge = createPreviewFlight(PITCHES[0], stat, p, { x: 1.25, y: 0 })
  const wild = createPreviewFlight(PITCHES[0], stat, p, { x: 1.9, y: 0 })
  const early = hitsOver(6000, () => edge, { balls: 0, strikes: 0 }).swings
  const protect = hitsOver(6000, () => edge, { balls: 1, strikes: 2 }).swings
  const far = hitsOver(6000, () => wild, { balls: 1, strikes: 2 }).swings
  assert(protect > early * 1.4 && protect > 1400, 'two-strike hitters offer at reachable balls more often')
  assert(far < protect * .65, 'obvious waste pitches still get taken')
}
// Hitter-count fastballs in a repeated location improve contact (in-PA memory).
assert(hitsOver(6000, () => f, { balls: 3, strikes: 1, history: Array(4).fill(g.pitchLog[0]) }).hits > hitsOver(6000, () => f, { balls: 3, strikes: 1, history: [] }).hits)
// Cross-PA adaptation: repeating the same pitch type in the same cell is punished.
{
  const loc = { x: .6, y: .6 }
  const same: PitchLog = { pitch: 'FOUR_SEAM', speed: 145, x: .55, y: .65, px: 0, py: 0, call: '', tag: '' }
  const prior: PlateAppearance[] = [{ inning: 1, pitches: [same, same, same, same], result: '삼진' }, { inning: 4, pitches: [same, same, same], result: '땅볼 아웃' }]
  assert(batterAdaptation(prior, 'FOUR_SEAM', loc).level > .8)
  assert(batterAdaptation(prior, 'SLIDER', { x: -.8, y: -.8 }).level < .1)
  assert.equal(zoneCell(loc), 8)
  const corner = createPreviewFlight(PITCHES[0], p.arsenal.FOUR_SEAM, p, loc)
  const fresh = hitsOver(8000, () => corner, {}), read = hitsOver(8000, () => corner, { memory: prior })
  assert(read.hits > fresh.hits * 1.4, `adapted hitter hits more (${fresh.hits} → ${read.hits})`)
  const notes = scoutingReport(g.lineup[3], batterSide(g.lineup[3], 'R'), 'R', prior, ['FOUR_SEAM', 'SLIDER'])
  assert(notes.some(n => n.includes('노리고')), 'scouting report warns about the sitting hitter')
}
// Meatball: the hitter pounces.
{
  const stat = { unlocked: true, velocityLevel: 40, controlLevel: 40, breakLevel: 40, mastery: 0 }
  const clean = () => createFlight(PITCHES[5], stat, p, { x: .9, y: .9 }, SWEET_CENTER)
  const hanging = () => createFlight(PITCHES[5], stat, p, { x: .9, y: .9 }, 1.7)
  const a = hitsOver(6000, clean, {}), b = hitsOver(6000, hanging, {})
  assert(b.hits > a.hits * 2, `meatballs get crushed (${a.hits} → ${b.hits})`)
  assert(b.swings > a.swings, 'more aggressive swings at meatballs')
}
// League tiers: MLB hitters make more contact than Amateur hitters.
{
  const mid = createPreviewFlight(PITCHES[0], p.arsenal.FOUR_SEAM, p, { x: .3, y: .3 })
  assert(hitsOver(8000, () => mid, { tier: 4 }).hits > hitsOver(8000, () => mid, { tier: 0 }).hits)
}
// Frustrated hitters chase more.
{
  const ball = createPreviewFlight(PITCHES[5], p.arsenal.FOUR_SEAM, p, { x: 1.35, y: 1.3 })
  assert(hitsOver(8000, () => ball, { confidence: -1 }).swings > hitsOver(8000, () => ball, { confidence: 1 }).swings)
}

/* ── Stamina, the hook, overuse and the bullpen ── */
{
  const calm = newGame(), busy = { ...calm, bases: [true, false, true] as [boolean, boolean, boolean], balls: 3, strikes: 2 }
  assert.equal(staminaCost(SWEET_CENTER, calm), STAMINA.perPitch)
  assert(staminaCost(.97, busy) > staminaCost(SWEET_CENTER, calm) + 1, 'max effort with traffic costs more')
  // ~100 routine pitches empties the tank below the hook line.
  let st = 100; for (let i = 0; i < 90; i++) st -= staminaCost(SWEET_CENTER, i % 3 ? calm : busy)
  assert(st < STAMINA.hookAt, `a starter is spent around 90–100 pitches (${st.toFixed(0)})`)
  assert(needsHook(20, calm) && !needsHook(80, calm) && needsHook(80, { ...calm, pitches: 125 }))
  assert(canRefuseHook({ refusals: 0 }) && !canRefuseHook({ refusals: 1 }), 'the hook can be refused only once')
  assert.equal(fatigueAfter({ pitches: 90, refusals: 0 }, 40), 0, 'a normal start carries no fatigue')
  assert(fatigueAfter({ pitches: 125, refusals: 1 }, 5) > 30, 'overuse hurts the next start')
  assert(fatigueAfter({ pitches: 200, refusals: 2 }, 0) <= STAMINA.maxFatigue)
  seeded(11)
  const mid = { ...newGame(undefined, 2), inning: 6, outs: 1, totalOuts: 16, runsFor: 3, runsAgainst: 1, lineScore: [0, 0, 1, 0, 0, 0], ourScore: [1, 0, 2, 0, 0] }
  for (let i = 0; i < 50; i++) {
    const done = bullpenFinish(mid)
    assert(done.over && done.pulled && done.exitLead === 2)
    assert.equal(done.runsAgainst - done.bullpenRuns, 1, 'bullpen runs are not charged to the starter')
    assert.equal(done.lineScore.reduce((a, n) => a + n, 0), done.runsAgainst)
    assert.equal(done.ourScore.reduce((a, n) => a + n, 0), done.runsFor)
    const dec = pitcherDecision(done)
    // Replay the rest of the game half by half: the starter keeps the W only if the lead is never lost.
    let us = mid.runsFor, them = mid.runsAgainst, held = true
    for (let inn = 6; inn <= done.inning; inn++) {
      them += done.lineScore[inn - 1] - (mid.lineScore[inn - 1] ?? 0); if (them >= us) held = false
      us += (done.ourScore[inn - 1] ?? 0) - (mid.ourScore[inn - 1] ?? 0)
    }
    assert.equal(dec === 'W', done.runsFor > done.runsAgainst && held, 'W needs a lead the bullpen never gives up')
    assert(dec !== 'L', 'left with a lead: never the losing pitcher')
    const rec = recordGame(newSeason(2), done)
    assert.equal(rec.runs, 1); assert.equal(rec.saves, 0); assert.equal(rec.wins, Number(dec === 'W'))
  }
  // Runners he leaves on base are his runs when they score.
  let inherited = 0
  for (let i = 0; i < 200; i++) {
    const loaded = bullpenFinish({ ...mid, bases: [true, true, true], outs: 0 })
    assert.equal(loaded.runsAgainst - loaded.bullpenRuns, 1 + (loaded.inheritedRuns ?? 0))
    assert.equal(recordGame(newSeason(2), loaded).runs, 1 + (loaded.inheritedRuns ?? 0))
    inherited += loaded.inheritedRuns ?? 0
  }
  assert(inherited / 200 > .6 && inherited / 200 < 1.4, `bases-loaded, no-out inherited runners score ≈1 (${inherited / 200})`)
  const early = bullpenFinish({ ...mid, totalOuts: 12 })
  if (early.runsFor > early.runsAgainst) assert.equal(pitcherDecision(early), 'ND', 'under 5 IP is no decision')
  Math.random = original
}

/* ── Promotion / call-up / demotion ── */
{
  const line = (tier: number, games: number, outs: number, runs: number, extra: object = {}) => ({ ...newSeason(tier, 1, 1, 30, 30), games, outs, runs, strikeouts: Math.round(outs / 3), walks: Math.round(outs / 15), ...extra })
  const good = promotionStatus(line(0, 30, 540, 50)) // ERA 2.50
  assert(good.canPromote && !good.callUp && !good.demote)
  assert(!promotionStatus(line(0, 30, 540, 100)).canPromote, 'ERA 5.00 does not promote from Amateur')
  assert(!promotionStatus(line(0, 30, 240, 10)).canPromote, 'needs 100 IP')
  assert(promotionStatus(line(1, 12, 180, 10)).callUp, 'dominant 12 starts earn a call-up')
  assert(!promotionStatus(line(1, 12, 180, 50)).callUp)
  assert(promotionStatus(line(2, 30, 300, 80)).demote, `ERA ${(80 * 27 / 300).toFixed(2)} ≥ ${PROMOTION_ERA[2] + 2} demotes`)
  assert(!promotionStatus(line(0, 30, 300, 150)).demote, 'no demotion below Amateur')
  assert(!promotionStatus(line(4, 30, 540, 10)).canPromote && promotionStatus(line(4, 30, 540, 10)).top)
  assert.equal(callUpSchedule(line(1, 12, 180, 10)), 18); assert.equal(callUpSchedule(line(1, 28, 180, 10)), 5)
  // 20-start seasons scale the counting bars by 2/3 (100 IP → 66.2 IP).
  const short = (outs: number, runs: number) => ({ ...newSeason(0, 1), games: 20, outs, runs, strikeouts: Math.round(outs / 3), walks: Math.round(outs / 15) })
  assert(promotionStatus(short(200, 18)).canPromote && !promotionStatus(short(190, 10)).canPromote, '20-start year needs 66.2 IP')
  assert.equal(newSeason().scheduled, 20)
  assert(seasonDone({ ...newSeason(), games: 30 }) && !seasonDone({ ...newSeason(1, 2, 1, 18), games: 17 }))
  // A call-up keeps the calendar year: two records, one pro year.
  assert.equal(serviceTime([{ ...newSeason(1, 1, 1), games: 12 }], newSeason(2, 2, 1, 18)).label, 'Year 1 Pro')
}

/* ── Aging, retirement, legacy, awards ── */
{
  assert.deepEqual(ageEffects(27), { veloLoss: 0, staminaMul: 1, commandMul: 1, tpMul: 1 })
  assert.equal(ageEffects(20).tpMul, 1.2)
  assert(ageEffects(38).veloLoss > ageEffects(34).veloLoss && ageEffects(38).staminaMul > 1.15 && ageEffects(38).commandMul > 1.05)
  assert(ageEffects(41).veloLoss <= 10)
  const vet = { ...defaultProfile(), age: 38 }, kid = { ...defaultProfile(), age: 25 }
  const stat = { unlocked: true, velocityLevel: 60, controlLevel: 60, breakLevel: 60, mastery: 0 }
  assert(createPreviewFlight(PITCHES[0], stat, vet, { x: 0, y: 0 }).speed < createPreviewFlight(PITCHES[0], stat, kid, { x: 0, y: 0 }).speed - 5, 'velocity fades with age')
  assert(staminaCost(SWEET_CENTER, newGame(), 185, 38) > staminaCost(SWEET_CENTER, newGame(), 185, 28))
  assert.equal(retirementStatus(41, 4, false, 20).forced, 'AGE')
  assert.equal(retirementStatus(25, 0, false, 6).forced, 'NO_PRO')
  assert.equal(retirementStatus(25, 0, true, 6).forced, null, 'earning promotion at 25 keeps the career alive')
  assert.equal(retirementStatus(22, 0, false, 0).canRetire, false); assert(retirementStatus(30, 2, false, 0).canRetire)
  assert.deepEqual(START_AGE, [19, 21, 23, 24, 25])
  // Awards fit the level
  const ace = { ...newSeason(4, 9), games: 30, outs: 600, runs: 40, wins: 18, strikeouts: 250, walks: 30, homeRuns: 10 }
  assert.deepEqual(seasonAwards(ace), ['사이영상', 'MLB 올스타', 'MLB 탈삼진왕'])
  assert(seasonAwards({ ...ace, tier: 2 }).includes('KBO 투수 골든글러브'))
  assert(seasonAwards({ ...ace, tier: 1 }).includes('퓨처스리그 우수 투수상'))
  assert.deepEqual(seasonAwards({ ...ace, runs: 150 }), ['MLB 탈삼진왕'])
  const cg = { ...newGame(), over: true, totalOuts: 27, runsFor: 1, runsAgainst: 0, hits: 0, walks: 0, hbp: 0 }
  assert.equal(gameFeat(cg), '퍼펙트게임'); assert.equal(gameFeat({ ...cg, walks: 2 }), '노히터'); assert.equal(gameFeat({ ...cg, hits: 3 }), '완봉승'); assert.equal(gameFeat({ ...cg, hits: 5, runsAgainst: 2 }), '완투')
  assert.equal(gameFeat({ ...cg, pulled: true }), null)
  assert.deepEqual(recordGame(newSeason(), cg).feats, ['퍼펙트게임 (G1)'])
  assert.deepEqual(recordGame(newSeason(), { ...cg, hits: 4, runsAgainst: 1, feats: ['무결점 이닝 (3회)'] }).feats, ['무결점 이닝 (G1 · 3회)', '완투 (G1)'])
  // Immaculate inning: 9 pitches, 3 strikeouts
  {
    let im = { ...newGame(), outs: 0 }, last: ReturnType<typeof applyOutcome> | null = null
    const ff = createPreviewFlight(PITCHES[0], p.arsenal.FOUR_SEAM, p, { x: 0, y: 0 })
    for (let i = 0; i < 9; i++) { last = applyOutcome(im, ff, { outcome: 'SWINGING_STRIKE', swing: true, perceived: ff.landing, tunnel: 0, adaptation: 0, tags: [], barrel: ff.landing, sprayAngle: 0 }); im = last.game }
    assert(last!.events.immaculate && last!.events.inningOver); assert.deepEqual(im.feats, ['무결점 이닝 (1회)'])
    assert(closeInning(im).summary.immaculate)
    let notIm = { ...newGame() }
    for (const o of ['BALL', 'SWINGING_STRIKE', 'SWINGING_STRIKE', 'SWINGING_STRIKE', 'SWINGING_STRIKE', 'SWINGING_STRIKE', 'SWINGING_STRIKE', 'SWINGING_STRIKE', 'SWINGING_STRIKE', 'SWINGING_STRIKE'] as const) { last = applyOutcome(notIm, ff, { outcome: o, swing: true, perceived: ff.landing, tunnel: 0, adaptation: 0, tags: [], barrel: ff.landing, sprayAngle: 0 }); notIm = last.game }
    assert(!last!.events.immaculate && last!.events.inningOver, 'a ball spoils it')
  }
  // Hall of fame + legacy archive
  const career = Array.from({ length: 8 }, (_, i) => ({ ...ace, number: i + 1, year: i + 1, awards: i < 2 ? ['사이영상'] : [] }))
  const hof = hallOfFame(career)
  assert(hof.hallOfFame && hof.honors.some(h => h.includes('사이영상 2회')))
  assert.equal(trophyCase(career).length, 2)
  assert(!hallOfFame([{ ...newSeason(0, 1), games: 30, wins: 5, outs: 300 }]).hallOfFame)
  const rec = buildRetired({ ...defaultProfile(), name: '레전드', age: 38, startAge: 19 }, [...career, { ...newSeason(4, 9), games: 0 }], 'VOLUNTARY')
  assert.equal(rec.seasons.length, 8, 'empty seasons are dropped'); assert.equal(rec.peakTier, 4); assert(rec.hallOfFame)
  assert.equal(legacyBonus([rec]), 120); assert.equal(legacyBonus(Array(20).fill(rec)), 400)
  saveLegacy([rec]); assert.equal(loadLegacy()[0].name, '레전드')
  memory.set(LEGACY_KEY, '{bad'); assert.deepEqual(loadLegacy(), [])
}

let fullSeason = newSeason()
for (let id = 1; id <= 5; id++) fullSeason = recordGame(fullSeason, { ...g, id })
assert.equal(fullSeason.games, 5); assert.equal(fullSeason.wins, 5)
assert.equal(newSeason(4, 2).tier, 4); assert.equal(newSeason(4, 2).games, 0)
console.log('Regression checks passed: physics, release meter & meatball, IVB/VAA/extension, tunneling, batter memory & mood, stamina & bullpen, physique trade-offs, aging/retirement/legacy/awards, tiers, saves/FIP/IP, save migration, chart mapping.')
