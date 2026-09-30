import { useEffect, useRef, useState } from 'react'
import { CHALLENGES, type ChallengeKind } from './arcade'
import { applyOutcome, createFlight, defaultProfile, newGame, PITCHES, resolvePitch, type PitchFlight, type PitchType } from './game'
import { PitchChart } from './PitchChart'

function challengeGame(kind: ChallengeKind) {
  const g = newGame(undefined, 2)
  if (kind === 'escape') g.bases = [true, true, true]
  if (kind === 'save') { g.inning = 9; g.runsFor = 1 }
  if (kind === 'boss') g.lineup = g.lineup.map(b => ({ ...b, contact: .9, power: .9, eye: .85 }))
  // Stable opponents make attempts comparable; no career history enters this mode.
  g.lineup = g.lineup.map((b, i) => ({ ...b, id: `challenge-${i}`, name: `도전자 ${i + 1}`, bats: i % 2 ? 'L' : 'R', zone: 'MIDDLE', weakness: 'NONE', contact: kind === 'boss' ? .9 : .65, power: kind === 'boss' ? .9 : .65, eye: kind === 'boss' ? .85 : .65, aggression: .6 }))
  return g
}
const fixedProfile = () => {
  const p = defaultProfile(); p.created = true; p.age = 25
  for (const s of Object.values(p.arsenal)) Object.assign(s, { unlocked: true, velocityLevel: 40, controlLevel: 40, breakLevel: 40 })
  return p
}
function loadBests(): Partial<Record<ChallengeKind, number>> { try { return JSON.parse(localStorage.getItem('ace-challenges-v1') || '{}') ?? {} } catch { return {} } }

export function Challenge({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<ChallengeKind | null>(null)
  const [game, setGame] = useState(() => challengeGame('save'))
  const [selected, setSelected] = useState<PitchType>('FOUR_SEAM')
  const [target, setTarget] = useState({ x: .8, y: .8 })
  const [meter, setMeter] = useState(0)
  const [charging, setCharging] = useState(false)
  const [done, setDone] = useState(false)
  const [message, setMessage] = useState('코스를 고르고 황금 구간에서 릴리스하세요.')
  const [bests, setBests] = useState(loadBests)
  const start = useRef<number | null>(null)
  const previous = useRef<PitchFlight | null>(null)
  const releaseRef = useRef<(v: number) => void>(() => {})
  const profile = useRef(fixedProfile())
  useEffect(() => {
    if (!charging) return
    let frame = 0
    const tick = () => {
      const v = (performance.now() - (start.current ?? performance.now())) / 1150
      setMeter(Math.min(v, 1))
      if (v >= 1.2) releaseRef.current(1.2)
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [charging])
  function release(v: number) {
    if (start.current === null || !kind || done) return
    start.current = null; setCharging(false)
    const p = PITCHES.find(p => p.id === selected)!
    const f = createFlight(p, profile.current.arsenal[selected], profile.current, target, v)
    const r = resolvePitch(f, { batter: game.lineup[game.batterIndex], pitcherHand: 'R', balls: game.balls, strikes: game.strikes, inning: game.inning, tier: 2, previous: previous.current, seenSpeeds: game.abLog.map(p => p.speed), seenTypes: game.abLog.map(p => p.pitch), fastest: 146, history: game.abLog })
    const result = applyOutcome(game, f, r), next = result.game
    previous.current = result.events.paEnded ? null : f
    const ended = kind === 'twenty' ? next.pitches >= 20 : next.totalOuts >= 3 || next.runsAgainst > 0 || (kind === 'boss' && (result.events.hit || result.events.walk))
    const success = kind === 'twenty' || (next.totalOuts >= 3 && next.runsAgainst === 0)
    const score = kind === 'twenty' ? Math.max(0, next.totalOuts * 100 + next.strikeouts * 25 - next.runsAgainst * 50) : success ? Math.max(100, 1000 - next.pitches * 15 + next.strikeouts * 30) : 0
    setMessage(ended ? `${success ? '도전 성공' : '다시 도전해요'} · ${score}점` : `${f.grade} · ${result.call.text}`)
    if (ended) {
      setDone(true)
      const updated = { ...bests, [kind]: Math.max(Number(bests[kind]) || 0, score) }
      setBests(updated); try { localStorage.setItem('ace-challenges-v1', JSON.stringify(updated)) } catch { /* optional */ }
    }
    if (next.outs >= 3) { next.outs = 0; next.bases = [false, false, false]; next.inningPitches = 0; next.inningHits = 0; next.inningWalks = 0; next.inningStrikeouts = 0 }
    setGame(next)
  }
  releaseRef.current = release
  function begin(id: ChallengeKind) { start.current = null; previous.current = null; setCharging(false); setMeter(0); setKind(id); setGame(challengeGame(id)); setDone(false); setMessage('황금 구간에서 릴리스 · 모든 구종 Lv.40') }
  return <div className="overlay"><section className="sheet challenge-sheet" role="dialog" aria-modal="true" aria-label="아케이드 챌린지">
    <div className="sheet-top"><span className="eyebrow">ARCADE / CHALLENGE</span><button className="secondary-button" onClick={onClose}>커리어로 돌아가기</button></div>
    <h1>한 순간의 에이스</h1><p className="muted">고정 능력치 · 커리어와 분리된 최고 기록 · TP 지급 없음</p>
    {!kind ? <div className="challenge-grid">{CHALLENGES.map(c => <button key={c.id} onClick={() => begin(c.id)}><span className="eyebrow">BEST {Number(bests[c.id]) || 0}</span><strong>{c.name}</strong><span>{c.description}</span></button>)}</div> : <>
      <h2>{CHALLENGES.find(c => c.id === kind)?.name}</h2>
      <div className="challenge-score"><b>{game.totalOuts} OUT</b><b>{game.strikeouts} K</b><b>{game.pitches}{kind === 'twenty' ? '/20' : ''}구</b><b>{game.runsAgainst}실점</b></div>
      <p>볼 {game.balls} · 스트라이크 {game.strikes} · 주자 {game.bases.map((b, i) => b ? `${i + 1}루` : '').filter(Boolean).join('·') || '없음'}</p>
      <div className="challenge-zone" aria-label="투구 코스">{[-1.25, -.8, 0, .8, 1.25].flatMap(y => [-1.25, -.8, 0, .8, 1.25].map(x => <button key={`${x}-${y}`} aria-label={`${x}, ${y} 코스`} aria-pressed={target.x === x && target.y === y} disabled={charging || done} className={`${Math.abs(x) > 1 || Math.abs(y) > 1 ? 'outside' : ''} ${target.x === x && target.y === y ? 'active' : ''}`} onClick={() => setTarget({ x, y })}>{target.x === x && target.y === y ? '◎' : '·'}</button>))}</div>
      <div className="training-tabs">{PITCHES.map(p => <button key={p.id} disabled={charging || done} className={selected === p.id ? 'active' : ''} onClick={() => setSelected(p.id)}>{p.short}</button>)}</div>
      <p role="status" className="challenge-message">{message}</p>
      {!done ? <><div className="challenge-meter"><span style={{ left: '75%', width: '14%' }} /><i style={{ left: `${meter * 100}%` }} /></div><button className="primary-button" onClick={() => { if (charging) release((performance.now() - start.current!) / 1150); else { start.current = performance.now(); setCharging(true) } }}>{charging ? '릴리스!' : '투구 시작'}</button></> : <><PitchChart pitches={game.pitchLog} /><button className="primary-button" onClick={() => begin(kind)}>다시 도전</button></>}
      <button className="secondary-button" disabled={charging} onClick={() => setKind(null)}>다른 챌린지 선택</button>
    </>}
  </section></div>
}
