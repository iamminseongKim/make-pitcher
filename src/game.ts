export type PitchType = 'FOUR_SEAM' | 'SINKER' | 'CUTTER' | 'SPLITTER' | 'CHANGEUP' | 'SLIDER' | 'CURVE' | 'SWEEPER'
export type StatKey = 'velocityLevel' | 'controlLevel' | 'breakLevel'
export type Hand = 'R' | 'L'
export type ArmSlot = 'OVERHAND' | 'THREE_QUARTER' | 'SIDEARM' | 'SUBMARINE'
export type Grade = 'PERFECT' | 'GOOD' | 'EARLY' | 'LATE'
export type Difficulty = 'ROOKIE' | 'PRO' | 'LEGEND'
export const DIFFICULTIES: Record<Difficulty, { label: string; tpMultiplier: number; contactBonus: number; description: string }> = {
  ROOKIE: { label: '루키', tpMultiplier: 1, contactBonus: -.12, description: '타자 반응이 느립니다 · TP ×1.0' },
  PRO: { label: '프로', tpMultiplier: 1.5, contactBonus: 0, description: '균형 잡힌 승부 · TP ×1.5' },
  LEGEND: { label: '레전드', tpMultiplier: 2.2, contactBonus: .17, description: '정교한 타격 · TP ×2.2' },
}
export const STARTER_LEVELS = [0, 8, 5, 2] as const

export interface PitchStat {
  unlocked: boolean
  velocityLevel: number
  controlLevel: number
  breakLevel: number
  mastery: number
}

export interface PitcherProfile {
  name: string
  height: number
  hand: Hand
  armSlot: ArmSlot
  difficulty: Difficulty
  trainingPoints: number
  stamina: number
  arsenal: Record<PitchType, PitchStat>
  created: boolean
}

export interface GameProgress {
  inning: number
  outs: number
  balls: number
  strikes: number
  strikeouts: number
  hits: number
  walks: number
  pitches: number
  bestStreak: number
  streak: number
}

export interface PitchDefinition {
  id: PitchType
  name: string
  short: string
  family: string
  minSpeed: number
  maxSpeed: number
  moveX: number
  moveY: number
  late: number
  color: string
  unlockCost: number
  description: string
}

export const PITCHES: PitchDefinition[] = [
  { id: 'FOUR_SEAM', name: '포심 패스트볼', short: '포심', family: 'FASTBALL', minSpeed: 130, maxSpeed: 170, moveX: 0, moveY: -45, late: .55, color: '#5fe6ff', unlockCost: 125, description: '높은 코스로 솟구치는 강속구' },
  { id: 'SINKER', name: '싱커', short: '싱커', family: 'FASTBALL', minSpeed: 128, maxSpeed: 166, moveX: -28, moveY: 34, late: .72, color: '#72eac1', unlockCost: 115, description: '몸쪽으로 파고들며 가라앉는 공' },
  { id: 'CUTTER', name: '커터', short: '커터', family: 'FASTBALL', minSpeed: 124, maxSpeed: 163, moveX: 32, moveY: 8, late: .82, color: '#b0a7ff', unlockCost: 135, description: '플레이트 앞에서 예리하게 꺾이는 공' },
  { id: 'SPLITTER', name: '스플리터', short: '스플리터', family: 'OFFSPEED', minSpeed: 118, maxSpeed: 154, moveX: 3, moveY: 52, late: .85, color: '#ffb974', unlockCost: 145, description: '타자 앞에서 급격히 떨어지는 공' },
  { id: 'CHANGEUP', name: '체인지업', short: '체인지업', family: 'OFFSPEED', minSpeed: 112, maxSpeed: 145, moveX: -31, moveY: 28, late: .62, color: '#f7cf83', unlockCost: 125, description: '직구와 같은 폼에서 타이밍을 뺏는 공' },
  { id: 'SLIDER', name: '슬라이더', short: '슬라이더', family: 'BREAKING', minSpeed: 115, maxSpeed: 152, moveX: 40, moveY: 24, late: .76, color: '#d096ff', unlockCost: 145, description: '대각선으로 날카롭게 도망가는 공' },
  { id: 'CURVE', name: '커브', short: '커브', family: 'BREAKING', minSpeed: 100, maxSpeed: 138, moveX: 6, moveY: 65, late: .54, color: '#ff8aaa', unlockCost: 165, description: '큰 호를 그리며 폭포수처럼 떨어지는 공' },
  { id: 'SWEEPER', name: '스위퍼', short: '스위퍼', family: 'BREAKING', minSpeed: 110, maxSpeed: 144, moveX: 58, moveY: 10, late: .70, color: '#88b9ff', unlockCost: 210, description: '존을 가로지르는 극단적인 횡변화' },
]

export const ARM_SLOTS: Record<ArmSlot, { label: string; angle: string; releaseY: number; width: number }> = {
  OVERHAND: { label: '오버핸드', angle: '12시', releaseY: -.48, width: .10 },
  THREE_QUARTER: { label: '쓰리쿼터', angle: '10시 / 2시', releaseY: -.35, width: .23 },
  SIDEARM: { label: '사이드암', angle: '9시 / 3시', releaseY: -.10, width: .38 },
  SUBMARINE: { label: '언더핸드', angle: '8시 / 4시', releaseY: .12, width: .46 },
}

export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const statSpeed = (pitch: PitchDefinition, stat: PitchStat) => Math.round(lerp(pitch.minSpeed, pitch.maxSpeed, (stat.velocityLevel - 1) / 98) * 10) / 10
export const sweetSpot = (level: number) => lerp(.10, .28, (level - 1) / 98)
export const dispersion = (level: number) => lerp(.76, .035, (level - 1) / 98)
export const breakScale = (level: number) => lerp(.24, 1, (level - 1) / 98)
export const upgradeCost = (level: number) => Math.round(18 + Math.pow(level, 1.48) * 2.4)
export const pitcherLevel = (p: PitcherProfile) => Math.max(1, Math.floor(Object.values(p.arsenal).reduce((n, s) => n + (s.velocityLevel + s.controlLevel + s.breakLevel - 3), 0) / 5) + 1)
export const masteryLevel = (xp: number) => Math.floor(Math.sqrt(xp / 25)) + 1

export function defaultProfile(): PitcherProfile {
  return {
    name: 'ROOKIE', height: 185, hand: 'R', armSlot: 'THREE_QUARTER', difficulty: 'PRO', trainingPoints: 90, stamina: 100, created: false,
    arsenal: Object.fromEntries(PITCHES.map(p => [p.id, {
      unlocked: false,
      velocityLevel: 1, controlLevel: 1, breakLevel: 1, mastery: 0,
    }])) as Record<PitchType, PitchStat>,
  }
}

export function defaultProgress(): GameProgress {
  return { inning: 1, outs: 0, balls: 0, strikes: 0, strikeouts: 0, hits: 0, walks: 0, pitches: 0, bestStreak: 0, streak: 0 }
}

export function loadSave(): { profile: PitcherProfile; progress: GameProgress } {
  try {
    const parsed = JSON.parse(localStorage.getItem('ace-project-save-v1') || 'null')
    if (!parsed?.profile?.arsenal || !parsed?.progress) throw new Error('No save')
    if (!parsed.profile.created) return { profile: defaultProfile(), progress: defaultProgress() }
    const base = defaultProfile()
    return {
      profile: {
        ...base, ...parsed.profile,
        arsenal: Object.fromEntries(PITCHES.map(p => [p.id, { ...base.arsenal[p.id], ...parsed.profile.arsenal[p.id] }])) as Record<PitchType, PitchStat>,
      },
      progress: { ...defaultProgress(), ...parsed.progress },
    }
  } catch {
    return { profile: defaultProfile(), progress: defaultProgress() }
  }
}

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

export function createFlight(pitch: PitchDefinition, stat: PitchStat, profile: PitcherProfile, target: { x: number; y: number }, power: number): PitchFlight {
  const width = sweetSpot(stat.controlLevel)
  const error = power - .82
  const grade: Grade = Math.abs(error) <= width / 2 ? 'PERFECT' : Math.abs(error) <= width / 2 + .12 ? 'GOOD' : error < 0 ? 'EARLY' : 'LATE'
  const staminaPenalty = profile.stamina < 25 ? .25 : 0
  const powerPenalty = power > .9 ? (power - .9) * 1.8 : 0
  const spread = dispersion(stat.controlLevel) * (grade === 'PERFECT' ? .09 : grade === 'GOOD' ? .34 : .85 + staminaPenalty + powerPenalty)
  const angle = Math.random() * Math.PI * 2
  const offset = spread * (.45 + Math.random() * .55)
  const landing = { x: target.x + Math.cos(angle) * offset + (grade === 'EARLY' ? -.12 : grade === 'LATE' ? .12 : 0), y: target.y + Math.sin(angle) * offset }
  const side = profile.hand === 'R' ? 1 : -1
  const slot = ARM_SLOTS[profile.armSlot]
  const heightOffset = (profile.height - 185) / 90
  const scale = breakScale(stat.breakLevel)
  const speed = Math.round((statSpeed(pitch, stat) - (1 - power) * 8) * 10) / 10
  return {
    pitch, speed, grade, duration: 18.44 / (speed / 3.6) * 1000,
    target, landing,
    release: { x: side * slot.width, y: slot.releaseY - heightOffset },
    movement: { x: (pitch.moveX / 65) * scale * side, y: (pitch.moveY / 65) * scale },
    startedAt: performance.now(), control: stat.controlLevel, breakLevel: stat.breakLevel, power,
  }
}

export function createPreviewFlight(pitch: PitchDefinition, stat: PitchStat, profile: PitcherProfile, target: { x: number; y: number }): PitchFlight {
  const side = profile.hand === 'R' ? 1 : -1
  const slot = ARM_SLOTS[profile.armSlot]
  const scale = breakScale(stat.breakLevel)
  const speed = statSpeed(pitch, stat)
  return {
    pitch, speed, grade: 'PERFECT', duration: 18.44 / (speed / 3.6) * 1000,
    target, landing: target,
    release: { x: side * slot.width, y: slot.releaseY - (profile.height - 185) / 90 },
    movement: { x: pitch.moveX / 65 * scale * side, y: pitch.moveY / 65 * scale },
    startedAt: 0, control: stat.controlLevel, breakLevel: stat.breakLevel, power: .82,
  }
}

const smooth = (t: number) => t * t * (3 - 2 * t)
export function pointOnFlight(f: PitchFlight, progress: number) {
  const t = clamp(progress, 0, 1)
  const bend = smooth(clamp((t - f.pitch.late) / (1 - f.pitch.late), 0, 1))
  const preBreakX = f.landing.x - f.movement.x
  const preBreakY = f.landing.y - f.movement.y
  const x = lerp(f.release.x, preBreakX, t) + f.movement.x * bend
  let y = lerp(f.release.y, preBreakY, t) + f.movement.y * bend
  if (f.pitch.id === 'CURVE') y -= Math.sin(Math.PI * t) * .18
  return { x, y, z: 18.44 * (1 - t) }
}

export type PitchOutcome = 'CALLED_STRIKE' | 'SWINGING_STRIKE' | 'BALL' | 'FOUL' | 'GROUND_OUT' | 'FLY_OUT' | 'HIT'

export function resolvePitch(f: PitchFlight, inning: number, difficulty: Difficulty = 'PRO'): PitchOutcome {
  const inZone = Math.abs(f.landing.x) <= 1.03 && Math.abs(f.landing.y) <= 1.03
  const edge = Math.max(Math.abs(f.landing.x), Math.abs(f.landing.y))
  const deception = (f.speed - 100) / 100 + f.breakLevel / 190 + (f.grade === 'PERFECT' ? .13 : 0)
  const difficultyFactor = Math.min(.21, (inning - 1) * .018) + DIFFICULTIES[difficulty].contactBonus
  const roll = Math.random()
  const chase = !inZone && Math.abs(f.landing.x) < 1.42 && Math.abs(f.landing.y) < 1.42 && roll < .26 + deception * .28 - DIFFICULTIES[difficulty].contactBonus * .35
  const swing = inZone ? roll < .67 + difficultyFactor : chase
  if (!swing) return inZone ? 'CALLED_STRIKE' : 'BALL'
  const contact = Math.random() + difficultyFactor - deception * .36 - (edge > .72 ? .11 : 0)
  if (contact < .37) return 'SWINGING_STRIKE'
  if (contact < .62) return 'FOUL'
  if (contact < .83) return Math.random() < .66 ? 'GROUND_OUT' : 'FLY_OUT'
  return 'HIT'
}
