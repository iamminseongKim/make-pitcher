import type { GameState } from './game'

export const TIERS = [
  { label: 'Amateur', strength: -.12, reaction: -8, teams: ['Seoul Campus', 'Busan Academy', 'Incheon Club', 'Daegu Juniors'] },
  { label: 'KBO Futures', strength: -.05, reaction: -4, teams: ['Icheon Futures', 'Gimhae Futures', 'Hampyeong Futures', 'Seosan Futures'] },
  { label: 'KBO League', strength: .02, reaction: 0, teams: ['Seoul Twins', 'Busan Seagulls', 'Daegu Lions', 'Gwangju Tigers'] },
  { label: 'Triple-A', strength: .08, reaction: 4, teams: ['Durham Bulls', 'Norfolk Tides', 'Toledo Mud Hens', 'Reno Aces'] },
  { label: 'MLB', strength: .14, reaction: 8, teams: ['New York', 'Los Angeles', 'Seattle', 'Boston'] },
] as const
export const SEASON_GAMES = 5
export interface Season { number: number; tier: number; games: number; wins: number; losses: number; outs: number; runs: number; hits: number; walks: number; strikeouts: number; atBats: number; lastGameId: number }
export const newSeason = (tier = 0, number = 1): Season => ({ number, tier, games: 0, wins: 0, losses: 0, outs: 0, runs: 0, hits: 0, walks: 0, strikeouts: 0, atBats: 0, lastGameId: -1 })
export function recordGame(s: Season, g: GameState): Season {
  if (!g.over || g.id === s.lastGameId) return s
  return { ...s, games: s.games + 1, wins: s.wins + Number(g.runsFor > g.runsAgainst), losses: s.losses + Number(g.runsFor < g.runsAgainst), outs: s.outs + g.totalOuts, runs: s.runs + g.runsAgainst, hits: s.hits + g.hits, walks: s.walks + g.walks, strikeouts: s.strikeouts + g.strikeouts, atBats: s.atBats + g.atBats, lastGameId: g.id }
}
export function seasonRates(s: Season) {
  return { ERA: s.outs ? (s.runs * 27 / s.outs).toFixed(2) : '—', WHIP: s.outs ? ((s.hits + s.walks) * 3 / s.outs).toFixed(2) : '—', 'K/9': s.outs ? (s.strikeouts * 27 / s.outs).toFixed(1) : '—', BAA: s.atBats ? (s.hits / s.atBats).toFixed(3) : '—' }
}
export function gameTeam(g: GameState) { const names = TIERS[g.tier].teams; return { name: names[g.opponent % names.length], short: names[g.opponent % names.length], color: ['#5fa9ff', '#f5b643', '#eb627a', '#55c99b', '#e65454'][g.tier] } }
