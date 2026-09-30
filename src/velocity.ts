import type { PitchLog, PitchType } from './game'

/** A game balance model, not an empirically fitted MLB probability model.
 * Recognition and prior exposure allow a hitter to adjust to a separate speed band.
 * A disguised pitch retains its timing advantage; a large gap alone is not a foul bonus.
 */
export function timingRead(speed: number, fastest: number, logs: PitchLog[], pitch: PitchType, recognized: boolean, eye: number, tunnel: number, previousSpeed?: number) {
  const recent = logs.slice(-18)
  const same = recent.filter(p => p.pitch === pitch)
  const mean = (a: PitchLog[]) => a.reduce((sum, p) => sum + p.speed, 0) / a.length
  const baseline = recent.length ? fastest * .45 + mean(recent) * .55 : fastest
  const known = same.length ? mean(same) : speed
  const recognition = recognized ? Math.min(.9, .45 + eye * .25 + same.length * .035) : Math.min(.25, same.length * .025)
  let expected = baseline + (known - baseline) * recognition
  if (previousSpeed !== undefined) expected += (previousSpeed - expected) * Math.min(.8, tunnel * .8)
  // Relative arrival time on ~16.6 m flight, saturating extreme mismatches.
  const arrivalErrorMs = 16.6 * 3600 * (1 / Math.max(70, speed) - 1 / Math.max(70, expected))
  const early = Math.max(-.85, Math.min(.85, arrivalErrorMs / 135))
  const gap = Math.abs(fastest - speed)
  return { expected, early, arrivalErrorMs, familiar: same.length >= 2, gap }
}
