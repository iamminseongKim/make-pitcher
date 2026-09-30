/**
 * FIP constant per league, calibrated to this game's run environment.
 * Real FIP uses cFIP = lgERA − lg(13·HR + 3·(BB+HBP) − 2·K)/IP, recomputed every league-season
 * (≈3.10 for MLB). This game strikes out far more hitters in the low leagues, so MLB's 3.10
 * puts FIP well below ERA — and below zero for dominant pitchers. Run: pnpm sim:fip
 *
 * The constant is read at each league's promotion ERA (the decision point, where promotion needs
 * ERA and FIP both under the bar), so a pitcher right at the bar has FIP ≈ ERA on average.
 */
import { closeInning, defaultProfile, newGame } from '../src/game'
import { autoPlateAppearance } from '../src/highlight'
import { PROMOTION_ERA, TIERS } from '../src/season'
;(globalThis as any).performance ??= { now: () => Date.now() }

const LEVELS = [2, 5, 8, 12, 20, 30, 40, 50, 60, 75, 90]
const GAMES = Number(process.env.GAMES ?? 80)
const out: number[] = []
for (let tier = 0; tier < TIERS.length; tier++) {
  const pts: { era: number; gap: number }[] = []
  const rows: string[] = []
  for (const lv of LEVELS) {
    const p = defaultProfile(); p.created = true
    for (const id of ['FOUR_SEAM', 'SLIDER', 'CHANGEUP'] as const) p.arsenal[id] = { unlocked: true, velocityLevel: lv, controlLevel: lv, breakLevel: lv, mastery: 0 }
    let outs = 0, runs = 0, hr = 0, bb = 0, k = 0
    for (let i = 0; i < GAMES; i++) {
      let g = newGame(undefined, tier)
      while (!g.over && g.inning <= 9) { const a = autoPlateAppearance(g, { ...p, stamina: 100 }); g = a.game; if (a.inningOver) g = closeInning(g).game }
      outs += g.totalOuts; runs += g.runsAgainst; hr += g.homeRuns ?? 0; bb += g.walks + (g.hbp ?? 0); k += g.strikeouts
    }
    const ip = outs / 3, era = runs * 9 / ip, raw = (13 * hr + 3 * bb - 2 * k) / ip
    pts.push({ era, gap: era - raw })
    rows.push(`L${lv}: ERA ${era.toFixed(2)} K/9 ${(k * 9 / ip).toFixed(1)} raw ${raw.toFixed(2)}`)
  }
  // Interpolate the ERA−raw gap at the promotion ERA; if no level brackets it, use the two closest.
  const bar = PROMOTION_ERA[tier]
  const byEra = [...pts].sort((a, b) => a.era - b.era)
  const hi = byEra.findIndex(p => p.era >= bar)
  let gap: number
  if (hi > 0) { const a = byEra[hi - 1], b = byEra[hi]; gap = a.gap + (b.gap - a.gap) * (bar - a.era) / (b.era - a.era) }
  else { const near = [...pts].sort((a, b) => Math.abs(a.era - bar) - Math.abs(b.era - bar)).slice(0, 2); gap = (near[0].gap + near[1].gap) / 2 }
  const c = Math.round(gap * 20) / 20
  out.push(c)
  console.log(`${TIERS[tier].short}  bar ERA ${bar.toFixed(2)}  cFIP ≈ ${c.toFixed(2)}  ${rows.join(' | ')}`)
}
console.log(`FIP_CONSTANTS = [${out.map(n => n.toFixed(2)).join(', ')}]`)
