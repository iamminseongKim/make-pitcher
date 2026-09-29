import assert from 'node:assert/strict'
import {
  PITCHES, createFlight, createPreviewFlight, defaultProfile, pointOnFlight, newGame, applyOutcome, closeInning, loadSave, SAVE_KEY, resolvePitch,
  releaseQuality, SWEET_CENTER, sweetSpot, batterAdaptation, tunnelRead, extensionOf, releaseHeightOf, zoneCell, scoutingReport, batterSide, HITS,
  physiqueCost, staminaCost, needsHook, canRefuseHook, fatigueAfter, bullpenFinish, pitcherDecision, STAMINA,
  type PitchFlight, type PitchResult, type PlateAppearance, type PitchLog, type AtBatContext,
} from '../src/game'
import { newSeason, recordGame, seasonRates, TIERS, aggregate, formatIP, serviceTime, normalizeSeason, promotionStatus, callUpSchedule, seasonDone, PROMOTION_ERA, loadUnlockedTier, saveUnlockedTier, UNLOCK_KEY } from '../src/season'
import { chartGeometry } from '../src/PitchChart'
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
  assert.equal(s.saves, 1); assert.equal(s.wins, 1); assert.equal(s.homeRuns, 1)
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
assert.equal(seasonRates({ ...newSeason(), outs: 27, homeRuns: 1, walks: 2, hbp: 1, strikeouts: 9 }).FIP, '3.54')
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
const oldGame = { ...g } as Partial<typeof g>; delete oldGame.pitchLog; delete oldGame.totalOuts; delete oldGame.atBats; delete oldGame.memory; delete oldGame.confidence
memory.set(SAVE_KEY, JSON.stringify({ profile: p, game: oldGame, season: { number: 1, tier: 1, games: 2 } }))
assert.equal(loadSave().game.totalOuts, 27); assert.deepEqual(loadSave().game.pitchLog, []); assert.deepEqual(loadSave().game.memory, {})
assert.equal(loadSave().season.saves, 0); assert.deepEqual(loadSave().history, [])

/* ── Batter AI: seeded distributions ── */
const hitsOver = (n: number, flight: () => PitchFlight, ctx: Partial<AtBatContext>, seed = 17) => {
  seeded(seed); let hits = 0, swings = 0
  for (let i = 0; i < n; i++) { const r = resolvePitch(flight(), { batter: g.lineup[3], pitcherHand: 'R', balls: 1, strikes: 1, inning: 1, tier: 2, previous: null, seenTypes: [], seenSpeeds: [], fastest: f.speed, ...ctx }); if (HITS.includes(r.outcome)) hits++; if (r.swing) swings++ }
  Math.random = original; return { hits, swings }
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
    assert(done.runsFor > done.runsAgainst ? dec === 'W' : dec !== 'W')
    const rec = recordGame(newSeason(2), done)
    assert.equal(rec.runs, 1); assert.equal(rec.saves, 0); assert.equal(rec.wins, Number(dec === 'W'))
  }
  const early = bullpenFinish({ ...mid, totalOuts: 12 })
  if (early.runsFor > early.runsAgainst) assert.equal(pitcherDecision(early), 'ND', 'under 5 IP is no decision')
  Math.random = original
}

/* ── Promotion / call-up / demotion ── */
{
  const line = (tier: number, games: number, outs: number, runs: number, extra: object = {}) => ({ ...newSeason(tier, 1), games, outs, runs, strikeouts: Math.round(outs / 3), walks: Math.round(outs / 15), ...extra })
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
  assert(seasonDone({ ...newSeason(), games: 30 }) && !seasonDone({ ...newSeason(1, 2, 1, 18), games: 17 }))
  // A call-up keeps the calendar year: two records, one pro year.
  assert.equal(serviceTime([{ ...newSeason(1, 1, 1), games: 12 }], newSeason(2, 2, 1, 18)).label, 'Year 1 Pro')
}

let fullSeason = newSeason()
for (let id = 1; id <= 5; id++) fullSeason = recordGame(fullSeason, { ...g, id })
assert.equal(fullSeason.games, 5); assert.equal(fullSeason.wins, 5)
assert.equal(newSeason(4, 2).tier, 4); assert.equal(newSeason(4, 2).games, 0)
console.log('Regression checks passed: physics, release meter & meatball, IVB/VAA/extension, tunneling, batter memory & mood, stamina & bullpen, physique trade-offs, tiers, saves/FIP/IP, save migration, chart mapping.')
