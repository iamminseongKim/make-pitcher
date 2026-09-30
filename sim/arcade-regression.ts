import assert from 'node:assert/strict'
import { applyOutcome, createFlight, defaultProfile, newGame, PITCHES, type PitchResult } from '../src/game'
import { freshArcade, performanceBonus, traitActive } from '../src/arcade'
import { timingRead } from '../src/velocity'

const originalRandom = Math.random
try {
  Math.random = () => .2
  const p = defaultProfile(), stat = { ...p.arsenal.SINKER, unlocked: true, mastery: 225, trait: 'signature' as const }
  const f = createFlight(PITCHES[1], stat, p, { x: .7, y: .8 }, .82)
  const result = (outcome: PitchResult['outcome'], tags: string[] = []): PitchResult => ({ outcome, tags, swing: true, perceived: f.landing, barrel: f.landing, tunnel: 0, adaptation: 0, sprayAngle: 0 })
  const g = newGame(); g.bases = [true, false, false]; g.outs = 1; g.totalOuts = 1
  const dp = applyOutcome(g, f, result('GROUND_OUT'))
  assert(dp.events.doublePlay && dp.events.inningOver)
  assert.equal(dp.game.totalOuts, 3); assert.equal(dp.game.atBats, 1)
  assert.equal(g.bases[0], true, 'input state stays immutable')
  assert(!applyOutcome({ ...g, outs: 2 }, f, result('GROUND_OUT')).events.doublePlay)
  assert(!applyOutcome({ ...g, bases: [false, true, false] }, f, result('GROUND_OUT')).events.doublePlay)
  let mission = newGame(); mission.arcade = { ...freshArcade(), mission: 'corners', focus: 95 }
  let reward = 0
  for (let i = 0; i < 5; i++) { const out = applyOutcome(mission, f, result('CALLED_STRIKE', ['코너 꽉 찬 공'])); mission = out.game; reward = out.events.reward }
  assert(mission.arcade!.completed); assert.equal(mission.arcade!.focus, 100); assert(reward >= 60)
  assert(applyOutcome(mission, f, result('CALLED_STRIKE', ['코너 꽉 찬 공'])).events.reward < 60, 'mission reward is paid once')
  const afterBall = applyOutcome(mission, f, result('BALL')).game
  assert.equal(afterBall.arcade!.progress, 5, 'a tactical ball preserves progress')
  const crisis = newGame(); crisis.outs = 2; crisis.bases = [false, true, true]
  assert(applyOutcome(crisis, f, result('GROUND_OUT')).game.arcade!.techniques.includes('위기 탈출'))
  crisis.arcade = { ...freshArcade(), inningRuns: 1 }
  assert(!applyOutcome(crisis, f, result('GROUND_OUT')).game.arcade!.techniques.includes('위기 탈출'))
  assert.equal(traitActive({ ...stat, mastery: 224 }), undefined)
  assert.equal(traitActive(stat), 'signature')
  const base = createFlight(PITCHES[0], p.arsenal.FOUR_SEAM, p, { x: .8, y: .8 }, .82)
  const focus = createFlight(PITCHES[0], p.arsenal.FOUR_SEAM, p, { x: .8, y: .8 }, .82, { focused: true })
  assert(Math.hypot(focus.landing.x - .8, focus.landing.y - .8) < Math.hypot(base.landing.x - .8, base.landing.y - .8))
  const miss = createFlight(PITCHES[0], p.arsenal.FOUR_SEAM, p, { x: .8, y: .8 }, .1, { focused: true })
  assert(miss.meatball, 'focus is not an automatic successful pitch')
  const power = createFlight(PITCHES[0], p.arsenal.FOUR_SEAM, p, { x: .8, y: .8 }, .82, { effort: 'power' })
  assert.equal(power.speed - base.speed, 3)
  const personal = { ...newGame(), totalOuts: 18, strikeouts: 7, runsAgainst: 2 }
  assert.equal(performanceBonus({ ...personal, runsFor: 0 }), performanceBonus({ ...personal, runsFor: 10 }), 'run support does not change personal rewards')
  const old = newGame(), rival = old.lineup[3]
  old.memory[rival.id] = [{ inning: 1, pitches: [], result: '삼진' }]
  const fresh = newGame(old)
  assert.equal(fresh.rivalArchive![rival.id][0].result, '삼진')
  assert.equal(fresh.arcade!.focus, 0)
  const logs = Array.from({ length: 4 }, () => ({ pitch: 'CHANGEUP' as const, speed: 116, x: 0, y: 0, px: 0, py: 0, call: '', tag: '' }))
  const fooled = timingRead(116, 170, logs, 'CHANGEUP', false, .8, 0)
  const read = timingRead(116, 170, logs, 'CHANGEUP', true, .8, 0)
  assert(read.early < fooled.early, 'recognized speed bands allow timing adjustment')
  assert(timingRead(116, 170, logs, 'CHANGEUP', true, .8, 1, 170).early > read.early, 'tunneling preserves deception')
  for (const speed of [100, 120, 140, 170]) assert(Number.isFinite(timingRead(speed, 170, [], 'CHANGEUP', true, .5, 0).early))
  console.log('Arcade checks passed: double plays, missions, focus, traits, personal rewards, rivals, velocity adaptation.')
} finally { Math.random = originalRandom }
