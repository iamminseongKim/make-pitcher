import { PITCHES, createFlight, resolvePitch, defaultProfile, makeLineup, batterSide, HITS, type PitchType } from '../src/game'
const p = defaultProfile(); p.hand = 'R'; p.created = true
for (const d of PITCHES) p.arsenal[d.id] = { unlocked: true, velocityLevel: 40, controlLevel: 60, breakLevel: 40, mastery: 0 }
function test(type: PitchType, label: string, loc: (away: number) => { x: number; y: number }, prevType?: PitchType, prevLoc?: (away: number) => { x: number; y: number }) {
  const res: Record<string, { sw: number; wh: number; h: number; bip: number }> = { same: { sw: 0, wh: 0, h: 0, bip: 0 }, opp: { sw: 0, wh: 0, h: 0, bip: 0 } }
  for (let i = 0; i < 20000; i++) {
    const b = makeLineup(0)[i % 9]; if (b.bats === 'S') continue
    const side = batterSide(b, 'R'); const away = side === 'R' ? 1 : -1
    const prev = prevType ? createFlight(PITCHES.find(d => d.id === prevType)!, p.arsenal[prevType], p, prevLoc!(away), .82) : null
    const f = createFlight(PITCHES.find(d => d.id === type)!, p.arsenal[type], p, loc(away), .82)
    const r = resolvePitch(f, { batter: b, pitcherHand: 'R', balls: 1, strikes: 1, inning: 1, tier: 2, previous: prev, seenSpeeds: prev ? [prev.speed] : [], seenTypes: prev ? [prevType!] : [], fastest: 150 })
    const k = side === 'R' ? 'same' : 'opp'
    if (r.swing) res[k].sw++
    if (r.outcome === 'SWINGING_STRIKE') res[k].wh++
    if (HITS.includes(r.outcome)) res[k].h++
    if (r.outcome.endsWith('_OUT') || HITS.includes(r.outcome)) res[k].bip++
  }
  const f = (o: { sw: number; wh: number; h: number; bip: number }) => `whiff/sw ${(o.wh / o.sw * 100).toFixed(0).padStart(3)}% hit/bip ${(o.h / o.bip).toFixed(3)}`
  console.log(label.padEnd(34), 'SAME', f(res.same), ' | OPP', f(res.opp))
}
test('SLIDER', 'slider low-away', a => ({ x: a * .9, y: .8 }))
test('SWEEPER', 'sweeper away', a => ({ x: a * 1.0, y: .3 }))
test('CHANGEUP', 'changeup low-away', a => ({ x: a * .8, y: .85 }))
test('SPLITTER', 'splitter low', a => ({ x: 0, y: 1.0 }))
test('SINKER', 'sinker in', a => ({ x: -a * .7, y: .5 }))
test('CUTTER', 'cutter in', a => ({ x: -a * .7, y: .2 }))
test('FOUR_SEAM', 'four-seam high (1.1 above)', a => ({ x: 0, y: -1.1 }))
test('FOUR_SEAM', 'four-seam belt middle', a => ({ x: 0, y: 0 }))
test('SPLITTER', 'splitter low (no prev)', a => ({ x: 0, y: .9 }))
test('SPLITTER', 'splitter low after 4S same tunnel', a => ({ x: 0, y: .9 }), 'FOUR_SEAM', a => ({ x: 0, y: .1 }))
test('CURVE', 'curve low (no prev)', a => ({ x: 0, y: .9 }))
test('CURVE', 'curve low after high 4S', a => ({ x: 0, y: .9 }), 'FOUR_SEAM', a => ({ x: 0, y: -1.1 }))
