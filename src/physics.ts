import { ARM_SLOTS, breakScale, clamp, dispersion, lerp, statSpeed, sweetSpot, type Grade, type PitchDefinition, type PitchStat, type PitcherProfile } from './game'

/* ───────────────────────── Flight model ───────────────────────── */

export interface PitchFlight {
  pitch: PitchDefinition
  speed: number
  grade: Grade
  duration: number
  target: { x: number; y: number }
  landing: { x: number; y: number }
  release: { x: number; y: number }
  movement: { x: number; y: number }
  startedAt: number
  control: number
  breakLevel: number
  power: number
}

function releasePoint(profile: PitcherProfile) {
  // Catcher view: a right-hander's arm is on the left side of the screen.
  const side = profile.hand === 'R' ? 1 : -1
  const slot = ARM_SLOTS[profile.armSlot]
  return { x: -side * slot.width, y: slot.releaseY - (profile.height - 185) / 90 }
}
function movementFor(pitch: PitchDefinition, stat: PitchStat, profile: PitcherProfile) {
  const side = profile.hand === 'R' ? 1 : -1
  const scale = breakScale(stat.breakLevel)
  // Lower arm slots trade vertical drop for horizontal run.
  const flat = profile.armSlot === 'SIDEARM' ? .25 : profile.armSlot === 'SUBMARINE' ? .4 : profile.armSlot === 'OVERHAND' ? -.12 : 0
  return { x: (pitch.moveX / 65) * scale * side * (1 + flat), y: (pitch.moveY / 65) * scale * (1 - flat * .6) }
}

export function createFlight(pitch: PitchDefinition, stat: PitchStat, profile: PitcherProfile, target: { x: number; y: number }, power: number): PitchFlight {
  const width = sweetSpot(stat.controlLevel)
  const error = power - .82
  const grade: Grade = Math.abs(error) <= width / 2 ? 'PERFECT' : Math.abs(error) <= width / 2 + .12 ? 'GOOD' : error < 0 ? 'EARLY' : 'LATE'
  const tired = profile.stamina < 30 ? (30 - profile.stamina) / 30 * .35 : 0
  const overthrow = power > .9 ? (power - .9) * 1.8 : 0
  const spread = dispersion(stat.controlLevel) * (grade === 'PERFECT' ? .12 : grade === 'GOOD' ? .4 : .9) + tired * .4 + overthrow * .3
  const angle = Math.random() * Math.PI * 2
  const offset = spread * (.35 + Math.random() * .65)
  // A missed release pulls the ball toward the middle — the classic mistake pitch.
  const pull = grade === 'EARLY' || grade === 'LATE' ? .22 : 0
  const landing = {
    x: lerp(target.x, 0, pull) + Math.cos(angle) * offset,
    y: lerp(target.y, 0, pull) + Math.sin(angle) * offset + (grade === 'LATE' ? .12 : grade === 'EARLY' ? -.1 : 0),
  }
  const speed = Math.round((statSpeed(pitch, stat) - (1 - power) * 8 - tired * 6) * 10) / 10
  return {
    pitch, speed, grade, duration: 18.44 / (speed / 3.6) * 1000, target, landing,
    release: releasePoint(profile), movement: movementFor(pitch, stat, profile),
    startedAt: performance.now(), control: stat.controlLevel, breakLevel: stat.breakLevel, power,
  }
}

export function createPreviewFlight(pitch: PitchDefinition, stat: PitchStat, profile: PitcherProfile, target: { x: number; y: number }): PitchFlight {
  const speed = statSpeed(pitch, stat)
  return {
    pitch, speed, grade: 'PERFECT', duration: 18.44 / (speed / 3.6) * 1000, target, landing: target,
    release: releasePoint(profile), movement: movementFor(pitch, stat, profile),
    startedAt: 0, control: stat.controlLevel, breakLevel: stat.breakLevel, power: .82,
  }
}

/** Integrated, continuous acceleration: no breakpoint or velocity discontinuity. */
export const movementProgress = (f: PitchFlight, t: number) => Math.pow(clamp(t, 0, 1), 2 + f.pitch.late * 2 + breakScale(f.breakLevel) * .7)
export function pointOnFlight(f: PitchFlight, progress: number) {
  const t = clamp(progress, 0, 1), bend = movementProgress(f, t)
  const gravity = .16 + (f.pitch.id === 'CURVE' ? .18 : 0)
  return { x: lerp(f.release.x, f.landing.x, t) + f.movement.x * (bend - t),
    y: lerp(f.release.y, f.landing.y, t) + f.movement.y * (bend - t) - gravity * t * (1 - t), z: 18.44 * (1 - t) }
}

/** The moment the hitter must commit (≈0.2s before the plate). Faster pitch = earlier commit = less break seen. */
export const decisionPoint = (f: PitchFlight) => clamp(1 - 210 / f.duration, .45, .8)

/** Where the ball looks like it's going at the commit point (straight-line extrapolation). */
export function perceivedLanding(f: PitchFlight) {
  const td = decisionPoint(f)
  const a = pointOnFlight(f, td - .04), b = pointOnFlight(f, td)
  const k = (1 - td) / .04
  return { x: b.x + (b.x - a.x) * k, y: b.y + (b.y - a.y) * k }
}

/** How well this pitch hides inside the previous pitch's tunnel (0–1). */
export function tunnelScore(f: PitchFlight, prev: PitchFlight | null) {
  if (!prev) return 0
  const t = decisionPoint(f)
  const a = pointOnFlight(f, t), b = pointOnFlight(prev, t)
  const early = Math.hypot(a.x - b.x, a.y - b.y)
  const late = Math.hypot(f.landing.x - prev.landing.x, f.landing.y - prev.landing.y)
  const speedGap = Math.abs(f.speed - prev.speed)
  const sameTube = clamp(1 - early / .42, 0, 1)
  const divergence = clamp(late / .75 + speedGap / 22, 0, 1)
  return sameTube * divergence
}

