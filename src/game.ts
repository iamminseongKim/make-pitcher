export type PitchType = 'FOUR_SEAM' | 'SINKER' | 'CUTTER' | 'SPLITTER' | 'CHANGEUP' | 'SLIDER' | 'CURVE' | 'SWEEPER'
export type StatKey = 'velocityLevel' | 'controlLevel' | 'breakLevel'
export type Hand = 'R' | 'L'
export type ArmSlot = 'OVERHAND' | 'THREE_QUARTER' | 'SIDEARM' | 'SUBMARINE'
export type Grade = 'PERFECT' | 'GOOD' | 'EARLY' | 'LATE'
export type Difficulty = 'ROOKIE' | 'PRO' | 'LEGEND'
export const DIFFICULTIES: Record<Difficulty, { label: string; tpMultiplier: number; contactBonus: number; eyeBonus: number }> = {
  ROOKIE: { label: '루키', tpMultiplier: 1, contactBonus: -.1, eyeBonus: -.15 },
  PRO: { label: '프로', tpMultiplier: 1.5, contactBonus: 0, eyeBonus: 0 },
  LEGEND: { label: '레전드', tpMultiplier: 2.2, contactBonus: .1, eyeBonus: .15 },
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

export interface CareerStats {
  wins: number
  losses: number
  strikeouts: number
  innings: number
  runs: number
  games: number
}

export interface PitchDefinition {
  id: PitchType
  name: string
  short: string
  family: 'FASTBALL' | 'OFFSPEED' | 'BREAKING'
  minSpeed: number
  maxSpeed: number
  moveX: number
  moveY: number
  late: number
  color: string
  unlockCost: number
  description: string
}

// moveX: + is glove side, - is arm side (sign is flipped for lefties). moveY: - is up, + is down.
export const PITCHES: PitchDefinition[] = [
  { id: 'FOUR_SEAM', name: '포심 패스트볼', short: '포심', family: 'FASTBALL', minSpeed: 130, maxSpeed: 170, moveX: -8, moveY: -45, late: .55, color: '#5fe6ff', unlockCost: 125, description: '높게 던지면 떠오르듯 배트 위로 지나갑니다' },
  { id: 'SINKER', name: '싱커', short: '싱커', family: 'FASTBALL', minSpeed: 128, maxSpeed: 166, moveX: -30, moveY: 32, late: .72, color: '#72eac1', unlockCost: 115, description: '같은 손 타자 몸쪽으로 파고들어 땅볼 유도' },
  { id: 'CUTTER', name: '커터', short: '커터', family: 'FASTBALL', minSpeed: 124, maxSpeed: 163, moveX: 30, moveY: 8, late: .82, color: '#b0a7ff', unlockCost: 135, description: '반대 손 타자 몸쪽으로 꺾여 배트 손잡이에 맞습니다' },
  { id: 'SPLITTER', name: '스플리터', short: '스플리터', family: 'OFFSPEED', minSpeed: 118, maxSpeed: 154, moveX: -4, moveY: 52, late: .85, color: '#ffb974', unlockCost: 145, description: '직구처럼 오다 바닥으로 사라지는 결정구' },
  { id: 'CHANGEUP', name: '체인지업', short: '체인지업', family: 'OFFSPEED', minSpeed: 112, maxSpeed: 145, moveX: -31, moveY: 28, late: .62, color: '#f7cf83', unlockCost: 125, description: '반대 손 타자 바깥으로 흘러나가며 타이밍 강탈' },
  { id: 'SLIDER', name: '슬라이더', short: '슬라이더', family: 'BREAKING', minSpeed: 115, maxSpeed: 152, moveX: 40, moveY: 22, late: .76, color: '#d096ff', unlockCost: 145, description: '같은 손 타자 바깥으로 도망가는 헛스윙 유도구' },
  { id: 'CURVE', name: '커브', short: '커브', family: 'BREAKING', minSpeed: 100, maxSpeed: 138, moveX: 10, moveY: 65, late: .54, color: '#ff8aaa', unlockCost: 165, description: '하이 패스트볼 다음에 던지면 눈높이가 무너집니다' },
  { id: 'SWEEPER', name: '스위퍼', short: '스위퍼', family: 'BREAKING', minSpeed: 110, maxSpeed: 144, moveX: 58, moveY: 8, late: .70, color: '#88b9ff', unlockCost: 210, description: '존을 가로지르는 극단적인 횡변화' },
]
export const pitchById = (id: PitchType) => PITCHES.find(p => p.id === id)!

export const ARM_SLOTS: Record<ArmSlot, { label: string; angle: string; releaseY: number; width: number }> = {
  OVERHAND: { label: '오버핸드', angle: '12시', releaseY: -.48, width: .10 },
  THREE_QUARTER: { label: '쓰리쿼터', angle: '10시 / 2시', releaseY: -.35, width: .23 },
  SIDEARM: { label: '사이드암', angle: '9시 / 3시', releaseY: -.10, width: .38 },
  SUBMARINE: { label: '언더핸드', angle: '8시 / 4시', releaseY: .12, width: .46 },
}

const smooth = (t: number) => t * t * (3 - 2 * t)
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) }
const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]

export const statSpeed = (pitch: PitchDefinition, stat: PitchStat) => Math.round(lerp(pitch.minSpeed, pitch.maxSpeed, (stat.velocityLevel - 1) / 98) * 10) / 10
export const sweetSpot = (level: number) => lerp(.10, .28, (level - 1) / 98)
export const dispersion = (level: number) => lerp(.62, .035, (level - 1) / 98)
export const breakScale = (level: number) => lerp(.34, 1, (level - 1) / 98)
export const upgradeCost = (level: number) => Math.round(18 + Math.pow(level, 1.48) * 2.4)
export const pitcherLevel = (p: PitcherProfile) => Math.max(1, Math.floor(Object.values(p.arsenal).reduce((n, s) => n + (s.velocityLevel + s.controlLevel + s.breakLevel - 3), 0) / 5) + 1)
export const masteryLevel = (xp: number) => Math.floor(Math.sqrt(xp / 25)) + 1

/* ───────────────────────── Batters & lineups ───────────────────────── */

export type BatHand = 'R' | 'L' | 'S'
export type ZoneStyle = 'LOW' | 'HIGH' | 'IN' | 'OUT' | 'MIDDLE'
export type PitchWeakness = 'FASTBALL' | 'BREAKING' | 'OFFSPEED' | 'NONE'
export interface Batter {
  id: string
  name: string
  number: number
  order: number
  bats: BatHand
  contact: number // 0–1
  power: number
  eye: number
  aggression: number
  zone: ZoneStyle
  weakness: PitchWeakness
  avg: number
  hr: number
}

const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍', '전', '고', '문', '양', '손', '배', '백', '허', '노', '하']
const GIVEN_A = ['민', '현', '준', '지', '성', '도', '태', '재', '승', '우', '진', '영', '동', '상', '건', '한', '주', '규', '시', '은']
const GIVEN_B = ['호', '석', '우', '혁', '빈', '수', '민', '훈', '원', '찬', '재', '윤', '환', '결', '율', '범', '겸', '후', '엽', '규']
export const TEAMS = [
  { name: '인천 해풍', short: '해풍', color: '#e2574c' },
  { name: '대구 청룡', short: '청룡', color: '#4f8cff' },
  { name: '부산 갈매기즈', short: '갈매기', color: '#f2a93b' },
  { name: '광주 호랑이', short: '호랑이', color: '#e84a5f' },
  { name: '수원 성곽', short: '성곽', color: '#3fbf8f' },
  { name: '창원 공룡', short: '공룡', color: '#8a7dff' },
  { name: '대전 불꽃', short: '불꽃', color: '#ff7a30' },
  { name: '서울 쌍둥이', short: '쌍둥이', color: '#d6d6e0' },
]

function batterFor(order: number, strength: number): Batter {
  // Lineup archetypes: table-setters, heart of the order, bottom of the order.
  const role = order <= 2 ? 'TOP' : order <= 5 ? 'HEART' : order === 9 ? 'WEAK' : 'LOW'
  const r = () => Math.random()
  const base = { TOP: [.72, .35, .66], HEART: [.6, .78, .55], LOW: [.52, .5, .45], WEAK: [.45, .3, .38] }[role]
  const contact = clamp(base[0] + (r() - .5) * .22 + strength, .2, .98)
  const power = clamp(base[1] + (r() - .5) * .3 + strength * .8, .1, .99)
  const eye = clamp(base[2] + (r() - .5) * .26 + strength * .6, .1, .98)
  const roll = r()
  const bats: BatHand = roll < .08 ? 'S' : roll < .45 ? 'L' : 'R'
  return {
    id: `${order}-${Math.random().toString(36).slice(2, 7)}`,
    name: pick(SURNAMES) + pick(GIVEN_A) + pick(GIVEN_B),
    number: Math.floor(r() * 98) + 1,
    order, bats, contact, power, eye,
    aggression: clamp(.5 + (r() - .5) * .5 + (role === 'HEART' ? .08 : 0), .2, .9),
    zone: pick(['LOW', 'HIGH', 'IN', 'OUT', 'MIDDLE'] as const),
    weakness: pick(['FASTBALL', 'BREAKING', 'OFFSPEED', 'BREAKING', 'OFFSPEED', 'NONE'] as const),
    avg: Math.round((.215 + contact * .12 + (r() - .5) * .03) * 1000) / 1000,
    hr: Math.round(power * power * 38 + r() * 4),
  }
}

export function makeLineup(strength: number): Batter[] {
  return Array.from({ length: 9 }, (_, i) => batterFor(i + 1, strength))
}

/** A switch hitter always takes the platoon advantage. */
export const batterSide = (b: Batter, pitcherHand: Hand): Hand => b.bats === 'S' ? (pitcherHand === 'R' ? 'L' : 'R') : b.bats
export const ZONE_LABEL: Record<ZoneStyle, string> = { LOW: '로우볼 히터', HIGH: '하이볼 히터', IN: '몸쪽 강함', OUT: '바깥쪽 강함', MIDDLE: '실투 킬러' }
export const WEAK_LABEL: Record<PitchWeakness, string> = { FASTBALL: '빠른 공 약함', BREAKING: '변화구 약함', OFFSPEED: '체인지업·포크 약함', NONE: '약점 없음' }

/** Batter's hot/cold map in catcher view, rows top→bottom, cols left→right (screen). */
export function zoneHeat(b: Batter, side: Hand): number[][] {
  const grid = [[0, 0, 0], [0, .15, 0], [0, 0, 0]]
  const inCol = side === 'R' ? 0 : 2, outCol = 2 - inCol
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    let v = r === 1 && c === 1 ? .35 : 0
    if (b.zone === 'LOW') v += r === 2 ? .55 : r === 0 ? -.45 : .05
    if (b.zone === 'HIGH') v += r === 0 ? .55 : r === 2 ? -.45 : .05
    if (b.zone === 'IN') v += c === inCol ? .55 : c === outCol ? -.4 : 0
    if (b.zone === 'OUT') v += c === outCol ? .55 : c === inCol ? -.4 : 0
    if (b.zone === 'MIDDLE') v += r === 1 && c === 1 ? .5 : (r !== 1 && c !== 1) ? -.35 : 0
    grid[r][c] = clamp(v + b.power * .15 - .08, -1, 1)
  }
  return grid
}

/* ───────────────────────── Game state ───────────────────────── */

export interface PitchLog { pitch: PitchType; speed: number; x: number; y: number; px: number; py: number; call: string; tag: string }
export interface GameState {
  id: number
  opponent: number
  lineup: Batter[]
  batterIndex: number
  inning: number
  outs: number
  balls: number
  strikes: number
  bases: [boolean, boolean, boolean]
  runsAgainst: number
  runsFor: number
  lineScore: number[]
  ourScore: number[]
  inningHits: number
  inningWalks: number
  pitches: number
  strikeouts: number
  hits: number
  walks: number
  abLog: PitchLog[]
  over: boolean
}

export const LEAGUE_TIERS = ['퓨처스리그', '1군 데뷔', '주전 로테이션', '올스타', '월드 클래스']
export const leagueTier = (wins: number) => Math.min(LEAGUE_TIERS.length - 1, Math.floor(wins / 3))
export function newGame(prev?: GameState, difficulty: Difficulty = 'PRO', tier = 0): GameState {
  const opponent = prev ? (prev.opponent + 1 + Math.floor(Math.random() * (TEAMS.length - 1))) % TEAMS.length : Math.floor(Math.random() * TEAMS.length)
  const strength = (difficulty === 'LEGEND' ? .06 : difficulty === 'ROOKIE' ? -.06 : 0) + tier * .035
  return {
    id: (prev?.id ?? 0) + 1, opponent, lineup: makeLineup(strength), batterIndex: 0,
    inning: 1, outs: 0, balls: 0, strikes: 0, bases: [false, false, false], runsAgainst: 0, runsFor: 0,
    lineScore: [0], ourScore: [], inningHits: 0, inningWalks: 0, pitches: 0, strikeouts: 0, hits: 0, walks: 0, abLog: [], over: false,
  }
}

export function defaultProfile(): PitcherProfile {
  return {
    name: 'ROOKIE', height: 185, hand: 'R', armSlot: 'THREE_QUARTER', difficulty: 'PRO', trainingPoints: 90, stamina: 100, created: false,
    arsenal: Object.fromEntries(PITCHES.map(p => [p.id, { unlocked: false, velocityLevel: 1, controlLevel: 1, breakLevel: 1, mastery: 0 }])) as Record<PitchType, PitchStat>,
  }
}
export const defaultCareer = (): CareerStats => ({ wins: 0, losses: 0, strikeouts: 0, innings: 0, runs: 0, games: 0 })

export const SAVE_KEY = 'ace-project-save-v2'
export function loadSave(): { profile: PitcherProfile; game: GameState; career: CareerStats } {
  const base = defaultProfile()
  try {
    const raw = localStorage.getItem(SAVE_KEY) ?? localStorage.getItem('ace-project-save-v1')
    const parsed = JSON.parse(raw || 'null')
    if (!parsed?.profile?.arsenal || !parsed.profile.created) throw new Error('No save')
    const profile: PitcherProfile = {
      ...base, ...parsed.profile,
      arsenal: Object.fromEntries(PITCHES.map(p => [p.id, { ...base.arsenal[p.id], ...parsed.profile.arsenal[p.id] }])) as Record<PitchType, PitchStat>,
    }
    const game: GameState = parsed.game?.lineup?.length === 9 ? { ...newGame(undefined, profile.difficulty), ...parsed.game } : newGame(undefined, profile.difficulty)
    return { profile, game, career: { ...defaultCareer(), ...parsed.career } }
  } catch {
    return { profile: base, game: newGame(), career: defaultCareer() }
  }
}

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

export function pointOnFlight(f: PitchFlight, progress: number) {
  const t = clamp(progress, 0, 1)
  const bend = smooth(clamp((t - f.pitch.late) / (1 - f.pitch.late), 0, 1))
  const x = lerp(f.release.x, f.landing.x - f.movement.x, t) + f.movement.x * bend
  let y = lerp(f.release.y, f.landing.y - f.movement.y, t) + f.movement.y * bend
  if (f.pitch.id === 'CURVE') y -= Math.sin(Math.PI * t) * .18
  return { x, y, z: 18.44 * (1 - t) }
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

/* ───────────────────────── At-bat resolution ───────────────────────── */

export type PitchOutcome = 'CALLED_STRIKE' | 'SWINGING_STRIKE' | 'BALL' | 'FOUL' | 'GROUND_OUT' | 'FLY_OUT' | 'LINE_OUT' | 'POP_OUT' | 'SINGLE' | 'DOUBLE' | 'HOME_RUN' | 'HIT_BY_PITCH'
export const IN_PLAY_OUT: PitchOutcome[] = ['GROUND_OUT', 'FLY_OUT', 'LINE_OUT', 'POP_OUT']
export const HITS: PitchOutcome[] = ['SINGLE', 'DOUBLE', 'HOME_RUN']

export interface AtBatContext {
  batter: Batter
  pitcherHand: Hand
  balls: number
  strikes: number
  inning: number
  difficulty: Difficulty
  previous: PitchFlight | null
  seenSpeeds: number[]
  seenTypes: PitchType[]
  fastest: number
}

export interface PitchResult {
  outcome: PitchOutcome
  swing: boolean
  perceived: { x: number; y: number }
  tunnel: number
  tags: string[]
  barrel: { x: number; y: number }
  sprayAngle: number // -1 (third base) … 1 (first base)
}

export const inZone = (p: { x: number; y: number }, pad = 0) => Math.abs(p.x) <= 1 + pad && Math.abs(p.y) <= 1 + pad

export function resolvePitch(f: PitchFlight, c: AtBatContext): PitchResult {
  const b = c.batter
  const side = batterSide(b, c.pitcherHand)
  const same = side === c.pitcherHand
  const diff = DIFFICULTIES[c.difficulty]
  const late = Math.min(.12, (c.inning - 1) * .012)
  const eye = clamp(b.eye + diff.eyeBonus + late * .5, 0, 1)
  const toInside = (x: number) => side === 'R' ? -x : x // + = inside to this hitter
  const L = f.landing
  const inX = toInside(L.x)
  const tags: string[] = []

  // Hit by pitch: way inside at body height.
  if (inX > 1.85 && L.y > -1.5 && L.y < 1.6) return { outcome: 'HIT_BY_PITCH', swing: false, perceived: L, tunnel: 0, tags: ['몸에 맞는 공'], barrel: L, sprayAngle: 0 }

  // 1) What the hitter sees at the commit point, plus the break he *expects* from the pitch he thinks it is.
  const tunnel = tunnelScore(f, c.previous)
  const td = decisionPoint(f)
  const remaining = 1 - smooth(clamp((td - f.pitch.late) / (1 - f.pitch.late), 0, 1))
  const hides = same && f.pitch.family === 'BREAKING' ? .12 : 0
  const recognize = clamp(.42 + eye * .4 + (f.pitch.family === 'FASTBALL' ? .25 : 0) + (f.pitch.id === 'CURVE' ? .3 : 0) - tunnel * .35 - hides, .05, .95)
  // Eye-level change: high heat, then something down low.
  const eyeLevel = c.previous && c.previous.pitch.family === 'FASTBALL' && c.previous.landing.y < -.55 && L.y > .45 && f.pitch.family !== 'FASTBALL' ? 1 : 0
  const recognized = Math.random() < recognize - eyeLevel * .2
  const typical = Math.min(1, .62 / breakScale(f.breakLevel))
  const armSide = c.pitcherHand === 'R' ? 1 : -1
  const ride = f.pitch.id === 'FOUR_SEAM' ? .55 : 1 // hitters never fully believe the ride
  const expectMove = recognized ? { x: f.movement.x * typical, y: f.movement.y * typical * ride } : { x: -.08 * armSide, y: -.38 }
  const noise = .04 + (1 - eye) * .1
  // Whatever break he didn't expect in the unseen part of the flight becomes miss distance.
  const perceived = {
    x: L.x - (f.movement.x - expectMove.x) * remaining + gauss() * noise,
    y: L.y - (f.movement.y - expectMove.y) * remaining + gauss() * noise,
  }

  // Mid-swing adjustment: good contact hitters chase the ball down with the barrel.
  const adjust = .2 + b.contact * .3 + (td - .5) * .4
  const barrel = { x: lerp(perceived.x, L.x, adjust), y: lerp(perceived.y, L.y, adjust * .8) }

  // 2) Swing decision.
  const pz = Math.max(Math.abs(perceived.x), Math.abs(perceived.y))
  const looksStrike = pz <= 1.04
  let zoneSwing = .7, chase = .3 * Math.exp(-Math.max(0, pz - 1.04) * 2.4)
  const { balls, strikes } = c
  if (balls === 0 && strikes === 0) { zoneSwing *= .72; chase *= .72 }
  if (balls === 3 && strikes === 0) { zoneSwing *= .3; chase *= .15 }
  else if ((balls === 2 && strikes === 0) || (balls === 3 && strikes === 1)) { zoneSwing *= 1.1; chase *= .6 }
  if (strikes === 2) { zoneSwing = .88; chase *= 1.35 }
  chase *= 1.35 - eye * .75
  zoneSwing *= .85 + b.aggression * .3
  chase *= .8 + b.aggression * .4
  // High heat: a rising fastball above the belt looks like a meatball.
  const highHeat = f.pitch.id === 'FOUR_SEAM' && L.y < -.75 && f.speed >= 140
  if (highHeat && strikes === 2) chase *= 1.3
  const swingChance = clamp(looksStrike ? zoneSwing : chase, 0, .97)
  const swing = Math.random() < swingChance

  const actualStrike = inZone(L, .06) || (inZone(L, .14) && Math.random() < .45)
  if (!swing) {
    if (actualStrike) {
      const edge = Math.max(Math.abs(L.x), Math.abs(L.y))
      tags.push(edge > .78 ? '코너 꽉 찬 공' : strikes === 2 ? '얼어붙음' : '지켜봄')
      return { outcome: 'CALLED_STRIKE', swing, perceived, tunnel, tags, barrel, sprayAngle: 0 }
    }
    if (!looksStrike && pz < 1.5) tags.push('골라냄')
    return { outcome: 'BALL', swing, perceived, tunnel, tags, barrel, sprayAngle: 0 }
  }

  // 3) Timing: hitters sit on the fastball and adjust to what they've seen.
  const seenAvg = c.seenSpeeds.length ? c.seenSpeeds.slice(-3).reduce((a, n) => a + n, 0) / Math.min(3, c.seenSpeeds.length) : c.fastest
  let expect = lerp(c.fastest, seenAvg, c.seenSpeeds.length ? .38 : 0)
  if (c.previous) expect = lerp(expect, c.previous.speed, tunnel * .6)
  if ((balls >= 2 && strikes < 2)) expect = lerp(expect, c.fastest, .5)
  const early = Math.min(.85, (expect - f.speed) / 30 * (recognized ? .45 : 1)) // + = out in front
  const reaction = 143 + b.contact * 12 + diff.contactBonus * 30
  const lateness = Math.max(0, f.speed - reaction) / 28
  const timing = Math.abs(early) + lateness * (1 - Math.max(0, early) * .5)
  const repeat = c.seenTypes.slice(-2).filter(t => t === f.pitch.id).length
  const timingErr = Math.max(0, timing - repeat * .12)

  // 4) Bat-to-ball.
  const missX = L.x - barrel.x, missY = L.y - barrel.y
  const spatial = Math.hypot(missX * .9, missY * 1.25)
  const outside = Math.max(0, Math.max(Math.abs(L.x), Math.abs(L.y)) - 1)
  const breakAway = -toInside(f.movement.x) // + = breaking away from the hitter
  let platoon = same ? -.05 : .05
  if (breakAway > .25 && same && toInside(L.x) < -.4) platoon -= breakAway * .22
  if (!same && (f.pitch.id === 'CHANGEUP' || f.pitch.id === 'SPLITTER')) platoon -= .12
  if (same && f.pitch.id === 'CHANGEUP') platoon += .05
  // Back-foot breaking ball to an opposite-hand hitter.
  if (!same && f.pitch.family === 'BREAKING' && toInside(f.movement.x) > .2 && L.y > .6 && inX > .1) platoon -= .1
  if (same && f.pitch.id === 'SINKER') platoon -= .05
  if (!same && f.pitch.id === 'CUTTER' && inX > .3) platoon -= .08
  const weak = b.weakness === f.pitch.family ? -.1 : 0
  const protect = strikes === 2 ? .08 : 0
  const q = b.contact * .55 + .36 + diff.contactBonus + late + protect + platoon + weak
    - spatial * 1.0 - timingErr * .6 - outside * .85 - tunnel * .12 - eyeLevel * .06 - (highHeat ? .1 : 0) + gauss() * .16

  if (tunnel > .45) tags.push('터널')
  if (eyeLevel && spatial > .25) tags.push('눈높이 흔들기')
  if (highHeat && missY < -.25) tags.push('하이 패스트볼')
  if (!looksStrike || outside > .1) { if (!inZone(L)) tags.push('유인구') }
  if (early > .5) tags.push('타이밍 뺏음')
  else if (lateness > .35) tags.push('늦음')
  if (breakAway > .35 && same && spatial > .3) tags.push('도망가는 공')

  if (q < .12) return { outcome: 'SWINGING_STRIKE', swing, perceived, tunnel, tags, barrel, sprayAngle: 0 }
  const spray = (side === 'R' ? -1 : 1) * clamp(early * .9 - lateness * .8 + gauss() * .35, -1, 1) // + pull = toward hitter's pull side
  if (q < .44 || (timingErr > .45 && Math.random() < .6) || (strikes === 2 && q < .6 && Math.random() < .4)) return { outcome: 'FOUL', swing, perceived, tunnel, tags: tags.filter(t => t !== '유인구'), barrel, sprayAngle: spray }

  // 5) Quality of contact → batted ball.
  const center = 1 - clamp(Math.max(Math.abs(L.x), Math.abs(L.y)), 0, 1)
  const heat = zoneHeat(b, side)
  const col = L.x < -.33 ? 0 : L.x > .33 ? 2 : 1, row = L.y < -.33 ? 0 : L.y > .33 ? 2 : 1
  const hot = inZone(L, .1) ? heat[row][col] * .22 : -.1
  const hanging = f.pitch.family !== 'FASTBALL' && L.y < .1 && Math.abs(L.x) < .6 ? .2 : 0
  const jam = f.speed > 138 && inX > .45 && toInside(f.movement.x) > .1 ? .22 : inX > .8 ? .1 : 0
  const exit = q + b.power * .3 + center * .25 + hot + hanging - jam + gauss() * .2 - .12
  if (hanging > 0 && exit > .9) tags.push('실투')
  if (jam > .15) tags.push('먹힌 타구')

  const launch = (perceived.y - L.y) * 1.3 - L.y * .5 + (f.pitch.id === 'SINKER' || f.pitch.id === 'SPLITTER' ? -.25 : 0) + gauss() * .32
  let outcome: PitchOutcome
  if (launch < -.28) outcome = exit > 1.02 ? 'SINGLE' : exit > .98 && Math.random() < .5 ? 'SINGLE' : 'GROUND_OUT'
  else if (launch > .95) outcome = 'POP_OUT'
  else if (launch > .42) outcome = exit > 1.2 && b.power > .45 ? 'HOME_RUN' : exit > 1.08 ? 'DOUBLE' : exit > .98 && Math.random() < .35 ? 'SINGLE' : 'FLY_OUT'
  else outcome = exit > 1.16 && b.power > .6 && Math.random() < .35 ? 'HOME_RUN' : exit > 1.02 ? 'DOUBLE' : exit > .74 ? 'SINGLE' : 'LINE_OUT'
  return { outcome, swing, perceived, tunnel, tags, barrel, sprayAngle: spray }
}

/** Short broadcast-style call for the batter's current approach. */
export function batterMindset(c: { balls: number; strikes: number; seenTypes: PitchType[] }) {
  if (c.strikes === 2) return '커트 모드'
  if (c.balls === 3 && c.strikes === 0) return '하나 기다림'
  if (c.balls >= 2 && c.balls > c.strikes) return '직구 노림'
  const recent = c.seenTypes.slice(-2)
  if (recent.length === 2 && recent.every(t => pitchById(t).family !== 'FASTBALL')) return '변화구 대비'
  if (c.balls === 0 && c.strikes === 0) return '초구 신중'
  return '직구 타이밍'
}

/** Moves runners. Returns runs scored. */
export function advance(bases: [boolean, boolean, boolean], outcome: PitchOutcome): { bases: [boolean, boolean, boolean]; runs: number } {
  const [a, b, c] = bases
  if (outcome === 'BALL' || outcome === 'HIT_BY_PITCH') {
    // Walk: only forced runners move.
    const first = true, second = b || a, third = c || (a && b)
    const runs = a && b && c ? 1 : 0
    return { bases: [first, second, third], runs }
  }
  if (outcome === 'SINGLE') {
    const scoresFromSecond = b && Math.random() < .6
    const runs = (c ? 1 : 0) + (scoresFromSecond ? 1 : 0)
    return { bases: [true, a, b && !scoresFromSecond], runs }
  }
  if (outcome === 'DOUBLE') {
    const scoresFromFirst = a && Math.random() < .45
    const runs = (c ? 1 : 0) + (b ? 1 : 0) + (scoresFromFirst ? 1 : 0)
    return { bases: [false, true, a && !scoresFromFirst], runs }
  }
  if (outcome === 'HOME_RUN') return { bases: [false, false, false], runs: 1 + (a ? 1 : 0) + (b ? 1 : 0) + (c ? 1 : 0) }
  return { bases, runs: 0 }
}

/** Our lineup's half inning, simulated. */
export function simulateOurHalf() {
  const r = Math.random()
  return r < .6 ? 0 : r < .8 ? 1 : r < .9 ? 2 : r < .96 ? 3 : 4
}

/* ───────────────────────── Applying a pitch to the game ───────────────────────── */

export interface PitchEvents { paEnded: boolean; strikeout: boolean; out: boolean; hit: boolean; walk: boolean; runs: number; inningOver: boolean; reward: number; mastery: number }
export interface Call { text: string; tone: 'k' | 'hr' | 'hit' | 'out' | 'ball' | 'strike' | 'foul' }

const CALLS: Record<PitchOutcome, Call> = {
  BALL: { text: '볼', tone: 'ball' },
  CALLED_STRIKE: { text: '스트라이크', tone: 'strike' },
  SWINGING_STRIKE: { text: '헛스윙', tone: 'strike' },
  FOUL: { text: '파울', tone: 'foul' },
  GROUND_OUT: { text: '땅볼 아웃', tone: 'out' },
  FLY_OUT: { text: '뜬공 아웃', tone: 'out' },
  LINE_OUT: { text: '직선타 잡혔다', tone: 'out' },
  POP_OUT: { text: '내야 플라이', tone: 'out' },
  SINGLE: { text: '안타', tone: 'hit' },
  DOUBLE: { text: '2루타', tone: 'hit' },
  HOME_RUN: { text: '홈런', tone: 'hr' },
  HIT_BY_PITCH: { text: '몸에 맞는 공', tone: 'ball' },
}

export function applyOutcome(g: GameState, f: PitchFlight, r: PitchResult): { game: GameState; events: PitchEvents; call: Call } {
  const o = r.outcome
  const next: GameState = { ...g, bases: [...g.bases] as GameState['bases'], lineScore: [...g.lineScore], pitches: g.pitches + 1 }
  const ev: PitchEvents = { paEnded: false, strikeout: false, out: false, hit: false, walk: false, runs: 0, inningOver: false, reward: 0, mastery: 4 }
  let call = { ...CALLS[o] }
  next.abLog = [...g.abLog, { pitch: f.pitch.id, speed: f.speed, x: f.landing.x, y: f.landing.y, px: r.barrel.x, py: r.barrel.y, call: CALLS[o].text, tag: r.tags[0] ?? '' }]
  const score = (runs: number) => { next.runsAgainst += runs; next.lineScore[next.lineScore.length - 1] += runs; ev.runs = runs }

  if (o === 'BALL') {
    next.balls++
    if (next.balls >= 4) { const a = advance(next.bases, 'BALL'); next.bases = a.bases; score(a.runs); ev.walk = true; next.walks++; next.inningWalks++; call = { text: '볼넷', tone: 'ball' } }
  } else if (o === 'HIT_BY_PITCH') {
    const a = advance(next.bases, 'HIT_BY_PITCH'); next.bases = a.bases; score(a.runs); ev.walk = true; next.walks++; next.inningWalks++
  } else if (o === 'CALLED_STRIKE' || o === 'SWINGING_STRIKE') {
    next.strikes++; ev.reward = o === 'SWINGING_STRIKE' ? 3 : 2; ev.mastery = o === 'SWINGING_STRIKE' ? 10 : 7
    if (next.strikes >= 3) {
      ev.strikeout = true; ev.out = true; next.outs++; next.strikeouts++; ev.reward += 20; ev.mastery += 15
      call = { text: o === 'CALLED_STRIKE' ? '루킹 삼진' : '헛스윙 삼진', tone: 'k' }
    }
  } else if (o === 'FOUL') {
    if (next.strikes < 2) next.strikes++
    ev.reward = 1
  } else if (IN_PLAY_OUT.includes(o)) {
    ev.out = true; next.outs++; ev.reward = 10; ev.mastery = 12
  } else {
    const a = advance(next.bases, o); next.bases = a.bases; score(a.runs); ev.hit = true; next.hits++; next.inningHits++; ev.mastery = 2
  }
  ev.paEnded = ev.walk || ev.hit || ev.out
  if (ev.runs) call = { ...call, text: `${call.text} · ${ev.runs}실점` }
  if (ev.paEnded) { next.balls = 0; next.strikes = 0; next.batterIndex = (next.batterIndex + 1) % 9; next.abLog = [] }
  if (next.outs >= 3) {
    ev.inningOver = true; ev.reward += 30
    if (next.inningHits === 0 && next.inningWalks === 0) ev.reward += 25
  }
  return { game: next, events: ev, call }
}

export interface InningSummary { inning: number; allowed: number; ours: number; clean: boolean; finished: 'WIN' | 'LOSS' | 'TIE' | null }
/** Ends the top half, simulates our at-bats, and decides the game. */
export function closeInning(g: GameState): { game: GameState; summary: InningSummary } {
  const allowed = g.lineScore[g.lineScore.length - 1]
  const clean = g.inningHits === 0 && g.inningWalks === 0
  let ours = 0, finished: InningSummary['finished'] = null
  if (g.inning >= 9 && g.runsFor > g.runsAgainst) finished = 'WIN'
  else {
    ours = simulateOurHalf()
    const runsFor = g.runsFor + ours
    if (g.inning >= 9) finished = runsFor > g.runsAgainst ? 'WIN' : runsFor < g.runsAgainst ? 'LOSS' : g.inning >= 12 ? 'TIE' : null
  }
  const next: GameState = {
    ...g, runsFor: g.runsFor + ours, ourScore: [...g.ourScore, ours], outs: 0, balls: 0, strikes: 0, bases: [false, false, false],
    inningHits: 0, inningWalks: 0, abLog: [], over: finished !== null,
    inning: finished ? g.inning : g.inning + 1, lineScore: finished ? g.lineScore : [...g.lineScore, 0],
  }
  return { game: next, summary: { inning: g.inning, allowed, ours, clean, finished } }
}
