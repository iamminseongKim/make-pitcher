import assert from 'node:assert/strict'
import { defaultProfile, newGame, PITCHES } from '../src/game'
import { TIERS } from '../src/season'
import { autoPlateAppearance, isKeyMoment, AUTO_TP } from '../src/highlight'
import { missionsFor, openDay, progressDaily, recommendUpgrade, milestonesOf, newMilestones, streakTP, DAILY_TP, type DailyState } from '../src/meta'

/* ── Names: unique in a lineup, English in AAA/MLB, rivals per league, no back-to-back opponent ── */
for (let tier = 0; tier < TIERS.length; tier++) {
  let g = newGame(undefined, tier)
  for (let i = 0; i < 40; i++) {
    const names = g.lineup.map(b => b.name)
    assert.equal(new Set(names).size, 9, `duplicate name in ${TIERS[tier].short} lineup: ${names}`)
    assert.equal(/^[A-Za-z]/.test(names[0]), tier >= 3, 'AAA/MLB hitters have English names')
    const next = newGame(g, tier)
    assert.notEqual(next.opponent, g.opponent, 'never the same club twice in a row')
    assert(next.opponent < TIERS[tier].teams.length)
    g = next
  }
}
const rivalName = (tier: number) => { const g = newGame(undefined, tier); return g.lineup[3].name }
assert.equal(new Set(TIERS.map((_, t) => rivalName(t))).size >= 4, true, 'rivals differ between leagues')
{ const us = new Set<string>(); for (let i = 0; i < 20; i++) newGame(undefined, 4).lineup.forEach(b => us.add(b.name)); assert(us.size > 60, 'MLB lineups are not the same nine names every game') }

/* ── Highlight mode ── */
{
  const p = defaultProfile(); p.created = true
  for (const id of ['FOUR_SEAM', 'SLIDER', 'CHANGEUP'] as const) p.arsenal[id] = { unlocked: true, velocityLevel: 20, controlLevel: 20, breakLevel: 20, mastery: 0 }
  const g0 = newGame(undefined, 1)
  assert(isKeyMoment(g0).key, 'the first batter of a game is always thrown by hand')
  let runs = 0, outs = 0, pas = 0
  for (let i = 0; i < 300; i++) {
    const g = { ...newGame(undefined, 2), pitches: 5, batterIndex: 6 }
    assert(!isKeyMoment(g).key, 'bottom of the order with bases empty is routine')
    const a = autoPlateAppearance(g, p)
    assert.equal(a.game.abLog.length, 0, 'plate appearance finished')
    assert(a.game.batterIndex === 7 && a.pitches >= 1 && a.stamina < 100)
    runs += a.game.runsAgainst; outs += a.game.totalOuts; pas++
  }
  assert(outs / pas > .6 && outs / pas < .95, `auto PAs produce a sane out rate (${(outs / pas).toFixed(2)})`)
  assert.equal(isKeyMoment({ ...newGame(undefined, 1), pitches: 5, batterIndex: 6, bases: [false, true, false] }).key, true, 'runner in scoring position')
  assert.equal(isKeyMoment({ ...newGame(undefined, 1), pitches: 5, batterIndex: 3 }).key, true, 'rival (4th hitter)')
  assert.equal(isKeyMoment({ ...newGame(undefined, 1), pitches: 5, batterIndex: 6, inning: 9, runsFor: 2, runsAgainst: 1 }).key, true, '9th inning, one-run game')
  assert(AUTO_TP < 1)
  void runs
}

/* ── Daily missions & streak ── */
{
  const a = missionsFor('2026-09-30'), b = missionsFor('2026-09-30')
  assert.deepEqual(a, b); assert.equal(new Set(a.map(m => m.id)).size, 3)
  const empty: DailyState = { day: '', missions: [], allClear: false, streak: 0, lastCheckIn: '' }
  const d1 = openDay(empty, new Date(2026, 8, 29, 8))
  assert.equal(d1.checkIn, streakTP(1)); assert.equal(d1.daily.streak, 1)
  assert.equal(openDay(d1.daily, new Date(2026, 8, 29, 18)).checkIn, 0, 'one check-in per day')
  const d2 = openDay(d1.daily, new Date(2026, 8, 30, 8))
  assert.equal(d2.daily.streak, 2); assert.equal(d2.checkIn, streakTP(2))
  assert.equal(openDay(d2.daily, new Date(2026, 9, 3, 8)).daily.streak, 1, 'missing a day resets the streak')
  let d = d2.daily, tp = 0
  for (const m of d.missions) { const r = progressDaily(d, { [m.id]: 99 }); d = r.daily; tp += r.tp }
  assert.equal(tp, DAILY_TP.mission * 3 + DAILY_TP.allClear)
  assert.equal(progressDaily(d, { [d.missions[0].id]: 5 }).tp, 0, 'no double pay')
}

/* ── Recommended upgrade & milestones ── */
{
  const p = defaultProfile()
  p.arsenal.FOUR_SEAM = { unlocked: true, velocityLevel: 10, controlLevel: 4, breakLevel: 8, mastery: 300 }
  p.arsenal.SLIDER = { unlocked: true, velocityLevel: 3, controlLevel: 9, breakLevel: 9, mastery: 50 }
  const r = recommendUpgrade(p)!
  assert.equal(r.pitch, 'SLIDER'); assert.equal(r.key, 'velocityLevel')
  const fast = { ...p, arsenal: { ...p.arsenal, FOUR_SEAM: { ...p.arsenal.FOUR_SEAM, velocityLevel: 99 } } }
  assert(milestonesOf(fast).includes('165km/h 돌파') && !milestonesOf(p).includes('140km/h 돌파'))
  assert(newMilestones(p, fast).includes('150km/h 돌파'))
  void PITCHES
}
console.log('Commute checks passed: unique names/opponents, highlight auto PAs, daily missions & streak, recommended upgrade, milestones.')
