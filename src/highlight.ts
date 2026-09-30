import {
  PITCHES, SWEET_CENTER, applyOutcome, batterAdaptation, batterSide, clamp, createFlight, lerp, resolvePitch, staminaCost, statSpeed,
  type GameState, type PitchFlight, type PitchType, type PitcherProfile,
} from './game'

/**
 * Highlight mode: the player only throws the plate appearances that matter.
 * Everything else is thrown by the same physics/batter model with a steady, slightly
 * conservative release, so stats and stamina stay honest — just faster.
 */
export type PlayMode = 'highlight' | 'full'
/** Auto-thrown plate appearances pay less TP than ones you throw yourself. */
export const AUTO_TP = .7

/** Plate appearances the player throws in highlight mode. */
export function isKeyMoment(g: GameState): { key: boolean; reason: string } {
  const b = g.lineup[g.batterIndex]
  const close = Math.abs(g.runsFor - g.runsAgainst) <= 1
  if (g.pitches === 0) return { key: true, reason: '1회 선두 타자' }
  if (b.id.startsWith('rival-')) return { key: true, reason: '라이벌 등장' }
  if (g.bases[1] || g.bases[2]) return { key: true, reason: '득점권 위기' }
  if (g.inning >= 9 && close) return { key: true, reason: '9회 접전' }
  return { key: false, reason: '' }
}

const gauss = () => { const u = 1 - Math.random(), v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) }
const rnd = (a: number, b: number) => a + Math.random() * (b - a)

/**
 * A sensible catcher's call: fastball early and ahead in the zone, a chase pitch to finish.
 * Several candidate calls are drawn and the one this hitter has seen least (batter memory) wins,
 * so auto-thrown plate appearances do not feed the same pattern to the lineup all game.
 */
function call(g: GameState, profile: PitcherProfile, arsenal: PitchType[]): { type: PitchType; x: number; y: number } {
  const b = g.lineup[g.batterIndex]
  const side = batterSide(b, profile.hand)
  const away = side === 'R' ? 1 : -1
  const same = side === profile.hand
  const fam = (t: PitchType) => PITCHES.find(p => p.id === t)!.family
  const fbs = arsenal.filter(t => fam(t) === 'FASTBALL')
  const softs = arsenal.filter(t => fam(t) !== 'FASTBALL')
  const pick = <T,>(l: T[]) => l[Math.floor(Math.random() * l.length)]
  const fb = () => pick(fbs.length ? fbs : arsenal)
  // Platoon: glove-side breakers vs same-hand hitters, fading offspeed vs opposite-hand hitters.
  const soft = () => { const good = softs.filter(t => fam(t) === (same ? 'BREAKING' : 'OFFSPEED')); return pick(good.length && Math.random() < .75 ? good : softs.length ? softs : arsenal) }
  const side1 = () => (Math.random() < .7 ? away : -away)
  const options = (): { type: PitchType; x: number; y: number } => {
    if (g.strikes === 2 && g.balls < 3) {
      const r = Math.random()
      return r < .35 ? { type: fb(), x: rnd(-.5, .5), y: rnd(-1.3, -1.05) } : r < .8 ? { type: soft(), x: away * rnd(.8, 1.2), y: rnd(.9, 1.3) } : { type: soft(), x: -away * rnd(.7, 1.1), y: rnd(1, 1.3) }
    }
    if (g.balls >= 2) return Math.random() < .7 ? { type: fb(), x: side1() * rnd(.3, .75), y: rnd(-.5, .5) } : { type: soft(), x: side1() * rnd(.2, .6), y: rnd(.3, .75) }
    const r = Math.random()
    return r < .5 ? { type: fb(), x: side1() * rnd(.45, .9), y: rnd(-.85, -.3) } : r < .85 ? { type: soft(), x: side1() * rnd(.45, .9), y: rnd(.45, .9) } : { type: fb(), x: side1() * rnd(.5, .9), y: rnd(.3, .8) }
  }
  const prior = (g.memory ?? {})[b.id]
  let best = options(), bestRisk = Infinity
  for (let i = 0; i < 5; i++) {
    const c = i ? options() : best
    const risk = batterAdaptation(prior, c.type, c).level + Math.random() * .05
    if (risk < bestRisk) { best = c; bestRisk = risk }
  }
  return best
}

export interface AutoPA {
  game: GameState
  /** Raw TP (before league/age multipliers), already scaled by AUTO_TP. */
  reward: number
  mastery: Partial<Record<PitchType, number>>
  stamina: number
  line: string
  inningOver: boolean
  pitches: number
}

/** Throws one whole plate appearance automatically. */
export function autoPlateAppearance(g: GameState, profile: PitcherProfile): AutoPA {
  const arsenal = PITCHES.filter(p => profile.arsenal[p.id].unlocked).map(p => p.id)
  const fastballs = arsenal.filter(t => PITCHES.find(p => p.id === t)!.family === 'FASTBALL')
  const fastest = Math.max(...(fastballs.length ? fastballs : arsenal).map(t => statSpeed(PITCHES.find(p => p.id === t)!, profile.arsenal[t])), 100)
  const batter = g.lineup[g.batterIndex]
  const mastery: Partial<Record<PitchType, number>> = {}
  let game = g, stamina = profile.stamina, reward = 0, prev: PitchFlight | null = null, pitches = 0, inningOver = false, result = ''
  const seenSpeeds: number[] = [], seenTypes: PitchType[] = []
  for (let n = 0; n < 40; n++) { // long foul battles happen; 40 is a safety cap
    const c = call(game, profile, arsenal)
    const def = PITCHES.find(p => p.id === c.type)!
    const stat = profile.arsenal[c.type]
    const meter = clamp(SWEET_CENTER + gauss() * lerp(.06, .03, (stat.controlLevel - 1) / 98), .5, 1.05)
    const f = createFlight(def, stat, { ...profile, stamina }, { x: c.x, y: c.y }, meter)
    const r = resolvePitch(f, {
      batter, pitcherHand: profile.hand, balls: game.balls, strikes: game.strikes, inning: game.inning, tier: game.tier,
      previous: prev, seenSpeeds, seenTypes, fastest, history: game.abLog, memory: (game.memory ?? {})[batter.id], confidence: (game.confidence ?? {})[batter.id] ?? 0,
    })
    const before = game
    const out = applyOutcome(game, f, r)
    game = out.game
    pitches++
    reward += out.events.reward
    mastery[c.type] = (mastery[c.type] ?? 0) + out.events.mastery
    stamina = clamp(stamina - staminaCost(f.timingError + SWEET_CENTER, before, profile.height, profile.age), 0, 100)
    prev = f; seenSpeeds.push(f.speed); seenTypes.push(c.type)
    if (out.events.paEnded) { result = out.call.text.split(' · ')[0] + (out.events.runs ? ` · ${out.events.runs}실점` : ''); inningOver = out.events.inningOver; break }
  }
  return {
    game, reward: Math.round(reward * AUTO_TP), mastery, stamina, inningOver, pitches,
    line: `${batter.order}번 ${batter.name} · ${result || '승부 중'} (${pitches}구)`,
  }
}
