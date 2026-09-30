import type { ArmSlot, Hand, PitcherProfile } from './game'
import { aggregate, eraOf, fipOf, formatIP, seasonScale, type Season } from './season'

/* ───────────────────────── Age & aging curve ───────────────────────── */

/** Draft age by starting league (a higher start means a later-developing prospect). */
export const START_AGE = [19, 21, 23, 24, 25] as const
export const AGE = { peakEnd: 31, commandDecline: 33, forceRetire: 42, amateurDeadline: 25, voluntary: 30 } as const

/**
 * Young arms learn faster; after 31 velocity leaks, after 33 command slips, and the tank shrinks every year.
 * Applied on top of trained stats, so a veteran must keep investing just to hold his level.
 */
export function ageEffects(age: number) {
  const over = Math.max(0, age - AGE.peakEnd), overCmd = Math.max(0, age - AGE.commandDecline)
  return {
    veloLoss: Math.min(10, over * .8 + Math.max(0, age - 36) * .6),
    staminaMul: 1 + over * .03,
    commandMul: 1 + overCmd * .02,
    tpMul: age <= 24 ? 1.2 : age >= 34 ? .9 : 1,
  }
}
export const ageStage = (age: number) => age <= 24 ? '성장기' : age <= AGE.peakEnd ? '전성기' : age < 36 ? '노련함' : '황혼기'

/* ───────────────────────── Retirement ───────────────────────── */

export type RetireReason = 'VOLUNTARY' | 'AGE' | 'NO_PRO'
export const RETIRE_LABEL: Record<RetireReason, string> = { VOLUNTARY: '명예 은퇴', AGE: '에이징 커브 · 42세 은퇴', NO_PRO: '프로 입성 실패' }

/**
 * Checked at season end with the age he just played at.
 * - 42 → forced
 * - still Amateur at 25 without earning promotion → forced (no pro contract)
 * - voluntary from age 30, or any time after a finished season
 */
export function retirementStatus(age: number, tier: number, canPromote: boolean, seasonsPlayed: number) {
  const forced: RetireReason | null = age + 1 >= AGE.forceRetire ? 'AGE' : tier === 0 && age >= AGE.amateurDeadline && !canPromote ? 'NO_PRO' : null
  return { forced, canRetire: forced !== null || age >= AGE.voluntary || seasonsPlayed >= 1 }
}

/* ───────────────────────── Legacy (account-level, survives every character) ───────────────────────── */

export interface RetiredPlayer {
  id: string
  name: string
  height: number
  hand: Hand
  armSlot: ArmSlot
  startAge: number
  retiredAge: number
  reason: RetireReason
  retiredAt: number
  seasons: Season[]
  peakTier: number
  hallOfFame: boolean
  honors: string[]
}

/** Hall of Fame bar, scaled to a 30-start season. */
export function hallOfFame(seasons: Season[]) {
  const c = aggregate(seasons)
  const mlbYears = new Set(seasons.filter(s => s.tier === 4 && s.games > 0).map(s => s.year)).size
  const honors: string[] = []
  // Career bars scale with the season lengths actually played (20-start years → 2/3).
  const played = seasons.filter(s => s.games > 0)
  const k = played.length ? played.reduce((n, s) => n + seasonScale(s), 0) / played.length : 1
  if (c.wins >= Math.round(150 * k)) honors.push(`통산 ${c.wins}승`)
  if (c.strikeouts >= Math.round(2000 * k)) honors.push(`통산 ${c.strikeouts}K`)
  if (mlbYears >= 3 && c.outs >= Math.round(1500 * k) && eraOf(aggregate(seasons.filter(s => s.tier === 4))) <= 3) honors.push(`MLB ${mlbYears}시즌 ERA 3.00 이하`)
  if (mlbYears >= 5) honors.push(`MLB ${mlbYears}시즌`)
  const count = (name: string) => seasons.filter(s => (s.awards ?? []).includes(name)).length
  if (count('사이영상') >= 2) honors.push(`사이영상 ${count('사이영상')}회`)
  if (count('KBO 투수 골든글러브') >= 3) honors.push(`KBO 골든글러브 ${count('KBO 투수 골든글러브')}회`)
  return { hallOfFame: honors.length > 0, honors, mlbYears }
}

export function buildRetired(profile: PitcherProfile, seasons: Season[], reason: RetireReason): RetiredPlayer {
  const played = seasons.filter(s => s.games > 0)
  const hof = hallOfFame(played)
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: profile.name, height: profile.height, hand: profile.hand, armSlot: profile.armSlot,
    startAge: profile.startAge ?? START_AGE[0], retiredAge: profile.age ?? START_AGE[0], reason, retiredAt: Date.now(),
    seasons: played, peakTier: Math.max(0, ...played.map(s => s.tier)), hallOfFame: hof.hallOfFame, honors: hof.honors,
  }
}

/** One-line résumé used in lists. */
export function careerLine(p: RetiredPlayer) {
  const c = aggregate(p.seasons)
  const era = eraOf(c), fip = fipOf(c)
  return `${c.wins}승 ${c.losses}패 · ${formatIP(c.outs)} IP · ERA ${Number.isFinite(era) ? era.toFixed(2) : '—'} · FIP ${Number.isFinite(fip) ? fip.toFixed(2) : '—'} · ${c.strikeouts}K`
}

/** Starting TP bonus for the next draftee: every retired arm leaves something behind for the next one. */
export const legacyBonus = (list: RetiredPlayer[]) => Math.min(400, list.length * 40 + list.filter(p => p.hallOfFame).length * 80)

export const LEGACY_KEY = 'ace-project-legacy-v1'
export function loadLegacy(): RetiredPlayer[] {
  try { const v = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]'); return Array.isArray(v) ? v.filter(p => p && Array.isArray(p.seasons)) : [] } catch { return [] }
}
export function saveLegacy(list: RetiredPlayer[]) {
  try { localStorage.setItem(LEGACY_KEY, JSON.stringify(list)) } catch { /* storage optional */ }
}
