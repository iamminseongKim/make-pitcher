import { PITCHES, createFlight, resolvePitch, defaultProfile, newGame, batterSide, statSpeed, HITS, IN_PLAY_OUT, pointOnFlight, type PitchFlight, type PitchType, type PitcherProfile } from '../src/game'
;(globalThis as any).performance ??= { now: () => Date.now() }
function prof(level: number, hand: 'R'|'L', types: PitchType[]): PitcherProfile {
  const p = defaultProfile(); p.hand = hand; p.created = true
  for (const t of types) p.arsenal[t] = { unlocked: true, velocityLevel: level, controlLevel: level, breakLevel: level, mastery: 0 }
  return p
}
type Strat = (ctx: { balls: number; strikes: number; prev: PitchFlight | null; side: 'R'|'L'; same: boolean; types: PitchType[] }) => { type: PitchType; x: number; y: number }
const r = (a: number, b: number) => a + Math.random() * (b - a)
const strats: Record<string, Strat> = {
  middle: c => ({ type: c.types[0], x: r(-.3, .3), y: r(-.3, .3) }),
  random: c => ({ type: c.types[Math.floor(Math.random() * c.types.length)], x: r(-1.4, 1.4), y: r(-1.4, 1.4) }),
  fastOnly: c => ({ type: 'FOUR_SEAM', x: r(-.9, .9), y: r(-.9, .9) }),
  smart: c => {
    const away = c.side === 'R' ? 1 : -1
    if (c.strikes === 2 && c.balls < 3) {
      if (Math.random() < .5) return { type: 'FOUR_SEAM', x: r(-.4, .4), y: r(-1.35, -1.1) }
      return { type: c.same ? 'SLIDER' : 'CHANGEUP', x: away * r(.9, 1.3), y: r(1.0, 1.35) }
    }
    if (c.balls >= 2) return { type: 'FOUR_SEAM', x: away * r(.4, .8), y: r(-.2, .6) }
    return Math.random() < .55 ? { type: 'FOUR_SEAM', x: away * r(.5, .9), y: r(-.9, -.4) } : { type: c.same ? 'SLIDER' : 'CHANGEUP', x: away * r(.5, .95), y: r(.5, .95) }
  },
}
function run(level: number, stratName: string, pas = 4000, tier = 2) {
  const p = prof(level, 'R', ['FOUR_SEAM', 'SLIDER', 'CHANGEUP'])
  const fastest = statSpeed(PITCHES[0], p.arsenal.FOUR_SEAM)
  let izs=0, izw=0, ozw=0, bip=0, fouls=0, byType: Record<string, [number, number]> = {}; let k = 0, bb = 0, h = 0, hr = 0, outs = 0, pitches = 0, swings = 0, whiffs = 0, chase = 0, oz = 0
  for (let i = 0; i < pas; i++) {
    const g = newGame(); const batter = g.lineup[i % 9]
    const side = batterSide(batter, 'R'); let balls = 0, strikes = 0, prev: PitchFlight | null = null
    const seenSpeeds: number[] = [], seenTypes: PitchType[] = []
    for (;;) {
      pitches++
      const s = strats[stratName]({ balls, strikes, prev, side, same: side === 'R', types: ['FOUR_SEAM', 'SLIDER', 'CHANGEUP'] })
      const def = PITCHES.find(d => d.id === s.type)!
      const power = Math.min(1, Math.max(0, .82 + (Math.random() - .5) * .22))
      const f = createFlight(def, p.arsenal[s.type], p, { x: s.x, y: s.y }, power)
      const res = resolvePitch(f, { batter, pitcherHand: 'R', balls, strikes, inning: 1, tier, previous: prev, seenSpeeds, seenTypes, fastest })
      const outZ = Math.abs(f.landing.x) > 1 || Math.abs(f.landing.y) > 1
      if (outZ) { oz++; if (res.swing) chase++ }
      if (res.swing) swings++
      if (res.outcome === 'SWINGING_STRIKE') whiffs++
      if (res.swing) { byType[s.type] ??= [0, 0]; byType[s.type][0]++; if (res.outcome === 'SWINGING_STRIKE') byType[s.type][1]++ }
      if (res.swing && !outZ) { izs++; if (res.outcome === 'SWINGING_STRIKE') izw++ }
      if (res.swing && outZ && res.outcome === 'SWINGING_STRIKE') ozw++
      if (res.outcome === 'FOUL') fouls++
      if (HITS.includes(res.outcome) || IN_PLAY_OUT.includes(res.outcome)) bip++
      prev = f; seenSpeeds.push(f.speed); seenTypes.push(s.type)
      const o = res.outcome
      if (o === 'BALL') { if (++balls === 4) { bb++; break } }
      else if (o === 'HIT_BY_PITCH') { bb++; break }
      else if (o === 'CALLED_STRIKE' || o === 'SWINGING_STRIKE') { if (++strikes === 3) { k++; break } }
      else if (o === 'FOUL') { if (strikes < 2) strikes++ }
      else if (HITS.includes(o)) { h++; if (o === 'HOME_RUN') hr++; break }
      else if (IN_PLAY_OUT.includes(o)) { outs++; break }
    }
  }
  const pct = (n: number, d = pas) => (n / d * 100).toFixed(1).padStart(5)
  console.log(`${['AMA', 'FUT', 'KBO', 'AAA', 'MLB'][tier].padEnd(4)} L${String(level).padStart(2)} ${stratName.padEnd(8)} K%${pct(k)} BB%${pct(bb)} H%${pct(h)} HR%${pct(hr)} AVG ${(h / (pas - bb)).toFixed(3)} P/PA ${(pitches / pas).toFixed(1)} whiff/sw ${pct(whiffs, swings)} chase ${pct(chase, oz)} Zwhiff ${pct(izw, izs)} Owhiff ${pct(ozw, chase)} BABIP ${((h - hr) / (bip - hr)).toFixed(3)} foul/sw ${pct(fouls, swings)} ${Object.entries(byType).map(([t, v]) => t.slice(0, 4) + ':' + (v[1] / v[0] * 100).toFixed(0)).join(' ')}`)
}
for (const lv of [5, 30, 70]) for (const s of Object.keys(strats)) run(lv, s)
for (const tier of [0, 1, 3, 4]) run(30, 'smart', 4000, tier)
// trajectory sanity: RHP release & break direction (catcher view: - = left of screen)
const pr = prof(50, 'R', PITCHES.map(p => p.id)), pl = prof(50, 'L', PITCHES.map(p => p.id))
for (const pp of [pr, pl]) for (const def of PITCHES) {
  const f = createFlight(def, pp.arsenal[def.id], pp, { x: 0, y: 0 }, .82)
  const mid = pointOnFlight(f, def.late), end = pointOnFlight(f, 1)
  console.log(pp.hand, def.short.padEnd(5), 'release x', f.release.x.toFixed(2), 'late-break dx', (end.x - mid.x - (f.landing.x - f.movement.x - mid.x) * 0).toFixed(2), 'move.x', f.movement.x.toFixed(2), 'move.y', f.movement.y.toFixed(2))
}
