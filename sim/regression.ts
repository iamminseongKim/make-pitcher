import assert from 'node:assert/strict'
import { PITCHES, createPreviewFlight, defaultProfile, pointOnFlight, newGame, applyOutcome, closeInning, loadSave, SAVE_KEY, resolvePitch } from '../src/game'
import { newSeason, recordGame, seasonRates, TIERS } from '../src/season'
import { chartGeometry } from '../src/PitchChart'
const p = defaultProfile()
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
}
let g = newGame(); const f = createPreviewFlight(PITCHES[0], p.arsenal.FOUR_SEAM, p, { x: 0, y: 0 })
const result = (outcome: Parameters<typeof applyOutcome>[2]['outcome']) => ({ outcome, swing: true, perceived: f.landing, tunnel: 0, tags: [], barrel: f.landing, sprayAngle: 0 })
for (let i = 0; i < 4; i++) g = applyOutcome(g, f, result('BALL')).game
assert.equal(g.walks, 1); assert.equal(g.atBats, 0)
g = applyOutcome(g, f, result('HIT_BY_PITCH')).game
assert.equal(g.walks, 1)
g = applyOutcome(g, f, result('SINGLE')).game
assert.equal(g.atBats, 1)
for (let i = 0; i < 3; i++) g = applyOutcome(g, f, result('SWINGING_STRIKE')).game
assert.equal(g.totalOuts, 1); assert.equal(g.atBats, 2); assert.equal(g.pitchLog.length, 9); assert.equal(g.abLog.length, 0)
g = { ...g, inning: 9, outs: 3, totalOuts: 27, runsFor: 100 }
g = closeInning(g).game
assert(g.over)
const s = recordGame(newSeason(), g)
assert.equal(s.games, 1); assert.deepEqual(recordGame(s, g), s)
assert.equal(seasonRates({ ...s, runs: 3, hits: 6, walks: 3, strikeouts: 9, atBats: 30 }).ERA, '3.00')
assert.equal(seasonRates({ ...s, hits: 6, walks: 3 }).WHIP, '1.00')
for (let tier = 0; tier < TIERS.length; tier++) { const game = newGame(undefined, 'PRO', tier); assert.equal(game.tier, tier); assert.equal(game.lineup.length, 9) }
const geom = chartGeometry(g.pitchLog); assert.equal(geom.x(0), 160); assert(geom.y(-1) < geom.y(1))
const memory = new Map<string, string>(); Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k: string) => memory.get(k) ?? null } })
p.created = true
memory.set(SAVE_KEY, JSON.stringify({ profile: p, game: g, season: s }))
assert.equal(loadSave().game.pitchLog.length, 9); assert.equal(loadSave().season.games, 1)
// Seeded distribution: hitter-count fastballs in a repeated location must improve contact.
const original = Math.random
function sample(repeated: boolean) {
 let seed = 17; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return (seed + 1) / 4294967297 }
 let hits = 0
 for (let i = 0; i < 6000; i++) { const r = resolvePitch(f, { batter: g.lineup[0], pitcherHand: 'R', balls: 3, strikes: 1, inning: 1, difficulty: 'PRO', previous: null, seenTypes: [], seenSpeeds: [], fastest: f.speed, history: repeated ? Array(4).fill(g.pitchLog[0]) : [] }); if (['SINGLE', 'DOUBLE', 'HOME_RUN'].includes(r.outcome)) hits++ }
 return hits
}
assert(sample(true) > sample(false)); Math.random = original
console.log('Regression checks passed: continuous physics, game stats, history, tiers, save round-trip, chart mapping, AI recognition.')

let fullSeason = newSeason()
for (let id = 1; id <= 5; id++) fullSeason = recordGame(fullSeason, { ...g, id })
assert.equal(fullSeason.games, 5); assert.equal(fullSeason.wins, 5)
assert.equal(newSeason(4, 2).tier, 4); assert.equal(newSeason(4, 2).games, 0)
const oldGame = { ...g } as Partial<typeof g>; delete oldGame.pitchLog; delete oldGame.totalOuts; delete oldGame.atBats
memory.set(SAVE_KEY, JSON.stringify({ profile: p, game: oldGame }))
assert.equal(loadSave().game.totalOuts, 27); assert.deepEqual(loadSave().game.pitchLog, [])
