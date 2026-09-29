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
/** A full rotation turn: a starter takes the ball about 30 times a season. */
export const SEASON_GAMES = 30
export const FIP_CONSTANT = 3.1

export interface Season {
  number: number; tier: number; games: number; wins: number; losses: number; saves: number
  outs: number; runs: number; hits: number; walks: number; hbp: number; homeRuns: number; strikeouts: number; atBats: number; pitches: number
  lastGameId: number
}
export const newSeason = (tier = 0, number = 1): Season => ({ number, tier, games: 0, wins: 0, losses: 0, saves: 0, outs: 0, runs: 0, hits: 0, walks: 0, hbp: 0, homeRuns: 0, strikeouts: 0, atBats: 0, pitches: 0, lastGameId: -1 })
/** Fills fields added after v2 so old saves keep loading. */
export const normalizeSeason = (s: Partial<Season> | undefined, fallbackNumber = 1): Season => {
  const base = newSeason(0, fallbackNumber)
  const merged = { ...base, ...s }
  return { ...merged, tier: Math.max(0, Math.min(TIERS.length - 1, Math.floor(Number(merged.tier) || 0))) }
}

export const gameWon = (g: GameState) => pitcherDecision(g) === 'W'
export const gameSaved = (g: GameState) => gameWon(g) && !g.pulled && Boolean(g.saveOpp)
/** Runs charged to our pitcher (the bullpen's runs are not his). */
export const pitcherRuns = (g: GameState) => g.runsAgainst - (g.bullpenRuns ?? 0)
export function recordGame(s: Season, g: GameState): Season {
  if (!g.over || g.id === s.lastGameId) return s
  return {
    ...s, games: s.games + 1, wins: s.wins + Number(gameWon(g)), losses: s.losses + Number(pitcherDecision(g) === 'L'), saves: s.saves + Number(gameSaved(g)),
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
export function serviceTime(history: Season[], current: Season) {
  const all = [...history, current]
  const firstPro = all.find(s => s.tier >= 1)
  const proYears = all.filter(s => s.tier >= 1 && (s.games > 0 || s === current)).length
  const amateurYears = all.filter(s => s.tier === 0 && (s.games > 0 || s === current)).length
  return {
    debutSeason: firstPro?.number ?? null,
    proYears,
    amateurYears,
    label: firstPro ? `Year ${proYears} Pro` : `Amateur Year ${Math.max(1, amateurYears)}`,
  }
}

export function gameTeam(g: GameState) {
  const names = tierOf(g.tier).teams
  return { name: names[g.opponent % names.length], short: names[g.opponent % names.length], color: ['#5fa9ff', '#f5b643', '#eb627a', '#55c99b', '#e65454'][TIERS.indexOf(tierOf(g.tier))] }
}
