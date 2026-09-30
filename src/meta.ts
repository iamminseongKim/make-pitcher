import { PITCHES, pitcherLevel, statSpeed, upgradeCost, type PitcherProfile, type PitchType, type StatKey } from './game'
import type { PlayMode } from './highlight'

/* ───────────────────────── Settings (per device) ───────────────────────── */

export interface Settings {
  sound: boolean; haptics: boolean; zone: boolean; heat: boolean; memory: boolean
  /** 0–100. Background music 「스트라이크 존으로」 and sound effects are adjusted separately. */
  bgmVolume: number
  sfxVolume: number
  /** Show IVB / VAA / 체감 and tactic hints. */
  details: boolean
  mode: PlayMode
  tutorialDone: boolean
}
export const SETTINGS_KEY = 'ace-project-settings-v1'
export const DEFAULT_SETTINGS: Settings = { bgmVolume: 50, sfxVolume: 80, sound: true, haptics: true, zone: true, heat: false, memory: true, details: false, mode: 'highlight', tutorialDone: false }
export function loadSettings(): Settings {
  try {
    const { bgm: _oldBgmToggle, ...saved } = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    const s = { ...DEFAULT_SETTINGS, ...saved }
    const vol = (v: unknown, d: number) => Number.isFinite(Number(v)) ? Math.max(0, Math.min(100, Math.round(Number(v)))) : d
    return { ...s, bgmVolume: vol(s.bgmVolume, 50), sfxVolume: vol(s.sfxVolume, 80) }
  } catch { return { ...DEFAULT_SETTINGS } }
}
export function saveSettings(s: Settings) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch { /* storage optional */ } }

/* ───────────────────────── Daily missions & check-in streak ───────────────────────── */

export type DailyId = 'k5' | 'perfect8' | 'clean1' | 'game1' | 'upgrade3' | 'corner3' | 'chase4'
export const DAILY_POOL: Record<DailyId, { text: string; goal: number }> = {
  k5: { text: '직접 삼진 5개', goal: 5 },
  perfect8: { text: 'PERFECT 릴리스 8회', goal: 8 },
  clean1: { text: '무실점 이닝 2회', goal: 2 },
  game1: { text: '경기 1번 마치기', goal: 1 },
  upgrade3: { text: '구종 강화 3회', goal: 3 },
  corner3: { text: '코너 루킹 스트라이크 3회', goal: 3 },
  chase4: { text: '유인구 헛스윙 4회', goal: 4 },
}
/** Raw TP per mission / for clearing all three (league multiplier applies). */
export const DAILY_TP = { mission: 50, allClear: 100 } as const
/** Check-in reward grows with the streak up to day 7. */
export const streakTP = (streak: number) => 20 * Math.min(7, Math.max(1, streak))

export interface DailyMission { id: DailyId; progress: number; done: boolean }
export interface DailyState { day: string; missions: DailyMission[]; allClear: boolean; streak: number; lastCheckIn: string }
export const DAILY_KEY = 'ace-project-daily-v1'
export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const yesterdayKey = (d = new Date()) => todayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1))

/** Three missions picked deterministically from the date. */
export function missionsFor(day: string): DailyMission[] {
  const ids = Object.keys(DAILY_POOL) as DailyId[]
  let h = 0
  for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const picked: DailyId[] = []
  while (picked.length < 3) { h = (h * 1103515245 + 12345) >>> 0; const id = ids[h % ids.length]; if (!picked.includes(id)) picked.push(id) }
  return picked.map(id => ({ id, progress: 0, done: false }))
}
export function loadDaily(): DailyState {
  try {
    const d = JSON.parse(localStorage.getItem(DAILY_KEY) || 'null')
    if (d && Array.isArray(d.missions)) return d
  } catch { /* fresh */ }
  return { day: '', missions: [], allClear: false, streak: 0, lastCheckIn: '' }
}
export function saveDaily(d: DailyState) { try { localStorage.setItem(DAILY_KEY, JSON.stringify(d)) } catch { /* storage optional */ } }

/** Rolls the day over and checks in. `checkIn` is the streak reward earned now (0 if already checked in today). */
export function openDay(d: DailyState, now = new Date()): { daily: DailyState; checkIn: number } {
  const today = todayKey(now)
  if (d.day === today && d.lastCheckIn === today) return { daily: d, checkIn: 0 }
  const streak = d.lastCheckIn === yesterdayKey(now) ? d.streak + 1 : d.lastCheckIn === today ? d.streak : 1
  const fresh = d.day === today ? d : { ...d, day: today, missions: missionsFor(today), allClear: false }
  return { daily: { ...fresh, streak, lastCheckIn: today }, checkIn: d.lastCheckIn === today ? 0 : streakTP(streak) }
}

/** Adds progress; returns the raw TP newly earned and the missions just completed. */
export function progressDaily(d: DailyState, counts: Partial<Record<DailyId, number>>): { daily: DailyState; tp: number; completed: string[] } {
  let tp = 0
  const completed: string[] = []
  const missions = d.missions.map(m => {
    const add = counts[m.id] ?? 0
    if (!add || m.done) return m
    const goal = DAILY_POOL[m.id].goal
    const progress = Math.min(goal, m.progress + add)
    const done = progress >= goal
    if (done) { tp += DAILY_TP.mission; completed.push(DAILY_POOL[m.id].text) }
    return { ...m, progress, done }
  })
  let allClear = d.allClear
  if (!allClear && missions.length && missions.every(m => m.done)) { allClear = true; tp += DAILY_TP.allClear; completed.push('오늘의 미션 올클리어') }
  return { daily: { ...d, missions, allClear }, tp, completed }
}

/* ───────────────────────── Recommended upgrade ───────────────────────── */

export interface Recommendation { pitch: PitchType; key: StatKey; level: number; cost: number }
/**
 * One-tap training: the weakest stat of your two most-used pitches, command first on ties
 * (command widens the release window, the most felt upgrade early on).
 */
export function recommendUpgrade(p: PitcherProfile): Recommendation | null {
  const owned = PITCHES.filter(d => p.arsenal[d.id].unlocked).sort((a, b) => p.arsenal[b.id].mastery - p.arsenal[a.id].mastery).slice(0, 2)
  const order: StatKey[] = ['controlLevel', 'velocityLevel', 'breakLevel']
  let best: Recommendation | null = null
  for (const d of owned) for (const key of order) {
    const level = p.arsenal[d.id][key]
    if (level >= 99) continue
    const cost = upgradeCost(level)
    if (!best || level < best.level) best = { pitch: d.id, key, level, cost }
  }
  return best
}

/* ───────────────────────── Growth milestones ───────────────────────── */

const SPEEDS = [140, 145, 150, 155, 160, 165]
const LEVELS = [10, 20, 30, 50, 75, 100]
/** Every milestone this pitcher has reached (stable ids, used to detect new ones). */
export function milestonesOf(p: PitcherProfile): string[] {
  const out: string[] = []
  const top = Math.max(0, ...PITCHES.filter(d => p.arsenal[d.id].unlocked && d.family === 'FASTBALL').map(d => statSpeed(d, p.arsenal[d.id])))
  for (const s of SPEEDS) if (top >= s) out.push(`${s}km/h 돌파`)
  const lv = pitcherLevel(p)
  for (const l of LEVELS) if (lv >= l) out.push(`투수 LV.${l}`)
  const owned = PITCHES.filter(d => p.arsenal[d.id].unlocked).length
  for (const n of [3, 4, 5, 8]) if (owned >= n) out.push(`${n}구종 레퍼토리`)
  return out
}
export const newMilestones = (before: PitcherProfile, after: PitcherProfile) => { const had = new Set(milestonesOf(before)); return milestonesOf(after).filter(m => !had.has(m)) }
