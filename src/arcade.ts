import type { GameState, PitchEvents, PitchResult, PitchStat, PitchType } from './game'
import type { PitchFlight } from './physics'

export type Mission = 'corners' | 'efficient' | 'variety'
export type Trait = 'command' | 'signature'
export type Effort = 'normal' | 'power'
export interface ArcadeState {
  focus: number; points: number; techniques: string[]; mission: Mission | null;
  progress: number; completed: boolean; finishers: PitchType[]; danger: boolean; inningRuns: number;
}
export const freshArcade = (): ArcadeState => ({ focus: 0, points: 0, techniques: [], mission: null, progress: 0, completed: false, finishers: [], danger: false, inningRuns: 0 })
export const MISSIONS = [
  { id: 'corners' as const, title: '코너 아티스트', text: '코너 루킹 스트라이크 5회', goal: 5 },
  { id: 'efficient' as const, title: '경제적인 에이스', text: '12구 이하 무실점 이닝 1회', goal: 1 },
  { id: 'variety' as const, title: '결정구 컬렉터', text: '서로 다른 2구종으로 삼진', goal: 2 },
]
export const traitActive = (s: PitchStat) => s.unlocked && s.mastery >= 225 ? s.trait : undefined
export function signatureText(id: PitchType) {
  return id === 'SINKER' ? '낮은 싱커 병살 확률 +20%p' : id === 'FOUR_SEAM' ? '높은 포심 컨택 품질 감소' : id === 'CUTTER' ? '3구 이내 범타 보상 +8 TP' : id === 'CHANGEUP' || id === 'SPLITTER' ? '터널 배합의 컨택 억제 강화' : '존 밖 유인구 반응 +12%'
}
/** Only actual outcomes earn technique rewards; balls never erase progress. */
export function rewardArcade(g: GameState, next: GameState, f: PitchFlight, r: PitchResult, ev: PitchEvents) {
  const old = g.arcade ?? freshArcade()
  const a: ArcadeState = { ...old, techniques: [], finishers: [...old.finishers], danger: old.danger || g.bases[1] || g.bases[2], inningRuns: old.inningRuns + ev.runs }
  if (ev.strikeout && r.tunnel > .45) a.techniques.push('터널 피니시')
  if (ev.strikeout && r.tags.includes('눈높이 흔들기')) a.techniques.push('높낮이 지배')
  if (r.outcome === 'CALLED_STRIKE' && r.tags.includes('코너 꽉 찬 공')) a.techniques.push('코너 마스터')
  if (ev.out && !ev.strikeout && g.abLog.length < 3) a.techniques.push('효율 투구')
  if (ev.doublePlay) a.techniques.push('더블 플레이')
  if (ev.out && g.lineup[g.batterIndex].id.startsWith('rival-')) a.techniques.push('라이벌 제압')
  if (ev.inningOver && a.inningRuns === 0 && a.danger) a.techniques.push('위기 탈출')
  if (ev.inningOver && a.inningRuns === 0 && next.inningPitches <= 12) a.techniques.push('경제적인 이닝')
  const bonus = Math.min(32, a.techniques.length * 8)
  a.focus = Math.min(100, a.focus + Math.min(24, a.techniques.length * 10) + (ev.out ? 4 : 0))
  a.points += bonus
  ev.reward += bonus; ev.mastery += a.techniques.length * 4
  if (f.trait === 'signature' && f.pitch.id === 'CUTTER' && ev.out && g.abLog.length < 3) ev.reward += 8
  if (!a.completed && a.mission) {
    if (a.mission === 'corners' && a.techniques.includes('코너 마스터')) a.progress++
    if (a.mission === 'efficient' && a.techniques.includes('경제적인 이닝')) a.progress = 1
    if (a.mission === 'variety' && ev.strikeout) { if (!a.finishers.includes(f.pitch.id)) a.finishers.push(f.pitch.id); a.progress = a.finishers.length }
    const goal = MISSIONS.find(m => m.id === a.mission)!.goal
    if (a.progress >= goal) { a.progress = goal; a.completed = true; ev.reward += 60; a.techniques.push('등판 목표 달성 +60 TP') }
  }
  if (ev.inningOver) { a.danger = false; a.inningRuns = 0 }
  next.arcade = a
}
export function performanceBonus(g: GameState) {
  const runs = Math.max(0, g.runsAgainst - (g.bullpenRuns ?? 0))
  return Math.max(0, Math.min(150, g.totalOuts * 4 + g.strikeouts * 2 - runs * 12 - g.walks * 3))
}
export type ChallengeKind = 'save' | 'escape' | 'twenty' | 'boss'
export const CHALLENGES: { id: ChallengeKind; name: string; description: string }[] = [
  { id: 'save', name: '마지막 3아웃', description: '9회 1점 차 · 리드를 지켜라' },
  { id: 'escape', name: '탈출의 기술', description: '무사 만루 · 실점 없이 3아웃' },
  { id: 'twenty', name: '20구 스프린트', description: '20구 안에 최대한 많은 아웃' },
  { id: 'boss', name: '클린업 헌터', description: '강타자 3명 · 모두 출루 없이 제압' },
]
