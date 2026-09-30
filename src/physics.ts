import { traitActive, type Trait, type Effort } from './arcade'
import { ageEffects } from './retirement'
import { ARM_SLOTS, breakScale, clamp, dispersion, lerp, statSpeed, sweetSpot, type ArmSlot, type Grade, type PitchDefinition, type PitchStat, type PitcherProfile } from './game'

/* ───────────────────────── Pitcher body ───────────────────────── */

export const MOUND_TO_PLATE = 18.44
/** Reference extension the base flight time is balanced around. */
export const BASE_EXTENSION = 1.8

/** How far in front of the rubber the ball leaves the hand (m). Height and a long stride add extension. */
export function extensionOf(p: Pick<PitcherProfile, 'height' | 'armSlot'>) {
  const slot = { OVERHAND: .05, THREE_QUARTER: .1, SIDEARM: 0, SUBMARINE: -.05 }[p.armSlot]
  return Math.round(clamp(1.55 + (p.height - 160) * .012 + slot, 1.4, 2.4) * 100) / 100
}
/** Release height above the ground (m). */
export function releaseHeightOf(p: Pick<PitcherProfile, 'height' | 'armSlot'>) {
  const ratio = { OVERHAND: .97, THREE_QUARTER: .88, SIDEARM: .64, SUBMARINE: .34 }[p.armSlot]
  return Math.round(p.height / 100 * ratio * 100) / 100
}
/**
 * Physical trade-offs. Height buys extension, plane and ride, but long levers are harder to repeat
 * (command spread) and a big frame burns more energy per pitch. Compact pitchers get the reverse.
 * Neutral band: 178–188 cm.
 */
export function physiqueCost(height: number) {
  const tall = clamp((height - 188) / 22, 0, 1), short = clamp((178 - height) / 18, 0, 1)
  return { commandMul: 1 + tall * .35 - short * .12, staminaMul: 1 + tall * .2 - short * .08 }
}
/** 0 = flat approach, 1 = steep downhill plane (tall, over-the-top). */
export const planeSteepness = (releaseHeight: number) => clamp((releaseHeight - 1.45) / .45, 0, 1)
/** Four-seam ride multiplier: backspin axis is purest over the top, and a taller frame adds carry. */
function rideMultiplier(p: PitcherProfile) {
  const slot = { OVERHAND: 1.35, THREE_QUARTER: 1, SIDEARM: .6, SUBMARINE: .3 }[p.armSlot]
  return slot * (1 + (p.height - 185) / 200)
}

/* ───────────────────────── Flight model ───────────────────────── */

export interface PitchFlight {
  trait?: Trait
  effort?: Effort
  focused?: boolean
  /** Arm slot that threw it (shapes the path). */
  slot?: ArmSlot
  pitch: PitchDefinition
  speed: number
  /** What the hitter's clock feels: extension shortens the effective distance. */
  perceivedSpeed: number
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
  /** Distance from the meter sweet spot (0 = dead center). */
  timingError: number
  /** Critical miss: the pitch hangs down the middle. */
  meatball: boolean
  /** Induced vertical break, cm (+ = rides against gravity). */
  ivb: number
  /** Vertical approach angle at the plate, degrees (more negative = steeper). */
  vaa: number
  extension: number
  releaseHeight: number
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
  const flat = profile.armSlot === 'SIDEARM' ? .4 : profile.armSlot === 'SUBMARINE' ? .6 : profile.armSlot === 'OVERHAND' ? -.2 : 0
  const ride = pitch.id === 'FOUR_SEAM' ? rideMultiplier(profile) : 1 - flat * .6
  return { x: (pitch.moveX / 65) * scale * side * (1 + flat), y: (pitch.moveY / 65) * scale * ride }
}

/** 1 game unit of vertical movement ≈ 55cm of break (zone half-height ≈ 28cm, drawn with perspective). */
export const ivbCm = (movementY: number) => Math.round(-movementY * 55)

/** Vertical approach angle from release height, target height, flight time and IVB (constant-acceleration model). */
export function approachAngle(releaseHeight: number, extension: number, speedKmh: number, targetY: number, ivb: number) {
  const dist = MOUND_TO_PLATE - extension
  const v = speedKmh / 3.6
  const T = dist / v
  const plateH = .75 - targetY * .28
  const a = 9.81 - 2 * (ivb / 100) / (T * T)
  const vy0 = (plateH - releaseHeight + .5 * a * T * T) / T
  const vyT = vy0 - a * T
  return Math.round(Math.atan2(vyT, v) * 180 / Math.PI * 10) / 10
}

function body(profile: PitcherProfile, speed: number) {
  const extension = extensionOf(profile), releaseHeight = releaseHeightOf(profile)
  const effective = (MOUND_TO_PLATE - extension) / (MOUND_TO_PLATE - BASE_EXTENSION)
  return { extension, releaseHeight, duration: MOUND_TO_PLATE * effective / (speed / 3.6) * 1000, perceivedSpeed: Math.round(speed / effective * 10) / 10 }
}

/* ───────────────────────── Release timing ───────────────────────── */

export const SWEET_CENTER = .82
/** Distance past the sweet window that turns a pitch into a hanging meatball. */
export const MEATBALL_MISS = .14
/**
 * Meter position → release quality. `meter` runs 0→1 on the way up and 1→2 on the way back,
 * so a late release after the peak is measured along the needle's path, not mirrored.
 */
export function releaseQuality(meter: number, controlLevel: number) {
  const half = sweetSpot(controlLevel) / 2
  const error = meter - SWEET_CENTER
  const miss = Math.max(0, Math.abs(error) - half)
  const inside = miss === 0
  // Strict, continuous spread: dead center ≈ 0.1× dispersion, edge of window 0.3×, grows 7× per unit of miss.
  const spreadMul = inside ? .1 + .2 * (Math.abs(error) / half) : .3 + miss * 7
  const meatball = miss > MEATBALL_MISS || meter <= .02
  const grade: Grade = meatball ? 'MISS' : inside ? 'PERFECT' : miss <= .05 ? 'GOOD' : error < 0 ? 'EARLY' : 'LATE'
  return { grade, error, miss, spreadMul, meatball, power: meter <= 1 ? meter : Math.max(0, 2 - meter) }
}

const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) }

/** @param meter needle position along its path (0–2). Values ≤ 1 behave like the old "power". */
export function createFlight(pitch: PitchDefinition, stat: PitchStat, profile: PitcherProfile, target: { x: number; y: number }, meter: number, options: { effort?: Effort; focused?: boolean } = {}): PitchFlight {
  const q = releaseQuality(meter, stat.controlLevel)
  const power = q.power
  // Fatigue: below 40 stamina the arm drags — velocity drops and command spreads.
  const tired = profile.stamina < 40 ? (40 - profile.stamina) / 40 * .45 : 0
  const overthrow = meter > .9 && meter <= 1 ? (meter - .9) * 1.8 : 0
  const aging = ageEffects(profile.age ?? 25)
  const trait = traitActive(stat)
  const controlMul = (trait === 'command' ? .8 : 1) * (options.focused && q.grade === 'PERFECT' ? .55 : 1) * (options.effort === 'power' ? 1.3 : 1)
  const spread = controlMul * dispersion(stat.controlLevel) * q.spreadMul * physiqueCost(profile.height).commandMul * aging.commandMul + tired * .4 + overthrow * .3
  const angle = Math.random() * Math.PI * 2
  const offset = spread * (.35 + Math.random() * .65)
  let movement = movementFor(pitch, stat, profile)
  let landing: { x: number; y: number }
  let speed = statSpeed(pitch, stat) + (options.effort === 'power' ? 3 : 0) - aging.veloLoss - (1 - power) * 8 - tired * 9
  if (q.meatball) {
    // Critical miss: the ball slips, loses its bite and drifts belt-high over the heart of the plate.
    movement = { x: movement.x * .35, y: movement.y * .35 }
    landing = { x: gauss() * .14, y: -.08 + gauss() * .12 }
    speed -= 5
  } else {
    // A missed release pulls the ball toward the middle, proportional to how badly it was missed.
    const pull = Math.min(.14, q.miss)
    landing = {
      x: lerp(target.x, 0, pull) + Math.cos(angle) * offset,
      y: lerp(target.y, 0, pull) + Math.sin(angle) * offset + (q.grade === 'LATE' ? .1 : q.grade === 'EARLY' ? -.08 : 0),
    }
  }
  speed = Math.round(speed * 10) / 10
  const b = body(profile, speed), ivb = ivbCm(movement.y)
  return {
    trait, effort: options.effort, focused: options.focused, slot: profile.armSlot, pitch, speed, perceivedSpeed: b.perceivedSpeed, grade: q.grade, duration: b.duration, target, landing,
    release: releasePoint(profile), movement, startedAt: performance.now(), control: stat.controlLevel, breakLevel: stat.breakLevel, power,
    timingError: q.error, meatball: q.meatball, ivb, vaa: approachAngle(b.releaseHeight, b.extension, speed, landing.y, ivb), extension: b.extension, releaseHeight: b.releaseHeight,
  }
}

export function createPreviewFlight(pitch: PitchDefinition, stat: PitchStat, profile: PitcherProfile, target: { x: number; y: number }): PitchFlight {
  const speed = Math.round((statSpeed(pitch, stat) - ageEffects(profile.age ?? 25).veloLoss) * 10) / 10
  const b = body(profile, speed), movement = movementFor(pitch, stat, profile), ivb = ivbCm(movement.y)
  return {
    trait: traitActive(stat), slot: profile.armSlot, pitch, speed, perceivedSpeed: b.perceivedSpeed, grade: 'PERFECT', duration: b.duration, target, landing: target,
    release: releasePoint(profile), movement, startedAt: 0, control: stat.controlLevel, breakLevel: stat.breakLevel, power: SWEET_CENTER,
    timingError: 0, meatball: false, ivb, vaa: approachAngle(b.releaseHeight, b.extension, speed, target.y, ivb), extension: b.extension, releaseHeight: b.releaseHeight,
  }
}

/** Each pitch bends continuously; hard fastball variants hold their line longer, while a curve falls earlier. */
const PATH_POWER: Record<PitchDefinition['id'], number> = {
  FOUR_SEAM: 3.1, SINKER: 3.25, CUTTER: 3.55, SPLITTER: 3.65,
  CHANGEUP: 2.7, SLIDER: 2.85, CURVE: 2.1, SWEEPER: 2.65,
}
export const movementProgress = (f: PitchFlight, t: number) => Math.pow(clamp(t, 0, 1), PATH_POWER[f.pitch.id] + (breakScale(f.breakLevel) - .5) * .35)
export function pointOnFlight(f: PitchFlight, progress: number) {
  const t = clamp(progress, 0, 1), bend = movementProgress(f, t)
  const shape = f.slot ? ARM_SLOTS[f.slot] : ARM_SLOTS.THREE_QUARTER
  const gravity = shape.hop + (f.pitch.id === 'CURVE' ? .38 * (.55 + breakScale(f.breakLevel) * .45) : 0)
  // Low slots sweep out toward the arm side and come back across the plate (crossfire).
  const bow = shape.bow * Math.sign(f.release.x) * t * (1 - t)
  return { x: lerp(f.release.x, f.landing.x, t) + f.movement.x * (bend - t) + bow,
    y: lerp(f.release.y, f.landing.y, t) + f.movement.y * (bend - t) - gravity * t * (1 - t), z: MOUND_TO_PLATE * (1 - t) }
}

/**
 * The moment the hitter must commit (≈0.21s before the plate). Faster pitch = earlier commit = less break seen.
 * `latencyMs` is the league's recognition latency: + = slower hitters who must decide earlier.
 */
export const decisionPoint = (f: PitchFlight, latencyMs = 0) => clamp(1 - (210 + latencyMs) / f.duration, .4, .82)

/** Where the ball looks like it's going at the commit point (straight-line extrapolation). */
export function perceivedLanding(f: PitchFlight, latencyMs = 0) {
  const td = decisionPoint(f, latencyMs)
  const a = pointOnFlight(f, td - .04), b = pointOnFlight(f, td)
  const k = (1 - td) / .04
  return { x: b.x + (b.x - a.x) * k, y: b.y + (b.y - a.y) * k }
}

/* ───────────────────────── Tunneling ───────────────────────── */

/** Tunnel point ≈ 25 ft (7.6 m) in front of the plate: two pitches must look identical up to here. */
export const TUNNEL_DISTANCE = 7.6
export const TUNNEL_POINT = 1 - TUNNEL_DISTANCE / MOUND_TO_PLATE
/** How far apart (game units) two pitches may be at the tunnel point and still read as the same pitch. */
export const TUNNEL_TOLERANCE = .85
const smooth = (x: number) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t) }

export interface TunnelRead { score: number; early: number; late: number; pair: boolean }
/** How well this pitch hides inside the previous pitch's tunnel. */
export function tunnelRead(f: PitchFlight, prev: PitchFlight | null): TunnelRead {
  if (!prev) return { score: 0, early: 0, late: 0, pair: false }
  const a = pointOnFlight(f, TUNNEL_POINT), b = pointOnFlight(prev, TUNNEL_POINT)
  const early = Math.hypot(a.x - b.x, a.y - b.y)
  const late = Math.hypot(f.landing.x - prev.landing.x, f.landing.y - prev.landing.y)
  const speedGap = Math.abs(f.speed - prev.speed)
  // High-ride fastball followed by something that falls off the table: the classic north-south tunnel.
  const pair = prev.pitch.family === 'FASTBALL' && prev.ivb >= 28 && f.movement.y - prev.movement.y > .75
  const sameTube = smooth(1 - early / TUNNEL_TOLERANCE)
  const divergence = clamp(late / .75 + speedGap / 22 + (pair ? .25 : 0), 0, 1)
  return { score: sameTube * divergence, early, late, pair }
}
export const tunnelScore = (f: PitchFlight, prev: PitchFlight | null) => tunnelRead(f, prev).score
