import { ARM_SLOTS, clamp, decisionPoint, dispersion, pointOnFlight, type Hand, type PitchFlight, type PitchLog, type PitcherProfile, PITCHES } from './game'

export const STAGE = { width: 390, height: 432, zoneX: 195, zoneY: 232, zoneW: 124, zoneH: 136 }
const ZX = (x: number) => STAGE.zoneX + x * STAGE.zoneW / 2
const ZY = (y: number) => STAGE.zoneY + y * STAGE.zoneH / 2

export type SwingKind = 'idle' | 'swing' | 'take' | 'hbp'
export interface BatterAnim { kind: SwingKind; at: number; contact: boolean; barrel: { x: number; y: number } }
export interface BattedBall { at: number; spray: number; type: 'GROUND' | 'LINE' | 'FLY' | 'HR' | 'FOUL' | 'POP'; from: { x: number; y: number } }

export interface RenderScene {
  profile: PitcherProfile
  strikeoutChance?: boolean
  batterSide: Hand
  teamColor: string
  target: { x: number; y: number }
  flight: PitchFlight | null
  previousFlight: PitchFlight | null
  previewFlight: PitchFlight | null
  tunnel: number
  flightProgress: number
  showZone: boolean
  heat: number[][] | null
  log: PitchLog[]
  anim: BatterAnim
  batted: BattedBall | null
  result: { text: string; tone: string; at: number }
  now: number
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill()
}

export function projectedBall(f: PitchFlight, t: number) {
  const p = pointOnFlight(f, t)
  const depth = Math.pow(t, 1.35)
  return {
    x: 195 + p.x * (28 + 34 * depth),
    y: 132 + (STAGE.zoneY - 132) * depth + p.y * (22 + 46 * depth),
    radius: 2.4 + 9.5 * Math.pow(t, 1.8),
  }
}

/* ───────────── Scenery ───────────── */

let crowdCache: HTMLCanvasElement | null = null
function drawScenery(ctx: CanvasRenderingContext2D, now: number) {
  const w = STAGE.width, h = STAGE.height
  if (!crowdCache) {
    const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2
    const g = c.getContext('2d')!; g.scale(2, 2)
    const sky = g.createLinearGradient(0, 0, 0, 140)
    sky.addColorStop(0, '#050b14'); sky.addColorStop(1, '#0d1c2a')
    g.fillStyle = sky; g.fillRect(0, 0, w, 140)
    // Stands
    g.fillStyle = '#111d2b'; g.fillRect(0, 34, w, 80)
    for (let row = 0; row < 7; row++) for (let col = 0; col < 56; col++) {
      const x = col * 7.2 + (row % 2) * 3.6 - 4, y = 40 + row * 10
      const hue = (col * 37 + row * 91) % 100
      g.fillStyle = hue < 8 ? '#e0574c88' : hue < 14 ? '#f2d16b77' : hue < 22 ? '#8fb3ff55' : '#3b4a5f99'
      g.beginPath(); g.arc(x, y, 2.4, 0, Math.PI * 2); g.fill()
      g.fillRect(x - 2.6, y + 2, 5.2, 4)
    }
    // Outfield wall + ad boards
    g.fillStyle = '#0e3a2a'; g.fillRect(0, 112, w, 12)
    const ads = ['ACE', 'K-ZONE', '155', 'PITCH LAB', 'ACE']
    g.font = '800 8px system-ui'; g.textAlign = 'center'
    ads.forEach((a, i) => { roundRect(g, i * 80 + 4, 113, 72, 10, 2, i % 2 ? '#123e56' : '#3a1f1f'); g.fillStyle = '#e8f0e0aa'; g.fillText(a, i * 80 + 40, 121) })
    // Grass with mow stripes
    const grass = g.createLinearGradient(0, 124, 0, h)
    grass.addColorStop(0, '#1d5a35'); grass.addColorStop(1, '#123d25')
    g.fillStyle = grass; g.fillRect(0, 124, w, h - 124)
    for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? '#ffffff06' : '#00000010'; g.fillRect(0, 124 + i * 14, w, 14) }
    // Mound
    g.fillStyle = '#8a6a48'; g.beginPath(); g.ellipse(195, 176, 58, 13, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#a3825b'; g.beginPath(); g.ellipse(195, 173, 36, 7, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#f1efe4'; g.fillRect(187, 171, 16, 2.4)
    // Home dirt circle
    g.fillStyle = '#7b5d3f'; g.beginPath(); g.ellipse(195, 372, 190, 70, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#8e6d4a'; g.beginPath(); g.ellipse(195, 374, 120, 38, 0, 0, Math.PI * 2); g.fill()
    // Batter's boxes
    g.strokeStyle = '#f3f1e6aa'; g.lineWidth = 2
    g.strokeRect(58, 334, 82, 48); g.strokeRect(250, 334, 82, 48)
    // Foul lines
    g.strokeStyle = '#f3f1e680'; g.lineWidth = 2
    g.beginPath(); g.moveTo(-20, 290); g.lineTo(150, 352); g.moveTo(410, 290); g.lineTo(240, 352); g.stroke()
    // Plate
    g.fillStyle = '#f2f4ee'; g.beginPath(); g.moveTo(170, 346); g.lineTo(220, 346); g.lineTo(220, 354); g.lineTo(195, 366); g.lineTo(170, 354); g.closePath(); g.fill()
    crowdCache = c
  }
  ctx.drawImage(crowdCache, 0, 0, w, h)
  // Light towers flicker subtly.
  for (const x of [26, 364]) {
    const halo = ctx.createRadialGradient(x, 14, 0, x, 14, 90)
    halo.addColorStop(0, `rgba(255,248,220,${.26 + Math.sin(now / 900 + x) * .02})`); halo.addColorStop(1, 'rgba(255,248,220,0)')
    ctx.fillStyle = halo; ctx.fillRect(x - 90, 0, 180, 110)
    roundRect(ctx, x - 16, 8, 32, 9, 2, '#fff6d6')
  }
}

/* ───────────── Figures ───────────── */

function drawPitcher(ctx: CanvasRenderingContext2D, profile: PitcherProfile, flight: PitchFlight | null, t: number) {
  // Catcher view: the throwing arm of a righty is on screen-left.
  const arm = profile.hand === 'R' ? -1 : 1
  const slot = ARM_SLOTS[profile.armSlot]
  const release = { x: 195 + arm * slot.width * 28, y: 132 + (slot.releaseY - (profile.height - 185) / 90) * 22 }
  const follow = flight ? clamp(t * 4, 0, 1) : 0
  ctx.save()
  ctx.lineCap = 'round'; ctx.strokeStyle = '#e9ecef'; ctx.fillStyle = '#e9ecef'
  // legs
  ctx.lineWidth = 5
  ctx.beginPath(); ctx.moveTo(191, 152); ctx.lineTo(186 - follow * 4, 171); ctx.moveTo(199, 152); ctx.lineTo(205 + follow * 3, 171); ctx.stroke()
  // body
  ctx.beginPath(); ctx.ellipse(195, 141, 8.5, 13, arm * follow * .2, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#1f3a66'; ctx.beginPath(); ctx.ellipse(195, 145, 8.5, 5, 0, 0, Math.PI); ctx.fill()
  // head + cap
  ctx.fillStyle = '#d9b99a'; ctx.beginPath(); ctx.arc(195, 124, 5.2, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#1f3a66'; ctx.beginPath(); ctx.arc(195, 122.5, 5.4, Math.PI, 0); ctx.fill(); ctx.fillRect(191, 122, 8, 1.8)
  // glove arm
  ctx.strokeStyle = '#e9ecef'; ctx.lineWidth = 3.6
  ctx.beginPath(); ctx.moveTo(195 - arm * 6, 134); ctx.lineTo(195 - arm * (12 - follow * 6), 140 + follow * 4); ctx.stroke()
  ctx.fillStyle = '#6b4a2b'; ctx.beginPath(); ctx.arc(195 - arm * (12 - follow * 6), 141 + follow * 4, 3.4, 0, Math.PI * 2); ctx.fill()
  // throwing arm: cocked → release → follow-through
  const hand = flight
    ? { x: release.x + (195 - arm * 4 - release.x) * follow, y: release.y + (156 - release.y) * follow }
    : { x: 195 + arm * 13, y: 138 }
  ctx.strokeStyle = '#e9ecef'; ctx.lineWidth = 3.6
  ctx.beginPath(); ctx.moveTo(195 + arm * 6, 133); ctx.lineTo(hand.x, hand.y); ctx.stroke()
  ctx.restore()
}

function drawBatter(ctx: CanvasRenderingContext2D, side: Hand, anim: BatterAnim, color: string, now: number) {
  const dir = side === 'R' ? 1 : -1 // direction toward the plate
  const ox = side === 'R' ? 100 : 290, oy = 372
  const since = now - anim.at
  const idleBob = Math.sin(now / 420) * 1.2
  let lean = 0, flinch = 0
  if (anim.kind === 'take') flinch = Math.max(0, 1 - since / 260) * 3
  if (anim.kind === 'hbp') flinch = Math.max(0, 1 - since / 500) * 10 * Math.sin(since / 30)
  ctx.save()
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  // Swing progress: load → through the zone (at 0) → follow-through.
  const swingT = anim.kind === 'swing' ? clamp((since + 170) / 380, 0, 1) : 0
  lean = swingT * dir * 6
  const hip = { x: ox + lean * .4 - dir * flinch, y: oy - 62 }
  // legs
  ctx.strokeStyle = '#f0f0ec'; ctx.lineWidth = 10
  ctx.beginPath(); ctx.moveTo(hip.x - 6, hip.y); ctx.lineTo(ox - dir * 20, oy - 26); ctx.lineTo(ox - dir * 24, oy)
  ctx.moveTo(hip.x + 6, hip.y); ctx.lineTo(ox + dir * (20 + swingT * 6), oy - 28); ctx.lineTo(ox + dir * (26 + swingT * 8), oy); ctx.stroke()
  ctx.fillStyle = '#1b1b1f'
  ctx.beginPath(); ctx.ellipse(ox - dir * 26, oy + 2, 9, 4, 0, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(ox + dir * (28 + swingT * 8), oy + 2, 9, 4, 0, 0, Math.PI * 2); ctx.fill()
  // torso (jersey in team color)
  const torso = { x: hip.x + lean, y: oy - 94 + idleBob * .3 }
  ctx.fillStyle = color
  ctx.beginPath(); ctx.ellipse(torso.x, torso.y, 19, 32, dir * (.12 + swingT * .25), 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#00000030'; ctx.beginPath(); ctx.ellipse(torso.x - dir * 6, torso.y + 4, 9, 26, dir * .15, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#ffffffcc'; ctx.font = '900 13px system-ui'; ctx.textAlign = 'center'
  // head + helmet
  const head = { x: torso.x + dir * 3, y: torso.y - 44 + idleBob }
  ctx.fillStyle = '#c99f7d'; ctx.beginPath(); ctx.arc(head.x, head.y, 12, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(head.x, head.y - 2, 13, Math.PI * .95, Math.PI * 2.05); ctx.fill()
  ctx.fillStyle = '#00000055'; ctx.beginPath(); ctx.arc(head.x - dir * 7, head.y + 1, 5, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(head.x + dir * 12, head.y - 3, 8, 3, 0, 0, Math.PI * 2); ctx.fill()

  // hands and bat
  const idleHands = { x: torso.x - dir * 8, y: torso.y - 26 + idleBob }
  const contactHands = { x: torso.x + dir * 16, y: torso.y - 4 }
  const barrel = { x: ZX(anim.barrel.x), y: ZY(anim.barrel.y) }
  const a0 = Math.atan2(-60, -dir * 22)
  const a1 = Math.atan2(barrel.y - contactHands.y, barrel.x - contactHands.x)
  const a2 = a1 + dir * 2.3
  let hands = idleHands, angle = a0 + Math.sin(now / 380) * .05, len = 70
  if (swingT > 0) {
    const through = .45
    if (swingT < through) {
      const k = swingT / through, e = k * k
      hands = { x: idleHands.x + (contactHands.x - idleHands.x) * e, y: idleHands.y + (contactHands.y - idleHands.y) * e }
      angle = a0 + angleDiff(a0, a1) * e
    } else {
      const k = (swingT - through) / (1 - through), e = 1 - (1 - k) * (1 - k)
      hands = { x: contactHands.x - dir * 18 * e, y: contactHands.y - 16 * e }
      angle = a1 + (a2 - a1) * e
    }
    len = clamp(Math.hypot(barrel.x - contactHands.x, barrel.y - contactHands.y), 66, 104)
  }
  ctx.strokeStyle = '#f0f0ec'; ctx.lineWidth = 7
  ctx.beginPath(); ctx.moveTo(torso.x - dir * 10, torso.y - 18); ctx.lineTo(hands.x, hands.y); ctx.moveTo(torso.x + dir * 12, torso.y - 16); ctx.lineTo(hands.x, hands.y); ctx.stroke()
  ctx.strokeStyle = '#c9a26b'; ctx.lineWidth = 3.5
  ctx.beginPath(); ctx.moveTo(hands.x, hands.y); ctx.lineTo(hands.x + Math.cos(angle) * len * .55, hands.y + Math.sin(angle) * len * .55); ctx.stroke()
  ctx.lineWidth = 6.5
  ctx.beginPath(); ctx.moveTo(hands.x + Math.cos(angle) * len * .55, hands.y + Math.sin(angle) * len * .55); ctx.lineTo(hands.x + Math.cos(angle) * len, hands.y + Math.sin(angle) * len); ctx.stroke()
  // swing blur
  if (swingT > .3 && swingT < .7) {
    ctx.strokeStyle = '#ffffff26'; ctx.lineWidth = 14
    ctx.beginPath(); ctx.arc(hands.x, hands.y, len * .82, angle - dir * .6, angle, dir < 0); ctx.stroke()
  }
  ctx.fillStyle = '#1b1b1f'; ctx.beginPath(); ctx.arc(hands.x, hands.y, 4.5, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}
const angleDiff = (a: number, b: number) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d }

/* ───────────── Zone & overlays ───────────── */

function drawZone(ctx: CanvasRenderingContext2D, scene: RenderScene) {
  const left = ZX(-1), top = ZY(-1), w = STAGE.zoneW, h = STAGE.zoneH
  if (scene.heat) {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const v = scene.heat[r][c]
      ctx.fillStyle = v > 0 ? `rgba(255,86,70,${Math.min(.42, v * .5)})` : `rgba(70,140,255,${Math.min(.38, -v * .5)})`
      ctx.fillRect(left + c * w / 3, top + r * h / 3, w / 3, h / 3)
    }
  } else { ctx.fillStyle = '#ffffff08'; ctx.fillRect(left, top, w, h) }
  if (!scene.showZone) return
  ctx.strokeStyle = '#ffffffc0'; ctx.lineWidth = 1.6; ctx.strokeRect(left, top, w, h)
  ctx.strokeStyle = '#ffffff30'; ctx.lineWidth = 1
  for (let i = 1; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(left + i * w / 3, top); ctx.lineTo(left + i * w / 3, top + h); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(left, top + i * h / 3); ctx.lineTo(left + w, top + i * h / 3); ctx.stroke()
  }
}

function drawLog(ctx: CanvasRenderingContext2D, log: PitchLog[], hideLast: boolean) {
  const items = hideLast ? log.slice(0, -1) : log
  items.forEach((p, i) => {
    const x = ZX(p.x), y = ZY(p.y)
    const color = PITCHES.find(d => d.id === p.pitch)!.color
    const last = i === items.length - 1
    ctx.globalAlpha = last ? 1 : .8
    ctx.fillStyle = '#0b1118'; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.font = '800 9px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(String(i + 1), x, y + .5)
    ctx.globalAlpha = 1
  })
  ctx.textBaseline = 'alphabetic'
}

function drawTrail(ctx: CanvasRenderingContext2D, f: PitchFlight, end: number, alpha: number, width: number) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = f.pitch.color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.beginPath()
  for (let i = 0; i <= 48; i++) { const p = projectedBall(f, end * i / 48); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y) }
  ctx.stroke(); ctx.restore()
}

function drawPreview(ctx: CanvasRenderingContext2D, scene: RenderScene) {
  const f = scene.previewFlight!
  if (scene.previousFlight) {
    ctx.setLineDash([2, 4]); drawTrail(ctx, scene.previousFlight, 1, .45, 1.5); ctx.setLineDash([])
    // Tunnel window at the hitter's commit point.
    const td = decisionPoint(f)
    const a = projectedBall(f, td), b = projectedBall(scene.previousFlight, td)
    const good = scene.tunnel > .35
    ctx.strokeStyle = good ? '#e6ff7a' : '#ffffff55'; ctx.lineWidth = good ? 2 : 1
    ctx.setLineDash(good ? [] : [3, 3])
    ctx.beginPath(); ctx.arc((a.x + b.x) / 2, (a.y + b.y) / 2, 9 + Math.hypot(a.x - b.x, a.y - b.y) / 2, 0, Math.PI * 2); ctx.stroke()
    ctx.setLineDash([])
    if (good) {
      ctx.fillStyle = '#e6ff7a'; ctx.font = '900 10px system-ui'; ctx.textAlign = 'left'
      ctx.fillText(`TUNNEL ${Math.round(scene.tunnel * 100)}`, Math.max(a.x, b.x) + 14, (a.y + b.y) / 2 + 3)
    }
  }
  drawTrail(ctx, f, 1, .9, 2.2)
  const spread = dispersion(f.control) * .5
  for (const s of [-spread, spread]) {
    ctx.setLineDash([3, 5]); drawTrail(ctx, { ...f, landing: { x: f.landing.x + s, y: f.landing.y } }, 1, .3, 1.2)
  }
  ctx.setLineDash([])
}

function drawCrosshair(ctx: CanvasRenderingContext2D, scene: RenderScene) {
  const { target, now } = scene
  const tx = ZX(target.x), ty = ZY(target.y)
  const err = scene.previewFlight ? dispersion(scene.previewFlight.control) : .6
  const radius = 6 + err * 44
  const wobble = err * 8
  const wx = tx + Math.sin(now / 270) * wobble, wy = ty + Math.cos(now / 310) * wobble * .7
  ctx.fillStyle = '#ffffff10'; ctx.beginPath(); ctx.arc(tx, ty, radius, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#ffffff70'; ctx.lineWidth = 1.2; ctx.setLineDash([4, 4])
  ctx.beginPath(); ctx.arc(tx, ty, radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([])
  const color = scene.previewFlight?.pitch.color ?? '#ff8076'
  ctx.strokeStyle = color; ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(wx, wy, 10, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(wx - 17, wy); ctx.lineTo(wx - 6, wy); ctx.moveTo(wx + 6, wy); ctx.lineTo(wx + 17, wy); ctx.moveTo(wx, wy - 17); ctx.lineTo(wx, wy - 6); ctx.moveTo(wx, wy + 6); ctx.lineTo(wx, wy + 17); ctx.stroke()
}

function drawBall(ctx: CanvasRenderingContext2D, f: PitchFlight, t: number) {
  const speedPower = clamp((f.speed - 130) / 40, 0, 1)
  for (let i = 12; i >= 1; i--) {
    const p = projectedBall(f, clamp(t - i * (.009 + speedPower * .003), 0, 1))
    ctx.fillStyle = f.pitch.color + Math.round((1 - i / 13) * (40 + speedPower * 60)).toString(16).padStart(2, '0')
    ctx.beginPath(); ctx.arc(p.x, p.y, p.radius * (1 - i / 16), 0, Math.PI * 2); ctx.fill()
  }
  const ball = projectedBall(f, t)
  if (f.speed >= 155 && t > .5) {
    ctx.strokeStyle = '#9af0ff90'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.ellipse(ball.x, ball.y, ball.radius * 2.4, ball.radius * 1.4, -.2, 0, Math.PI * 2); ctx.stroke()
  }
  ctx.shadowColor = f.pitch.color; ctx.shadowBlur = 12 + speedPower * 14
  ctx.fillStyle = '#fffdf4'; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2); ctx.fill()
  ctx.shadowBlur = 0
  // Spinning seams
  const spin = t * (f.pitch.family === 'BREAKING' ? 40 : 26)
  ctx.strokeStyle = '#d24a42'; ctx.lineWidth = Math.max(.7, ball.radius * .14)
  ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius * .66, spin - .8, spin + .8); ctx.stroke()
  ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius * .66, spin + 2.3, spin + 3.9); ctx.stroke()
}

function drawBatted(ctx: CanvasRenderingContext2D, b: BattedBall, now: number) {
  const dur = b.type === 'HR' ? 1300 : b.type === 'GROUND' ? 650 : 950
  const k = clamp((now - b.at) / dur, 0, 1)
  if (k >= 1) return
  const sx = ZX(b.from.x), sy = ZY(b.from.y)
  const far = b.type === 'HR' ? -60 : b.type === 'GROUND' ? 180 : b.type === 'POP' ? 60 : b.type === 'FOUL' ? 20 : 105
  const ex = 195 + b.spray * (b.type === 'FOUL' ? 260 : 150), ey = far
  const arc = b.type === 'GROUND' ? 0 : b.type === 'POP' ? 180 : b.type === 'LINE' ? 40 : 120
  const x = sx + (ex - sx) * k, y = sy + (ey - sy) * k - Math.sin(k * Math.PI) * arc
  const r = Math.max(1.5, 7 * (1 - k * .85))
  ctx.fillStyle = '#fffdf4'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 10
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0
}

function drawResult(ctx: CanvasRenderingContext2D, result: RenderScene['result'], now: number) {
  const elapsed = now - result.at
  if (!result.text || elapsed > 1100) return
  const pop = elapsed < 120 ? .6 + elapsed / 120 * .5 : elapsed < 200 ? 1.1 - (elapsed - 120) / 80 * .1 : 1
  const alpha = clamp(1 - Math.max(0, elapsed - 780) / 320, 0, 1)
  const big = result.tone === 'k' || result.tone === 'hr'
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(195, 138); ctx.scale(pop, pop)
  ctx.textAlign = 'center'
  ctx.font = `italic 900 ${big ? 44 : 34}px 'Barlow Condensed', system-ui`
  const color = { k: '#e6ff7a', hr: '#ff5a4e', hit: '#ffb36b', out: '#8fe3ff', ball: '#f4f6f0', strike: '#f4f6f0', foul: '#f4f6f0' }[result.tone] ?? '#fff'
  ctx.lineWidth = 7; ctx.strokeStyle = '#05080cdd'; ctx.lineJoin = 'round'
  ctx.strokeText(result.text, 0, 0)
  ctx.fillStyle = color; ctx.fillText(result.text, 0, 0)
  ctx.restore()
}

export function renderScene(ctx: CanvasRenderingContext2D, scene: RenderScene) {
  const { flight, flightProgress: t, now } = scene
  ctx.clearRect(0, 0, STAGE.width, STAGE.height)
  ctx.save()
  const impactAge = (now - scene.result.at) / 1000
  const punch = !window.matchMedia('(prefers-reduced-motion: reduce)').matches && scene.result.tone === 'k' ? Math.max(0, 1 - impactAge / 1.2) : 0
  const zoom = 1 + punch * .10
  ctx.translate(STAGE.zoneX, STAGE.zoneY); ctx.scale(zoom, zoom); ctx.translate(-STAGE.zoneX, -STAGE.zoneY)
  drawScenery(ctx, now)
  drawPitcher(ctx, scene.profile, flight, t)
  drawZone(ctx, scene)
  drawLog(ctx, scene.log, Boolean(flight))
  if (!flight && scene.previewFlight) drawPreview(ctx, scene)
  if (!flight) drawCrosshair(ctx, scene)
  // The batter stands in front of the zone plane; the ball passes in front of him near the plate.
  drawBatter(ctx, scene.batterSide, scene.anim, scene.teamColor, now)
  if (flight && t <= 1) drawBall(ctx, flight, t)
  if (scene.batted) drawBatted(ctx, scene.batted, now)
  if (punch > 0) {
    ctx.strokeStyle = `rgba(230,255,122,${punch})`; ctx.lineWidth = 2 + punch * 3
    ctx.strokeRect(ZX(-1), ZY(-1), STAGE.zoneW, STAGE.zoneH)
    ctx.beginPath(); ctx.arc(STAGE.zoneX, STAGE.zoneY, 20 + impactAge * 90, 0, Math.PI * 2); ctx.stroke()
  }
  ctx.restore()
  drawResult(ctx, scene.result, now)
}
