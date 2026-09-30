import { pitcherDecision, type GameState } from './game'

/**
 * League ladder. The tier IS the difficulty: each rung sets how well opponents
 * make contact, how late they can wait before committing (recognition latency),
 * and how disciplined they are at the plate.
 *
 * - contact:    added to bat-to-ball quality
 * - eye:        added to batter plate discipline / pitch recognition
 * - latencyMs:  extra commit time before the plate. + = decides earlier (sees less break)
 * - discipline: multiplier on chase rate (lower = fewer chases)
 * - reaction:   km/h a hitter can catch up to above his baseline
 */
export const TIERS = [
  { id: 'AMATEUR', label: 'Amateur', short: 'AMA', kr: '아마추어', strength: -.12, reaction: -8, contact: -.1, eye: -.15, latencyMs: 45, discipline: 1.25, tp: 1, teams: ['Seoul Campus', 'Busan Academy', 'Incheon Club', 'Daegu Juniors'] },
  { id: 'FUTURES', label: 'KBO Futures (2nd Team)', short: 'FUT', kr: '퓨처스리그', strength: -.05, reaction: -4, contact: -.05, eye: -.07, latencyMs: 22, discipline: 1.12, tp: 1.2, teams: ['Icheon Futures', 'Gimhae Futures', 'Hampyeong Futures', 'Seosan Futures'] },
  { id: 'KBO', label: 'KBO League (1st Team)', short: 'KBO', kr: 'KBO 1군', strength: .02, reaction: 0, contact: 0, eye: 0, latencyMs: 0, discipline: 1, tp: 1.5, teams: ['Seoul Twins', 'Busan Seagulls', 'Daegu Lions', 'Gwangju Tigers'] },
  { id: 'AAA', label: 'Minor League (AAA)', short: 'AAA', kr: '트리플A', strength: .08, reaction: 4, contact: .05, eye: .07, latencyMs: -15, discipline: .9, tp: 1.8, teams: ['Durham Bulls', 'Norfolk Tides', 'Toledo Mud Hens', 'Reno Aces'] },
  { id: 'MLB', label: 'Major League Baseball (MLB)', short: 'MLB', kr: '메이저리그', strength: .14, reaction: 8, contact: .1, eye: .15, latencyMs: -30, discipline: .8, tp: 2.2, teams: ['New York', 'Los Angeles', 'Seattle', 'Boston'] },
] as const
export type Tier = typeof TIERS[number]
export const tierOf = (i: number | undefined): Tier => TIERS[Math.max(0, Math.min(TIERS.length - 1, Math.floor(i ?? 0)))]
/** Starts per season for new careers (short enough for commute play). */
export const SEASON_GAMES = 20
/** Counting thresholds (IP, W, K) were tuned for a 30-start year; they scale with season length. */
export const BASE_SEASON_GAMES = 30

/**
 * Leagues unlocked on this device, shared by every character: a fresh account always starts
 * in Amateur, and reaching a league (promotion or call-up) unlocks it for future characters.
 */
export const UNLOCK_KEY = 'ace-project-unlocks-v1'
export function loadUnlockedTier(): number {
  try { const n = Number(JSON.parse(localStorage.getItem(UNLOCK_KEY) || '{}').maxTier); return Number.isFinite(n) ? Math.max(0, Math.min(4, Math.floor(n))) : 0 } catch { return 0 }
}
export function saveUnlockedTier(tier: number) {
  try { localStorage.setItem(UNLOCK_KEY, JSON.stringify({ maxTier: Math.max(0, Math.min(4, Math.floor(tier))) })) } catch { /* storage optional */ }
}
export const FIP_CONSTANT = 3.1

export interface Season {
  number: number; tier: number; games: number; wins: number; losses: number; saves: number
  outs: number; runs: number; hits: number; walks: number; hbp: number; homeRuns: number; strikeouts: number; atBats: number; pitches: number
  lastGameId: number
  /** Calendar year of the career. A mid-season call-up opens a new record in the same year. */
  year: number
  /** Starts on this club's schedule (a call-up only gets the rest of the year). */
  scheduled: number
  /** Pitcher's age that season. */
  age?: number
  /** Single-game feats (perfect game, no-hitter, shutout) with the game number. */
  feats?: string[]
  /** League awards won for this season (decided when the season is archived). */
  awards?: string[]
  /** Full-season length this record belongs to (a call-up row keeps its parent's). Old saves: 30. */
  length?: number
}
/** 1 for a 30-start year, 2/3 for a 20-start year. */
export const seasonScale = (s: Pick<Season, 'length'>) => (s.length ?? BASE_SEASON_GAMES) / BASE_SEASON_GAMES
export const newSeason = (tier = 0, number = 1, year = number, scheduled = SEASON_GAMES, length = SEASON_GAMES): Season => ({ number, year, scheduled, length, tier, games: 0, wins: 0, losses: 0, saves: 0, outs: 0, runs: 0, hits: 0, walks: 0, hbp: 0, homeRuns: 0, strikeouts: 0, atBats: 0, pitches: 0, lastGameId: -1 })
/** Fills fields added after v2 so old saves keep loading. */
export const normalizeSeason = (s: Partial<Season> | undefined, fallbackNumber = 1): Season => {
  const base = newSeason(0, fallbackNumber)
  const merged = { ...base, ...s }
  // Records saved before season length existed were 30-start years.
  const length = Number(s?.length) || BASE_SEASON_GAMES
  return { ...merged, length, year: Number(merged.year) || merged.number, scheduled: Number(merged.scheduled) || length, tier: Math.max(0, Math.min(TIERS.length - 1, Math.floor(Number(merged.tier) || 0))) }
}

export const gameWon = (g: GameState) => pitcherDecision(g) === 'W'
export const gameSaved = (g: GameState) => gameWon(g) && !g.pulled && Boolean(g.saveOpp)
/** Runs charged to our pitcher (the bullpen's runs are not his). */
export const pitcherRuns = (g: GameState) => g.runsAgainst - (g.bullpenRuns ?? 0)
/** Feats only count for a complete game the pitcher finished himself. */
export function gameFeat(g: GameState): string | null {
  if (!g.over || g.pulled || g.totalOuts < 27) return null
  if (g.hits === 0 && g.walks === 0 && (g.hbp ?? 0) === 0 && g.runsAgainst === 0) return '퍼펙트게임'
  if (g.hits === 0) return '노히터'
  if (g.runsAgainst === 0) return '완봉승'
  return '완투'
}
/** Special TP for closing out a game (before league/age multipliers). */
export const FEAT_TP: Record<string, number> = { 완투: 100, 완봉승: 200, 노히터: 350, 퍼펙트게임: 600 }
export function recordGame(s: Season, g: GameState): Season {
  if (!g.over || g.id === s.lastGameId) return s
  const feat = gameFeat(g)
  return {
    ...s, feats: [...(s.feats ?? []), ...(g.feats ?? []).map(f => f.replace('(', `(G${s.games + 1} · `)), ...(feat ? [`${feat} (G${s.games + 1})`] : [])], games: s.games + 1, wins: s.wins + Number(gameWon(g)), losses: s.losses + Number(pitcherDecision(g) === 'L'), saves: s.saves + Number(gameSaved(g)),
    outs: s.outs + g.totalOuts, runs: s.runs + pitcherRuns(g), hits: s.hits + g.hits, walks: s.walks + g.walks, hbp: s.hbp + (g.hbp ?? 0),
    homeRuns: s.homeRuns + (g.homeRuns ?? 0), strikeouts: s.strikeouts + g.strikeouts, atBats: s.atBats + g.atBats, pitches: s.pitches + g.pitches, lastGameId: g.id,
  }
}

/** Sums any number of seasons into one line (the career row). */
export function aggregate(seasons: Season[]): Season {
  const sum = newSeason(seasons.at(-1)?.tier ?? 0, seasons.length)
  for (const s of seasons) for (const k of ['games', 'wins', 'losses', 'saves', 'outs', 'runs', 'hits', 'walks', 'hbp', 'homeRuns', 'strikeouts', 'atBats', 'pitches'] as const) sum[k] += s[k] ?? 0
  return sum
}

/** Baseball notation: 14 outs → "4.2". */
export const formatIP = (outs: number) => `${Math.floor(outs / 3)}.${outs % 3}`

const per = (n: number, outs: number, scale: number, digits: number) => outs ? (n * scale / outs).toFixed(digits) : '—'
export function seasonRates(s: Season) {
  const ip = s.outs / 3
  return {
    ERA: per(s.runs, s.outs, 27, 2),
    WHIP: per(s.hits + s.walks, s.outs, 3, 2),
    FIP: ip ? ((13 * s.homeRuns + 3 * (s.walks + s.hbp) - 2 * s.strikeouts) / ip + FIP_CONSTANT).toFixed(2) : '—',
    'K/9': per(s.strikeouts, s.outs, 27, 1),
    'BB/9': per(s.walks, s.outs, 27, 1),
    'K/BB': s.walks ? (s.strikeouts / s.walks).toFixed(2) : s.strikeouts ? '∞' : '—',
    BAA: s.atBats ? (s.hits / s.atBats).toFixed(3).replace(/^0/, '') : '—',
  }
}

/** Seasons at KBO Futures or above count as professional service time. */
export const seasonDone = (s: Season) => s.games >= (s.scheduled ?? SEASON_GAMES)
export function serviceTime(history: Season[], current: Season) {
  const all = [...history, current]
  const firstPro = all.find(s => s.tier >= 1)
  const years = (pro: boolean) => new Set(all.filter(s => (s.tier >= 1) === pro && (s.games > 0 || s === current)).map(s => s.year ?? s.number)).size
  const proYears = years(true)
  const amateurYears = years(false)
  return {
    debutSeason: firstPro?.number ?? null,
    proYears,
    amateurYears,
    label: firstPro ? `Year ${proYears} Pro` : `Amateur Year ${Math.max(1, amateurYears)}`,
  }
}

/* ───────────────────────── Promotion / call-up / demotion ───────────────────────── */

/** ERA and FIP a pitcher must beat at each level to move up (MLB has no next level; its value only anchors demotion). */
export const PROMOTION_ERA = [4.5, 4.2, 3.9, 3.6, 3.6] as const
export const PROMOTION = { minOuts: 300, callUpGames: 10, callUpOuts: 150, callUpMargin: { era: 1.5, fip: 1 }, demoteMargin: 2, demoteMinOuts: 90 } as const
export const eraOf = (s: Season) => s.outs ? s.runs * 27 / s.outs : Infinity
export const fipOf = (s: Season) => s.outs ? (13 * s.homeRuns + 3 * (s.walks + s.hbp) - 2 * s.strikeouts) / (s.outs / 3) + FIP_CONSTANT : Infinity
export interface Criterion { label: string; value: string; goal: string; met: boolean }
export interface PromotionStatus { canPromote: boolean; callUp: boolean; demote: boolean; top: boolean; threshold: number; season: Criterion[]; callUpCriteria: Criterion[] }
export function promotionStatus(s: Season): PromotionStatus {
  const tier = Math.max(0, Math.min(TIERS.length - 1, s.tier))
  const top = tier === TIERS.length - 1
  const t = PROMOTION_ERA[tier], era = eraOf(s), fip = fipOf(s)
  const k = seasonScale(s)
  const minOuts = Math.round(PROMOTION.minOuts * k), cuGames = Math.round(PROMOTION.callUpGames * k), cuOuts = Math.round(PROMOTION.callUpOuts * k), demoteOuts = Math.round(PROMOTION.demoteMinOuts * k)
  const fmt = (n: number) => Number.isFinite(n) ? n.toFixed(2) : '—'
  const season: Criterion[] = [
    { label: 'ERA', value: fmt(era), goal: `≤ ${t.toFixed(2)}`, met: era <= t },
    { label: 'FIP', value: fmt(fip), goal: `≤ ${t.toFixed(2)}`, met: fip <= t },
    { label: 'IP', value: formatIP(s.outs), goal: `≥ ${formatIP(minOuts)}`, met: s.outs >= minOuts },
  ]
  const callUpCriteria: Criterion[] = [
    { label: '경기', value: String(s.games), goal: `≥ ${cuGames}`, met: s.games >= cuGames },
    { label: 'IP', value: formatIP(s.outs), goal: `≥ ${formatIP(cuOuts)}`, met: s.outs >= cuOuts },
    { label: 'ERA', value: fmt(era), goal: `≤ ${(t - PROMOTION.callUpMargin.era).toFixed(2)}`, met: era <= t - PROMOTION.callUpMargin.era },
    { label: 'FIP', value: fmt(fip), goal: `≤ ${(t - PROMOTION.callUpMargin.fip).toFixed(2)}`, met: fip <= t - PROMOTION.callUpMargin.fip },
  ]
  return {
    top, threshold: t, season, callUpCriteria,
    canPromote: !top && season.every(c => c.met),
    callUp: !top && !seasonDone(s) && callUpCriteria.every(c => c.met),
    demote: tier > 0 && s.outs >= demoteOuts && era >= t + PROMOTION.demoteMargin,
  }
}
/** Remaining starts after a call-up (at least five). */
export const callUpSchedule = (s: Season) => Math.max(Math.round(5 * seasonScale(s)), (s.scheduled ?? SEASON_GAMES) - s.games)

/* ───────────────────────── League awards ───────────────────────── */

interface AwardRule { name: string; test: (s: Season, era: number, fip: number) => boolean }
/** Innings pitched, normalised to a 30-start year so one rule set fits every season length. */
const ip = (s: Season) => s.outs / 3 / seasonScale(s)
/** Wins / strikeouts, normalised the same way. */
const n = (s: Season, v: number) => v / seasonScale(s)
/** Awards fitting each level, judged on the season's line (a full 30-start year ≈ 180 IP). */
export const AWARDS: AwardRule[][] = [
  [
    { name: '아마추어 최우수 투수상', test: (s, era) => era <= 2.5 && ip(s) >= 100 && n(s, s.wins) >= 10 },
    { name: '아마추어 탈삼진왕', test: s => n(s, s.strikeouts) >= 160 },
  ],
  [
    { name: '퓨처스리그 우수 투수상', test: (s, era) => era <= 2.8 && ip(s) >= 100 && n(s, s.wins) >= 10 },
    { name: '퓨처스리그 탈삼진왕', test: s => n(s, s.strikeouts) >= 150 },
  ],
  [
    { name: 'KBO 투수 골든글러브', test: (s, era) => era <= 3 && ip(s) >= 150 && n(s, s.wins) >= 14 },
    { name: 'KBO 최고 투수상', test: (s, era, fip) => era <= 2.4 && fip <= 3 && ip(s) >= 160 && n(s, s.strikeouts) >= 170 },
    { name: 'KBO 탈삼진왕', test: s => n(s, s.strikeouts) >= 190 },
  ],
  [
    { name: '트리플A 올해의 투수', test: (s, era) => era <= 2.8 && ip(s) >= 130 },
    { name: '트리플A 올스타', test: (s, era) => era <= 3.3 && ip(s) >= 80 },
  ],
  [
    { name: '사이영상', test: (s, era, fip) => era <= 2.6 && fip <= 3 && ip(s) >= 170 && (n(s, s.wins) >= 15 || n(s, s.strikeouts) >= 220) },
    { name: 'MLB 올스타', test: (s, era) => era <= 3.2 && ip(s) >= 90 },
    { name: 'MLB 탈삼진왕', test: s => n(s, s.strikeouts) >= 230 },
  ],
]
export function seasonAwards(s: Season): string[] {
  const rules = AWARDS[Math.max(0, Math.min(TIERS.length - 1, s.tier))]
  const era = eraOf(s), fip = fipOf(s)
  return rules.filter(r => r.test(s, era, fip)).map(r => r.name)
}
/** Every award and feat of a career, newest last, labelled with the season. */
export function trophyCase(seasons: Season[]) {
  return seasons.flatMap(s => [...(s.awards ?? []).map(a => ({ season: s.number, tier: s.tier, name: a, kind: 'award' as const })), ...(s.feats ?? []).map(f => ({ season: s.number, tier: s.tier, name: f, kind: 'feat' as const }))])
}

export function gameTeam(g: GameState) {
  const names = tierOf(g.tier).teams
  return { name: names[g.opponent % names.length], short: names[g.opponent % names.length], color: ['#5fa9ff', '#f5b643', '#eb627a', '#55c99b', '#e65454'][TIERS.indexOf(tierOf(g.tier))] }
}
