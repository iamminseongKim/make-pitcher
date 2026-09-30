import { timingRead } from './velocity'
import { freshArcade, rewardArcade, type ArcadeState, type Trait } from './arcade'
import { decisionPoint, movementProgress, physiqueCost, planeSteepness, tunnelRead, type PitchFlight } from './physics'
export { physiqueCost, createFlight, createPreviewFlight, pointOnFlight, decisionPoint, perceivedLanding, tunnelScore, tunnelRead, releaseQuality, extensionOf, releaseHeightOf, approachAngle, planeSteepness, TUNNEL_POINT, SWEET_CENTER, MEATBALL_MISS } from './physics'
export type { PitchFlight, TunnelRead } from './physics'
import { TIERS, newSeason, normalizeSeason, tierOf, type Season } from './season'
import { ageEffects } from './retirement'
export type PitchType = 'FOUR_SEAM' | 'SINKER' | 'CUTTER' | 'SPLITTER' | 'CHANGEUP' | 'SLIDER' | 'CURVE' | 'SWEEPER'
export type StatKey = 'velocityLevel' | 'controlLevel' | 'breakLevel'
export type Hand = 'R' | 'L'
export type ArmSlot = 'OVERHAND' | 'THREE_QUARTER' | 'SIDEARM' | 'SUBMARINE'
/** MISS = critical miss on the release meter → hanging meatball. */
export type Grade = 'PERFECT' | 'GOOD' | 'EARLY' | 'LATE' | 'MISS'
export const STARTER_LEVELS = [0, 8, 5, 2] as const

export interface PitchStat {
  trait?: Trait
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
  trainingPoints: number
  stamina: number
  /** Stamina the arm could not recover before this start (overuse in the last game). */
  fatigue: number
  /** Current age; +1 every new season year. */
  age: number
  /** Age at the draft. */
  startAge: number
  arsenal: Record<PitchType, PitchStat>
  created: boolean
  /** Club picked in each league (tier → index in TIERS[tier].teams). Picked on arrival. */
  clubs?: Partial<Record<number, number>>
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
  { id: 'FOUR_SEAM', name: '포심 패스트볼', short: '포심', family: 'FASTBALL', minSpeed: 130, maxSpeed: 170, moveX: -8, moveY: -45, late: .55, color: '#e63b58', unlockCost: 125, description: '높게 던지면 떠오르듯 배트 위로 지나갑니다' },
  { id: 'SINKER', name: '싱커', short: '싱커', family: 'FASTBALL', minSpeed: 128, maxSpeed: 166, moveX: -30, moveY: 32, late: .72, color: '#ff9d16', unlockCost: 115, description: '같은 손 타자 몸쪽으로 파고들어 땅볼 유도' },
  { id: 'CUTTER', name: '커터', short: '커터', family: 'FASTBALL', minSpeed: 124, maxSpeed: 163, moveX: 30, moveY: 8, late: .82, color: '#b0a7ff', unlockCost: 135, description: '반대 손 타자 몸쪽으로 꺾여 배트 손잡이에 맞습니다' },
  { id: 'SPLITTER', name: '스플리터', short: '스플리터', family: 'OFFSPEED', minSpeed: 118, maxSpeed: 154, moveX: -4, moveY: 52, late: .85, color: '#ffb974', unlockCost: 145, description: '직구처럼 오다 바닥으로 사라지는 결정구' },
  { id: 'CHANGEUP', name: '체인지업', short: '체인지업', family: 'OFFSPEED', minSpeed: 112, maxSpeed: 145, moveX: -31, moveY: 28, late: .62, color: '#31bf64', unlockCost: 125, description: '반대 손 타자 바깥으로 흘러나가며 타이밍 강탈' },
  { id: 'SLIDER', name: '슬라이더', short: '슬라이더', family: 'BREAKING', minSpeed: 115, maxSpeed: 152, moveX: 40, moveY: 22, late: .76, color: '#e3d52a', unlockCost: 145, description: '같은 손 타자 바깥으로 도망가는 헛스윙 유도구' },
  { id: 'CURVE', name: '커브', short: '커브', family: 'BREAKING', minSpeed: 100, maxSpeed: 138, moveX: 10, moveY: 65, late: .54, color: '#ff8aaa', unlockCost: 165, description: '하이 패스트볼 다음에 던지면 눈높이가 무너집니다' },
  { id: 'SWEEPER', name: '스위퍼', short: '스위퍼', family: 'BREAKING', minSpeed: 110, maxSpeed: 144, moveX: 58, moveY: 8, late: .70, color: '#88b9ff', unlockCost: 210, description: '존을 가로지르는 극단적인 횡변화' },
]
export const pitchById = (id: PitchType) => PITCHES.find(p => p.id === id)!

/**
 * Release point (zone units, catcher view) and path shape per arm slot.
 * hop: upward hump of the path (a submarine ball climbs, then falls) · bow: outward sweep toward the arm side.
 */
export const ARM_SLOTS: Record<ArmSlot, { label: string; angle: string; releaseY: number; width: number; hop: number; bow: number }> = {
  OVERHAND: { label: '오버핸드', angle: '12시', releaseY: -1.2, width: .1, hop: 0, bow: 0 },
  THREE_QUARTER: { label: '쓰리쿼터', angle: '10시 / 2시', releaseY: -.7, width: .45, hop: .16, bow: .25 },
  SIDEARM: { label: '사이드암', angle: '9시 / 3시', releaseY: .1, width: 1.05, hop: .6, bow: 1 },
  SUBMARINE: { label: '언더핸드', angle: '8시 / 4시', releaseY: 1.4, width: .75, hop: 1.6, bow: .5 },
}

export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) }
const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]

export const statSpeed = (pitch: PitchDefinition, stat: PitchStat) => Math.round(lerp(pitch.minSpeed, pitch.maxSpeed, (stat.velocityLevel - 1) / 98) * 10) / 10
/** Width of the PERFECT window on the release meter (fraction of the gauge). */
export const sweetSpot = (level: number) => lerp(.08, .22, (level - 1) / 98)
export const dispersion = (level: number) => lerp(.62, .035, (level - 1) / 98)
export const breakScale = (level: number) => lerp(.5, 1, (level - 1) / 98)
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

const US_FIRST = ['James', 'Luis', 'Marcus', 'Diego', 'Alex', 'Kenji', 'Carlos', 'Ryan', 'Evan', 'Tyler', 'Jose', 'Mason', 'Andre', 'Noah', 'Rafael', 'Cody', 'Hunter', 'Miguel', 'Jordan', 'Owen', 'Yuki', 'Trey', 'Mateo', 'Brandon']
const US_LAST = ['Carter', 'Rivera', 'Reed', 'Santos', 'Brooks', 'Mori', 'Vega', 'Hayes', 'Cole', 'Walker', 'Ortiz', 'Bennett', 'Ramos', 'Fisher', 'Delgado', 'Price', 'Tanaka', 'Morales', 'Hughes', 'Castillo', 'Ward', 'Foster', 'Navarro', 'Sullivan']
const batterName = (english: boolean) => english ? `${pick(US_FIRST)} ${pick(US_LAST)}` : pick(SURNAMES) + pick(GIVEN_A) + pick(GIVEN_B)
/** Nine hitters with no duplicate names (and none clashing with `taken`, e.g. the rival). */
export function makeLineup(strength: number, english = false, taken: string[] = []): Batter[] {
  const used = new Set(taken)
  return Array.from({ length: 9 }, (_, i) => {
    const b = batterFor(i + 1, strength)
    let name = batterName(english)
    for (let n = 0; used.has(name) && n < 50; n++) name = batterName(english)
    used.add(name)
    return { ...b, name }
  })
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

export interface PitchLog { pitch: PitchType; speed: number; x: number; y: number; px: number; py: number; call: string; tag: string; meatball?: boolean }
/** One finished plate appearance, remembered by the hitter for the rest of the game. */
export interface PlateAppearance { inning: number; pitches: PitchLog[]; result: string }
export interface GameState {
  arcade?: ArcadeState
  rivalArchive?: Record<string, PlateAppearance[]>
  id: number
  tier: number
  pitchLog: PitchLog[]
  totalOuts: number
  atBats: number
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
  /** Pitches and strikeouts in the current half inning (immaculate inning = 9 pitches, 3 K). */
  inningPitches: number
  inningStrikeouts: number
  /** In-game feats, e.g. "무결점 이닝 (3회)". */
  feats: string[]
  pitches: number
  strikeouts: number
  hits: number
  walks: number
  hbp: number
  homeRuns: number
  abLog: PitchLog[]
  /** Batter id → his earlier plate appearances this game. */
  memory: Record<string, PlateAppearance[]>
  /** Batter id → confidence, -1 (rattled) … +1 (locked in). */
  confidence: Record<string, number>
  /** Entered the 9th protecting a 1–3 run lead. */
  saveOpp: boolean
  /** Times the pitcher waved off the manager's hook this game. */
  refusals: number
  /** Pitcher was pulled; the bullpen finished the game. */
  pulled: boolean
  /** Runs charged to the bullpen after the pitcher left. */
  bullpenRuns: number
  /** Score margin (ours − theirs) when the pitcher left. */
  exitLead: number
  /** Decision fixed when the starter left and the bullpen played it out (official W/L rules). */
  starterDecision?: Decision
  /** Runners he left on base who scored after he left (charged to him). */
  inheritedRuns?: number
  over: boolean
}

/** Fixed rivals per league (index = tier): 교타 · 장타 · 선구안. */
const RIVAL_NAMES = [['강태산', '윤지혁', '서도윤'], ['백승호', '마준혁', '남궁현'], ['차민규', '석대호', '육성재'], ['Tony Alvarez', 'Brett Kowalski', 'Daniel Ito'], ['Marco Delacruz', 'Jake Holloway', 'Shohei Kanda']]
export function newGame(prev?: GameState, tier = 0, myClub?: number): GameState {
  tier = clamp(Math.floor(tier), 0, TIERS.length - 1)
  // Rotate within this league's other teams (never our own club); never face the same club twice in a row.
  const others = TIERS[tier].teams.map((_, i) => i).filter(i => i !== myClub)
  const fresh = others.filter(i => !(prev && prev.tier === tier && i === prev.opponent))
  const opponent = pick(fresh.length ? fresh : others)
  const rivalArchive = { ...(prev?.rivalArchive ?? {}) }
  if (prev) for (const b of prev.lineup.filter(b => b.id.startsWith('rival-'))) {
    const played = prev.memory[b.id] ?? []
    if (played.length) rivalArchive[b.id] = played.slice(-3)
  }
  const rival = Math.max(0, others.indexOf(opponent)) % 3
  const rivalId = `rival-${tier}-${rival}`
  const rivalNames = RIVAL_NAMES[tier]
  const lineup = makeLineup(TIERS[tier].strength, tier >= 3, [rivalNames[rival]])
  lineup[3] = { ...lineup[3], id: rivalId, name: rivalNames[rival], bats: rival === 0 ? 'L' : 'R', zone: rival === 1 ? 'HIGH' : 'LOW', weakness: rival === 2 ? 'NONE' : 'OFFSPEED', contact: rival === 0 ? .92 : .73, power: rival === 1 ? .94 : .65, eye: rival === 2 ? .95 : .58, aggression: rival === 1 ? .9 : .5 }
  return {
    arcade: freshArcade(), rivalArchive,
    id: (prev?.id ?? 0) + 1, tier, pitchLog: [], totalOuts: 0, atBats: 0, opponent, batterIndex: 0,
    lineup,
    inning: 1, outs: 0, balls: 0, strikes: 0, bases: [false, false, false], runsAgainst: 0, runsFor: 0,
    lineScore: [0], ourScore: [], inningHits: 0, inningWalks: 0, inningPitches: 0, inningStrikeouts: 0, feats: [], pitches: 0, strikeouts: 0, hits: 0, walks: 0, hbp: 0, homeRuns: 0,
    abLog: [], memory: rivalArchive[rivalId] ? { [rivalId]: rivalArchive[rivalId] } : {}, confidence: {}, saveOpp: false, refusals: 0, pulled: false, bullpenRuns: 0, exitLead: 0, over: false,
  }
}

export function defaultProfile(): PitcherProfile {
  return {
    name: 'ROOKIE', height: 185, hand: 'R', armSlot: 'THREE_QUARTER', trainingPoints: 90, stamina: 100, fatigue: 0, age: 19, startAge: 19, created: false,
    arsenal: Object.fromEntries(PITCHES.map(p => [p.id, { unlocked: false, velocityLevel: 1, controlLevel: 1, breakLevel: 1, mastery: 0 }])) as Record<PitchType, PitchStat>,
  }
}

export interface SaveData { profile: PitcherProfile; game: GameState; season: Season; history: Season[] }
export const SAVE_KEY = 'ace-project-save-v2'
export function loadSave(): SaveData {
  const base = defaultProfile()
  try {
    const raw = localStorage.getItem(SAVE_KEY) ?? localStorage.getItem('ace-project-save-v1')
    const parsed = JSON.parse(raw || 'null')
    if (!parsed?.profile?.arsenal || !parsed.profile.created) throw new Error('No save')
    const { difficulty: _legacyDifficulty, ...savedProfile } = parsed.profile
    const profile: PitcherProfile = {
      ...base, ...savedProfile,
      arsenal: Object.fromEntries(PITCHES.map(p => [p.id, { ...base.arsenal[p.id], ...parsed.profile.arsenal[p.id] }])) as Record<PitchType, PitchStat>,
    }
    const history: Season[] = Array.isArray(parsed.history) ? parsed.history.map((h: Partial<Season>, i: number) => normalizeSeason(h, i + 1)) : []
    const season = normalizeSeason(parsed.season, history.length + 1)
    // Saves from before aging existed: a 19-year-old draftee who has aged one year per season year.
    if (!Number.isFinite(savedProfile.age)) { profile.startAge = 19; profile.age = 19 + Math.max(0, season.year - 1) }
    const fresh = newGame(undefined, season.tier)
    const game: GameState = parsed.game?.lineup?.length === 9 ? { ...fresh, ...parsed.game } : fresh
    game.tier = clamp(Math.floor(Number(game.tier) || 0), 0, TIERS.length - 1)
    game.totalOuts = parsed.game?.totalOuts ?? ((game.over ? game.inning : game.inning - 1) * 3 + game.outs)
    game.atBats = parsed.game?.atBats ?? game.totalOuts + game.hits
    const arcade: ArcadeState = { ...freshArcade(), ...(parsed.game?.arcade ?? {}) }
    arcade.focus = clamp(Number(arcade.focus) || 0, 0, 100)
    arcade.finishers = Array.isArray(arcade.finishers) ? arcade.finishers : []
    arcade.techniques = Array.isArray(arcade.techniques) ? arcade.techniques : []
    game.arcade = arcade
    game.rivalArchive = game.rivalArchive ?? {}
    return { profile, game, season, history }
  } catch {
    return { profile: base, game: newGame(), season: newSeason(), history: [] }
  }
}

/* ───────────────────────── Stamina, the hook, and overuse ───────────────────────── */

/**
 * A starter has roughly 100 pitches in him. Every pitch costs ~1 stamina; max-effort releases and
 * high-stress pitches (runners on, deep counts) cost more. Between innings he only catches his breath.
 */
export const STAMINA = { perPitch: 1, maxEffort: .8, stress: .35, inningRest: 3, hookAt: 30, maxRefusals: 1, maxFatigue: 45 } as const
export function staminaCost(meter: number, g: Pick<GameState, 'bases' | 'balls' | 'strikes'>, height = 185, age = 25) {
  const maxEffort = meter > .9 && meter <= 1 ? STAMINA.maxEffort : 0
  const stress = (g.bases.some(Boolean) ? STAMINA.stress : 0) + (g.balls === 3 || (g.balls >= 2 && g.strikes === 2) ? STAMINA.stress : 0)
  return (STAMINA.perPitch + maxEffort + stress) * physiqueCost(height).staminaMul * ageEffects(age).staminaMul
}
/** The manager comes out once the tank is low (or the pitch count is out of hand). */
export const needsHook = (stamina: number, g: Pick<GameState, 'pitches' | 'over' | 'pulled'>) => !g.over && !g.pulled && (stamina < STAMINA.hookAt || g.pitches >= 120)
export const canRefuseHook = (g: Pick<GameState, 'refusals'>) => (g.refusals ?? 0) < STAMINA.maxRefusals
/**
 * Overuse carries into the next start: pitches beyond 100, finishing on fumes, and every
 * waved-off hook eat into the next game's starting stamina.
 */
export function fatigueAfter(g: Pick<GameState, 'pitches' | 'refusals'>, stamina: number) {
  return Math.round(clamp(Math.max(0, g.pitches - 100) * 1.5 + Math.max(0, 25 - stamina) * 1.2 + (g.refusals ?? 0) * 6, 0, STAMINA.maxFatigue))
}

/** Bullpen half inning. Deeper leagues have better relievers, but better lineups too. */
function bullpenHalf(tier: number, fraction = 1) {
  const r = Math.random() / fraction
  const t = tier * .01
  return r < .7 - t ? 0 : r < .87 - t ? 1 : r < .95 ? 2 : 3
}
export type Decision = 'W' | 'L' | 'ND' | 'T'
/** Chance an inherited runner scores (1B, 2B, 3B), scaled by outs — MLB inherited runners score ≈30%. */
const INHERITED_SCORE = [.13, .27, .45] as const
/**
 * The pitcher hands the ball over: the bullpen and our lineup play out the rest of the game.
 * Runners he left on base who score are charged to HIM (not the bullpen), and his W/L follows
 * the official rules: a win needs 5 IP and a lead the team never gives up; a loss needs him to
 * leave trailing (his runs included) with the team never tying it again.
 */
export function bullpenFinish(g: GameState): GameState {
  const next: GameState = { ...g, lineScore: [...g.lineScore], ourScore: [...g.ourScore], pulled: true, abLog: [], balls: 0, strikes: 0 }
  let inning = g.inning, bullpen = 0
  const addRuns = (r: number, charged: boolean) => { next.lineScore[next.lineScore.length - 1] += r; next.runsAgainst += r; if (!charged) bullpen += r }
  // Inherited runners score first (they are already on base).
  if (g.outs < 3) {
    const outsFactor = g.outs === 0 ? 1.25 : g.outs === 1 ? 1 : .7
    next.inheritedRuns = g.bases.reduce((n, on, i) => n + (on && Math.random() < INHERITED_SCORE[i] * outsFactor ? 1 : 0), 0)
    addRuns(next.inheritedRuns, true)
  }
  const exitLead = next.runsFor - next.runsAgainst
  let leadHeld = exitLead > 0, caughtUp = exitLead >= 0
  const check = () => { if (next.runsAgainst >= next.runsFor) leadHeld = false; if (next.runsFor >= next.runsAgainst) caughtUp = true }
  const top = (fraction: number) => { addRuns(bullpenHalf(g.tier, fraction), false); check() }
  // Finish the current top half from the current out count.
  if (g.outs < 3) top((3 - g.outs) / 3)
  for (;;) {
    if (inning >= 9 && next.runsFor > next.runsAgainst) break // no need for the bottom half
    const ours = simulateOurHalf()
    next.ourScore.push(ours); next.runsFor += ours; check()
    if (inning >= 9 && next.runsFor !== next.runsAgainst) break
    if (inning >= 12) break
    inning++
    next.lineScore.push(0)
    top(1)
  }
  const won = next.runsFor > next.runsAgainst, lost = next.runsFor < next.runsAgainst
  const starterDecision: Decision = won && leadHeld && g.totalOuts >= 15 ? 'W' : lost && !caughtUp ? 'L' : 'ND'
  return { ...next, inning, exitLead, starterDecision, bullpenRuns: (g.bullpenRuns ?? 0) + bullpen, outs: 0, bases: [false, false, false], over: true, saveOpp: false }
}
/** W/L/ND for our pitcher. A pulled starter's decision is fixed by bullpenFinish (older saves fall back to the lead at exit). */
export function pitcherDecision(g: GameState): Decision {
  const won = g.runsFor > g.runsAgainst, lost = g.runsFor < g.runsAgainst
  if (!g.pulled) return won ? 'W' : lost ? 'L' : 'T'
  if (g.starterDecision) return g.starterDecision
  if (won && g.exitLead > 0 && g.totalOuts >= 15) return 'W'
  if (lost && g.exitLead < 0) return 'L'
  return 'ND'
}
export const DECISION_LABEL: Record<Decision, string> = { W: '승리투수', L: '패전투수', ND: '노 디시전', T: '무승부' }

/* ───────────────────────── Batter memory & mood ───────────────────────── */

/** 3×3 zone cell (0–8, catcher view). Out-of-zone pitches count toward the nearest edge cell. */
export const zoneCell = (p: { x: number; y: number }) => {
  const col = p.x < -1 / 3 ? 0 : p.x > 1 / 3 ? 2 : 1, row = p.y < -1 / 3 ? 0 : p.y > 1 / 3 ? 2 : 1
  return row * 3 + col
}
export const CELL_LABEL = ['높은 왼쪽', '높은 가운데', '높은 오른쪽', '가운데 왼쪽', '한가운데', '가운데 오른쪽', '낮은 왼쪽', '낮은 가운데', '낮은 오른쪽']

export interface Adaptation { level: number; timesFaced: number; typeShare: number; zoneShare: number; seen: number }
/**
 * How well a hitter has "timed" a pitch type / location from his earlier trips to the plate.
 * 0 = fresh look, 1 = he's sitting on it.
 */
export function batterAdaptation(prior: PlateAppearance[] | undefined, pitch: PitchType, loc: { x: number; y: number }): Adaptation {
  const seenPitches = (prior ?? []).flatMap(pa => pa.pitches)
  const timesFaced = prior?.length ?? 0
  if (!seenPitches.length) return { level: 0, timesFaced, typeShare: 0, zoneShare: 0, seen: 0 }
  const cell = zoneCell(loc)
  const typeShare = seenPitches.filter(p => p.pitch === pitch).length / seenPitches.length
  const zoneShare = seenPitches.filter(p => zoneCell(p) === cell).length / seenPitches.length
  const combo = seenPitches.filter(p => p.pitch === pitch && zoneCell(p) === cell).length / seenPitches.length
  const level = clamp((typeShare * .45 + zoneShare * .6 + combo * .9) * (timesFaced >= 2 ? 1 : .8), 0, 1)
  return { level, timesFaced, typeShare, zoneShare, seen: seenPitches.length }
}

export type Mood = 'LOCKED_IN' | 'CONFIDENT' | 'NEUTRAL' | 'PRESSING' | 'RATTLED'
export const moodOf = (c: number): Mood => c > .45 ? 'LOCKED_IN' : c > .15 ? 'CONFIDENT' : c < -.45 ? 'RATTLED' : c < -.15 ? 'PRESSING' : 'NEUTRAL'
export const MOOD_LABEL: Record<Mood, string> = { LOCKED_IN: '감 잡음', CONFIDENT: '자신감', NEUTRAL: '평정', PRESSING: '조급함', RATTLED: '멘붕' }
const CONFIDENCE_DELTA: Partial<Record<PitchOutcome, number>> = {
  BALL: .03, CALLED_STRIKE: -.04, SWINGING_STRIKE: -.09, FOUL: .01, GROUND_OUT: -.12, FLY_OUT: -.1, LINE_OUT: -.02, POP_OUT: -.15,
  SINGLE: .28, DOUBLE: .38, HOME_RUN: .55, HIT_BY_PITCH: .05,
}

/** Pre-pitch scouting snippet: the one or two things a catcher would flash to the pitcher. */
export function scoutingReport(b: Batter, side: Hand, pitcherHand: Hand, prior: PlateAppearance[] | undefined, arsenal: PitchType[]): string[] {
  const notes: string[] = []
  const same = side === pitcherHand
  const weakPitch = arsenal.find(t => pitchById(t).family === b.weakness)
  if (weakPitch) notes.push(`${pitchById(weakPitch).short}에 약함`)
  const heat = zoneHeat(b, side)
  let cold = 0; heat.flat().forEach((v, i, a) => { if (v < a[cold]) cold = i })
  notes.push(`콜드존: ${CELL_LABEL[cold]}`)
  const seen = (prior ?? []).flatMap(pa => pa.pitches)
  if (seen.length) {
    const counts = new Map<PitchType, number>(); seen.forEach(p => counts.set(p.pitch, (counts.get(p.pitch) ?? 0) + 1))
    const [top, n] = [...counts.entries()].sort((a, z) => z[1] - a[1])[0]
    if (n / seen.length >= .5) notes.push(`지난 타석 ${pitchById(top).short} ${n}/${seen.length} → 노리고 있음`)
    const unseen = arsenal.find(t => !counts.has(t))
    if (unseen) notes.push(`${pitchById(unseen).short} 아직 못 봄`)
  } else if (!weakPitch) {
    const best = arsenal.find(t => same ? ['SLIDER', 'SWEEPER'].includes(t) : ['CHANGEUP', 'SPLITTER'].includes(t))
    if (best) notes.push(`${same ? '같은 손' : '반대 손'} · ${pitchById(best).short} 유효`)
  }
  return notes.slice(0, 3)
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
  /** League tier (0 = Amateur … 4 = MLB). The tier is the difficulty. */
  tier?: number
  previous: PitchFlight | null
  seenSpeeds: number[]
  seenTypes: PitchType[]
  fastest: number
  /** Pitches earlier in this plate appearance. */
  history?: PitchLog[]
  /** This hitter's earlier plate appearances this game. */
  memory?: PlateAppearance[]
  /** -1 … 1 */
  confidence?: number
}

export interface PitchResult {
  outcome: PitchOutcome
  swing: boolean
  perceived: { x: number; y: number }
  tunnel: number
  adaptation: number
  tags: string[]
  barrel: { x: number; y: number }
  sprayAngle: number // -1 (third base) … 1 (first base)
}

export const inZone = (p: { x: number; y: number }, pad = 0) => Math.abs(p.x) <= 1 + pad && Math.abs(p.y) <= 1 + pad

/** "Rise" illusion of a four-seamer: more IVB than the hitter's eye expects from that release, amplified by a steep plane. */
export const riseIllusion = (f: PitchFlight) => f.pitch.id === 'FOUR_SEAM' ? clamp((f.ivb - 30) / 22, 0, 1) * (.6 + .4 * planeSteepness(f.releaseHeight)) : 0

/** A hitter's pre-pitch guess. Count supplies a prior; this plate appearance and earlier looks update it. */
export function batterPlan(c: Pick<AtBatContext, 'balls' | 'strikes'> & { history?: PitchLog[]; memory?: PlateAppearance[]; seenTypes?: PitchType[]; fastest?: number }) {
  const byCount = [
    [.55, .50, .36], // 0 balls
    [.60, .54, .41],
    [.72, .62, .46],
    [.82, .74, .57], // 3 balls: walking the hitter constrains the pitcher
  ]
  const recent = c.history?.map(p => p.pitch) ?? c.seenTypes ?? []
  const prior = (c.memory ?? []).flatMap(pa => pa.pitches).map(p => p.pitch)
  const seen = [...prior, ...recent]
  let fastballChance = byCount[clamp(c.balls, 0, 3)][clamp(c.strikes, 0, 2)]
  if (seen.length) fastballChance += (seen.filter(t => pitchById(t).family === 'FASTBALL').length / seen.length - .5) * .12
  const last = recent.at(-1)
  if (last) fastballChance += pitchById(last).family === 'FASTBALL' ? -.14 : .12
  if (recent.length >= 2 && pitchById(recent.at(-2)!).family === pitchById(last!).family) {
    fastballChance += pitchById(last!).family === 'FASTBALL' ? .32 : -.18
  }
  fastballChance = clamp(fastballChance, .16, .88)
  const expectFastball = fastballChance >= .5
  const conviction = clamp(.2 + Math.abs(fastballChance - .5) * 1.25 + (recent.length >= 2 && pitchById(recent.at(-2)!).family === pitchById(last!).family ? .1 : 0), .2, .75)
  const secondarySpeeds = [...(c.memory ?? []).flatMap(pa => pa.pitches), ...(c.history ?? [])].filter(p => pitchById(p.pitch).family !== 'FASTBALL').map(p => p.speed)
  const fastest = c.fastest ?? 145
  const expectedSpeed = expectFastball ? fastest - 1 : secondarySpeeds.length ? secondarySpeeds.reduce((a, n) => a + n, 0) / secondarySpeeds.length : Math.max(95, fastest - 16)
  return { fastballChance, expectFastball, conviction, expectedSpeed }
}

export function resolvePitch(f: PitchFlight, c: AtBatContext): PitchResult {
  const b = c.batter
  const league = tierOf(c.tier)
  const side = batterSide(b, c.pitcherHand)
  const same = side === c.pitcherHand
  const late = Math.min(.12, (c.inning - 1) * .012)
  const conf = clamp(c.confidence ?? 0, -1, 1)
  const eye = clamp(b.eye + league.eye + late * .5, 0, 1)
  const toInside = (x: number) => side === 'R' ? -x : x // + = inside to this hitter
  const L = f.landing
  const inX = toInside(L.x)
  const tags: string[] = []
  const adapt = batterAdaptation(c.memory, f.pitch.id, L).level
  const meatball = f.meatball
  const plan = batterPlan(c)
  const readPlan = (f.pitch.family === 'FASTBALL') === plan.expectFastball

  // Hit by pitch: way inside at body height.
  if (inX > 1.85 && L.y > -1.5 && L.y < 1.6) return { outcome: 'HIT_BY_PITCH', swing: false, perceived: L, tunnel: 0, adaptation: adapt, tags: ['몸에 맞는 공'], barrel: L, sprayAngle: 0 }

  // 1) What the hitter sees at the commit point, plus the break he *expects* from the pitch he thinks it is.
  const tr = tunnelRead(f, c.previous)
  const tunnel = meatball ? 0 : tr.score
  const td = decisionPoint(f, league.latencyMs)
  const remaining = 1 - movementProgress(f, td)
  const hides = same && f.pitch.family === 'BREAKING' ? .12 : 0
  const repeatedZone = (c.history ?? []).slice(-4).filter(p => p.pitch === f.pitch.id && Math.hypot(p.x - L.x, p.y - L.y) < .55).length
  const recognize = clamp(.42 + repeatedZone * .09 + adapt * .3 + eye * .4 + (f.pitch.family === 'FASTBALL' ? .25 : 0) + (f.pitch.id === 'CURVE' ? .3 : 0) - tunnel * .5 - hides - league.latencyMs / 400 + (readPlan ? .08 : -.1) * plan.conviction, .05, .95)
  // Eye-level change: high heat, then something down low.
  const eyeLevel = c.previous && c.previous.pitch.family === 'FASTBALL' && c.previous.landing.y < -.55 && L.y > .45 && f.pitch.family !== 'FASTBALL' ? 1 : 0
  const lowToHigh = c.previous && c.previous.pitch.family !== 'FASTBALL' && c.previous.landing.y > .45 && f.pitch.id === 'FOUR_SEAM' && L.y < -.55 ? 1 : 0
  const recognized = meatball || Math.random() < recognize - eyeLevel * .2 - lowToHigh * .12
  const typical = Math.min(1, .62 / breakScale(f.breakLevel))
  const armSide = c.pitcherHand === 'R' ? 1 : -1
  const rise = riseIllusion(f)
  const ride = f.pitch.id === 'FOUR_SEAM' ? .55 - rise * .3 : 1 // hitters never fully believe the ride
  const expectMove = recognized ? { x: f.movement.x * typical, y: f.movement.y * typical * ride } : { x: -.08 * armSide, y: -.38 }
  const noise = .04 + (1 - eye) * .1
  // Whatever break he didn't expect in the unseen part of the flight becomes miss distance.
  const perceived = {
    x: L.x - (f.movement.x - expectMove.x) * remaining * (1 - adapt * .4) + gauss() * noise,
    y: L.y - (f.movement.y - expectMove.y) * remaining * (1 - adapt * .4) + gauss() * noise,
  }

  // Mid-swing adjustment: good contact hitters chase the ball down with the barrel.
  const adjust = .2 + b.contact * .3 + (td - .5) * .4 + adapt * .15
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
  const awayMatchup = same && toInside(L.x) < -.4 && (f.pitch.family === 'BREAKING' || f.pitch.family === 'FASTBALL')
  const backdoor = !same && f.pitch.family === 'BREAKING' && toInside(L.x) < -.65 && inZone(L, .15)
  if (awayMatchup || (!same && f.pitch.id === 'CHANGEUP') || backdoor) chase *= 1.15
  chase *= (1.35 - eye * .75) * league.discipline
  chase *= 1 + tunnel * .5 // it looked like the last one until it didn't
  chase *= 1 - adapt * .3 // he's seen this one; he lays off
  chase *= 1 - conf * .3 // frustrated hitters expand the zone, locked-in hitters don't
  zoneSwing *= .85 + b.aggression * .3
  chase *= .8 + b.aggression * .4
  // High heat: a rising fastball above the belt looks like a meatball.
  const highHeat = f.pitch.id === 'FOUR_SEAM' && L.y < -.75 && f.speed >= 140
  if (highHeat && strikes === 2) chase *= 1.3 + rise * .3
  // A hanging meatball: the hitter pounces.
  if (meatball && !(balls === 3 && strikes === 0)) zoneSwing = Math.max(zoneSwing, .93)
  if (f.trait === 'signature' && f.pitch.family === 'BREAKING') chase *= 1.12
  const swingChance = clamp(looksStrike ? zoneSwing : chase, 0, .97)
  const swing = Math.random() < swingChance

  if (meatball) tags.push('실투!')
  const actualStrike = inZone(L, .06) || (inZone(L, .14) && Math.random() < .45)
  if (!swing) {
    if (actualStrike) {
      const edge = Math.max(Math.abs(L.x), Math.abs(L.y))
      tags.push(edge > .78 ? '코너 꽉 찬 공' : strikes === 2 ? '얼어붙음' : '지켜봄')
      return { outcome: 'CALLED_STRIKE', swing, perceived, tunnel, adaptation: adapt, tags, barrel, sprayAngle: 0 }
    }
    if (!looksStrike && pz < 1.5) tags.push('골라냄')
    return { outcome: 'BALL', swing, perceived, tunnel, adaptation: adapt, tags, barrel, sprayAngle: 0 }
  }

  // 3) Timing: hitters sit on the fastball and adjust to what they've seen.
  const knownPitches = [...(c.memory ?? []).flatMap(pa => pa.pitches), ...(c.history ?? [])]
  // Existing simulation callers can supply paired observations without a pitch log.
  const observations = knownPitches.length ? knownPitches : c.seenSpeeds.map((speed, i) => ({ pitch: c.seenTypes[i] ?? f.pitch.id, speed, x: 0, y: 0, px: 0, py: 0, call: '', tag: '' }))
  const speedRead = timingRead(f.speed, c.fastest, observations, f.pitch.id, recognized, eye, tunnel, c.previous?.speed, plan.expectedSpeed, plan.conviction)
  const early = speedRead.early
  if (speedRead.familiar && recognized && speedRead.gap > 22) tags.push('구속대 적응')
  const reaction = 143 + b.contact * 12 + league.contact * 30 + league.reaction
  // Extension: the ball gets on him faster than the gun says.
  const lateness = Math.max(0, (f.perceivedSpeed ?? f.speed) - reaction) / 28
  const timing = Math.abs(early) + lateness * (1 - Math.max(0, early) * .5)
  const repeat = c.seenTypes.slice(-2).filter(t => t === f.pitch.id).length
  const timingErr = meatball ? 0 : Math.max(0, timing - repeat * .12 - repeatedZone * .06 - adapt * .25 + (!readPlan && !recognized ? plan.conviction * .12 : 0))

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
  const sittingFastball = (balls === 2 && strikes === 0 || balls === 3 && strikes === 1) && f.pitch.family === 'FASTBALL' && inZone(L)
  // Steep downhill plane makes low, falling pitches drop off the table.
  const plane = L.y > .4 && f.movement.y > .2 ? planeSteepness(f.releaseHeight) * .07 : 0
  const signature = f.trait === 'signature' ? (f.pitch.id === 'FOUR_SEAM' && highHeat ? .06 : (f.pitch.id === 'CHANGEUP' || f.pitch.id === 'SPLITTER') && tunnel > .45 ? .07 : 0) : 0
  const q = repeatedZone * .045 + (sittingFastball ? .1 : 0) - (backdoor ? .08 : 0) + b.contact * .55 + .36 + league.contact + late + protect + platoon + weak
    + adapt * .24 + conf * .07 + (meatball ? .32 : 0)
    + (readPlan ? .07 : -.1) * plan.conviction
    - signature - spatial * 1.0 - timingErr * .6 - outside * .85 - tunnel * .2 - eyeLevel * .06 - lowToHigh * .06 - (highHeat ? .1 + rise * .08 : 0) - plane + gauss() * .16

  if (f.breakLevel >= 50 && spatial > .25) tags.push('LATE BREAK')
  if (tunnel > .45) tags.push(tr.pair ? '하이-로우 터널' : '터널')
  if ((eyeLevel || lowToHigh) && (spatial > .25 || timingErr > .25)) tags.push('눈높이 흔들기')
  if (highHeat && missY < -.25) tags.push(rise > .4 ? '떠오르는 직구' : '하이 패스트볼')
  if (plane && spatial > .25) tags.push('수직 낙차')
  if (!looksStrike || outside > .1) { if (!inZone(L)) tags.push('유인구') }
  if (early > .5) tags.push('타이밍 뺏음')
  else if (lateness > .35) tags.push('늦음')
  if (breakAway > .35 && same && spatial > .3) tags.push('도망가는 공')
  if (adapt > .45) tags.push('읽혔다')
  if (plan.conviction > .42 && !readPlan && timingErr > .2) tags.push('허 찌른 배합')
  if (plan.conviction > .42 && readPlan && timingErr < .2) tags.push('노림수 적중')

  if (q < .12) return { outcome: 'SWINGING_STRIKE', swing, perceived, tunnel, adaptation: adapt, tags, barrel, sprayAngle: 0 }
  const spray = (side === 'R' ? -1 : 1) * clamp(early * .9 - lateness * .8 + gauss() * .35, -1, 1) // + pull = toward hitter's pull side
  if (q < .44 || (timingErr > .45 && Math.random() < .6) || (strikes === 2 && q < .6 && Math.random() < .4)) return { outcome: 'FOUL', swing, perceived, tunnel, adaptation: adapt, tags: tags.filter(t => t !== '유인구'), barrel, sprayAngle: spray }

  // 5) Quality of contact → batted ball.
  const center = 1 - clamp(Math.max(Math.abs(L.x), Math.abs(L.y)), 0, 1)
  const heat = zoneHeat(b, side)
  const col = L.x < -.33 ? 0 : L.x > .33 ? 2 : 1, row = L.y < -.33 ? 0 : L.y > .33 ? 2 : 1
  const hot = inZone(L, .1) ? heat[row][col] * .22 : -.1
  const hanging = f.pitch.family !== 'FASTBALL' && L.y < .1 && Math.abs(L.x) < .6 ? .2 : 0
  const jam = !meatball && f.speed > 138 && inX > .45 && toInside(f.movement.x) > .1 ? .22 : inX > .8 ? .1 : 0
  const exit = q + b.power * .3 + center * .25 + hot + hanging - jam + adapt * .25 + (meatball ? .38 : 0) + gauss() * .2 - .12
  if (hanging > 0 && exit > .9 && !meatball) tags.push('실투')
  if (jam > .15) tags.push('먹힌 타구')

  const launch = (perceived.y - L.y) * 1.3 - L.y * .5 + (f.pitch.id === 'SINKER' || f.pitch.id === 'SPLITTER' ? -.25 : 0) + (meatball ? .35 : 0) + gauss() * .32
  const hrPower = meatball ? .25 : .45
  let outcome: PitchOutcome
  if (launch < -.28) outcome = exit > 1.02 ? 'SINGLE' : exit > .98 && Math.random() < .5 ? 'SINGLE' : 'GROUND_OUT'
  else if (launch > .95) outcome = 'POP_OUT'
  else if (launch > .42) outcome = exit > 1.2 && b.power > hrPower ? 'HOME_RUN' : exit > 1.08 ? 'DOUBLE' : exit > .98 && Math.random() < .35 ? 'SINGLE' : 'FLY_OUT'
  else outcome = exit > 1.16 && b.power > (meatball ? .35 : .6) && Math.random() < (meatball ? .6 : .35) ? 'HOME_RUN' : exit > 1.02 ? 'DOUBLE' : exit > .74 ? 'SINGLE' : 'LINE_OUT'
  return { outcome, swing, perceived, tunnel, adaptation: adapt, tags, barrel, sprayAngle: spray }
}

/** Short broadcast-style call for the batter's current approach. */
export function batterMindset(c: Parameters<typeof batterPlan>[0]) {
  const plan = batterPlan(c)
  if (c.balls === 0 && c.strikes === 0 && !c.history?.length) return '초구 탐색'
  if (c.balls === 3 && c.strikes === 0) return '좋은 공 대기'
  if (plan.fastballChance > .62) return c.strikes === 2 ? '직구 경계' : '직구 노림'
  if (plan.fastballChance < .44) return '변화구 대비'
  return c.strikes === 2 ? '커트 · 중간 타이밍' : '중간 타이밍'
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

export interface PitchEvents { doublePlay?: boolean; paEnded: boolean; strikeout: boolean; out: boolean; hit: boolean; walk: boolean; runs: number; inningOver: boolean; reward: number; mastery: number; immaculate?: boolean }
/** Special TP (before the league multiplier). Game feats are paid when the game is closed out. */
export const SPECIAL_TP = { immaculate: 80, completeGame: 100, shutout: 200, noHitter: 350, perfectGame: 600 } as const
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
  const batter = g.lineup[g.batterIndex]
  const next: GameState = { ...g, bases: [...g.bases] as GameState['bases'], lineScore: [...g.lineScore], pitches: g.pitches + 1, inningPitches: (g.inningPitches ?? 0) + 1 }
  const ev: PitchEvents = { paEnded: false, strikeout: false, out: false, hit: false, walk: false, runs: 0, inningOver: false, reward: 0, mastery: 4 }
  let call = { ...CALLS[o] }
  const entry: PitchLog = { pitch: f.pitch.id, speed: f.speed, x: f.landing.x, y: f.landing.y, px: r.barrel.x, py: r.barrel.y, call: CALLS[o].text, tag: r.tags[0] ?? '', ...(f.meatball ? { meatball: true } : {}) }
  next.abLog = [...g.abLog, entry]
  next.pitchLog = [...(g.pitchLog ?? []), entry]
  const score = (runs: number) => { next.runsAgainst += runs; next.lineScore[next.lineScore.length - 1] += runs; ev.runs = runs }

  if (o === 'BALL') {
    next.balls++
    if (next.balls >= 4) { const a = advance(next.bases, 'BALL'); next.bases = a.bases; score(a.runs); ev.walk = true; next.walks++; next.inningWalks++; call = { text: '볼넷', tone: 'ball' } }
  } else if (o === 'HIT_BY_PITCH') {
    const a = advance(next.bases, 'HIT_BY_PITCH'); next.bases = a.bases; score(a.runs); ev.walk = true; next.inningWalks++; next.hbp = (g.hbp ?? 0) + 1
  } else if (o === 'CALLED_STRIKE' || o === 'SWINGING_STRIKE') {
    next.strikes++; ev.reward = o === 'SWINGING_STRIKE' ? 3 : 2; ev.mastery = o === 'SWINGING_STRIKE' ? 10 : 7
    if (next.strikes >= 3) {
      ev.strikeout = true; ev.out = true; next.outs++; next.strikeouts++; next.inningStrikeouts = (g.inningStrikeouts ?? 0) + 1; ev.reward += 20; ev.mastery += 15
      call = { text: o === 'CALLED_STRIKE' ? '루킹 삼진' : '헛스윙 삼진', tone: 'k' }
    }
  } else if (o === 'FOUL') {
    if (next.strikes < 2) next.strikes++
    ev.reward = 1
  } else if (IN_PLAY_OUT.includes(o)) {
    ev.out = true; next.outs++; ev.reward = 10; ev.mastery = 12
    if (o === 'GROUND_OUT' && g.bases[0] && g.outs < 2 && !f.meatball) {
      const chance = .25 + (f.landing.y > .4 ? .15 : 0) + (r.tags.includes('먹힌 타구') ? .15 : 0) + (f.pitch.id === 'SINKER' && f.trait === 'signature' ? .2 : 0)
      if (Math.random() < chance) { ev.doublePlay = true; next.outs++; next.totalOuts++; next.bases[0] = false; ev.reward += 10; call = { text: '병살! · 더블 플레이', tone: 'out' } }
    }
  } else {
    const a = advance(next.bases, o); next.bases = a.bases; score(a.runs); ev.hit = true; next.hits++; next.inningHits++; ev.mastery = 2
    if (o === 'HOME_RUN') next.homeRuns = (g.homeRuns ?? 0) + 1
  }
  if (ev.out) next.totalOuts++
  if (ev.out || ev.hit) next.atBats++
  ev.paEnded = ev.walk || ev.hit || ev.out
  if (ev.runs) call = { ...call, text: `${call.text} · ${ev.runs}실점` }

  // Batter mood: every pitch nudges it, the plate appearance result moves it a lot.
  const conf = (g.confidence ?? {})[batter.id] ?? 0
  const delta = (CONFIDENCE_DELTA[o] ?? 0) + (ev.strikeout ? -.22 : 0) + (ev.walk && o === 'BALL' ? .15 : 0)
  next.confidence = { ...(g.confidence ?? {}), [batter.id]: clamp(conf + delta, -1, 1) }

  if (ev.paEnded) {
    const pa: PlateAppearance = { inning: g.inning, pitches: next.abLog, result: call.text.split(' · ')[0] }
    next.memory = { ...(g.memory ?? {}), [batter.id]: [...((g.memory ?? {})[batter.id] ?? []), pa] }
    next.balls = 0; next.strikes = 0; next.batterIndex = (next.batterIndex + 1) % 9; next.abLog = []
  }
  if (next.outs >= 3) {
    ev.inningOver = true; ev.reward += 30
    if (next.inningHits === 0 && next.inningWalks === 0) ev.reward += 25
    // Immaculate inning: three strikeouts on nine pitches.
    if (next.inningStrikeouts === 3 && next.inningPitches === 9) {
      ev.immaculate = true; ev.reward += SPECIAL_TP.immaculate
      next.feats = [...(g.feats ?? []), `무결점 이닝 (${g.inning}회)`]
    }
  }
  rewardArcade(g, next, f, r, ev)
  return { game: next, events: ev, call }
}

export interface InningSummary { inning: number; allowed: number; ours: number; clean: boolean; finished: 'WIN' | 'LOSS' | 'TIE' | null; immaculate?: boolean }
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
  const lead = g.runsFor + ours - g.runsAgainst
  const next: GameState = {
    ...g, runsFor: g.runsFor + ours, ourScore: [...g.ourScore, ours], outs: 0, balls: 0, strikes: 0, bases: [false, false, false],
    inningHits: 0, inningWalks: 0, inningPitches: 0, inningStrikeouts: 0, abLog: [], over: finished !== null,
    inning: finished ? g.inning : g.inning + 1, lineScore: finished ? g.lineScore : [...g.lineScore, 0],
    // Save situation: taking the mound for the 9th protecting a 1–3 run lead.
    saveOpp: g.inning === 8 && !finished ? lead >= 1 && lead <= 3 : Boolean(g.saveOpp),
  }
  return { game: next, summary: { inning: g.inning, allowed, ours, clean, finished, immaculate: g.inningStrikeouts === 3 && g.inningPitches === 9 } }
}
