import { ARM_SLOTS, TUNNEL_POINT, clamp, dispersion, pointOnFlight, type Hand, type PitchFlight, type PitchLog, type PitcherProfile, type PlateAppearance, PITCHES } from './game'

export const STAGE = { width: 390, height: 432, zoneX: 195, zoneY: 232, zoneW: 124, zoneH: 136 }
/**
 * Camera. umpire = behind the catcher (default). broadcast = TV center-field camera behind the pitcher:
 * the pitcher's back in the foreground, the hitter and catcher far away, left/right mirrored.
 */
export type CameraView = 'umpire' | 'broadcast'
const VIEWS: Record<CameraView, { cx: number; cy: number; w: number; h: number; mirror: number }> = {
  umpire: { cx: STAGE.zoneX, cy: STAGE.zoneY, w: STAGE.zoneW, h: STAGE.zoneH, mirror: 1 },
  broadcast: { cx: 195, cy: 200, w: 66, h: 74, mirror: -1 },
}
let view: CameraView = 'umpire'
const ZX = (x: number) => VIEWS[view].cx + VIEWS[view].mirror * x * VIEWS[view].w / 2
const ZY = (y: number) => VIEWS[view].cy + y * VIEWS[view].h / 2
/** Canvas point → zone units for a camera (inverse of ZX/ZY; used for aiming taps). */
export function canvasToZone(cam: CameraView, x: number, y: number) {
  const v = VIEWS[cam]
  return { x: (x - v.cx) / (v.w / 2) * v.mirror, y: (y - v.cy) / (v.h / 2) }
}

export type SwingKind = 'idle' | 'swing' | 'take' | 'hbp'
export interface BatterAnim { kind: SwingKind; at: number; contact: boolean; barrel: { x: number; y: number } }
export interface BattedBall { at: number; spray: number; type: 'GROUND' | 'LINE' | 'FLY' | 'HR' | 'FOUL' | 'POP'; from: { x: number; y: number } }

export interface RenderScene {
  view?: CameraView
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
  /** 0→1 while the release meter charges (the pitcher coils into his arm slot). */
  charge?: number
  showZone: boolean
  heat: number[][] | null
  log: PitchLog[]
  /** Earlier plate appearances of the hitter now at the plate (drawn as a ghost overlay). */
  memory: PlateAppearance[] | null
  anim: BatterAnim
  batted: BattedBall | null
  result: { text: string; tone: string; at: number }
  now: number
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill()
}

/*
 * Broadcast camera: the pitcher is close to the lens (drawn big, from behind, feet off the bottom edge)
 * and offset to his glove side so the plate stays visible; the hitter is ~18 m away and small.
 */
const PITCHER_SCALE = 1.45, PITCHER_BASE = 440
const pitcherX = (righty: boolean) => righty ? 122 : 268
/** Release hand in the pitcher's own (unscaled) drawing space. release: zone units, catcher view (righty = negative x). */
function handLocal(release: { x: number; y: number }) {
  return { x: pitcherX(release.x <= 0) - release.x * 52 - Math.sign(release.x) * 8, y: 336 + release.y * 44 }
}
/** Release hand on the canvas. */
function broadcastHand(release: { x: number; y: number }) {
  const h = handLocal(release), ax = pitcherX(release.x <= 0)
  return { x: ax + (h.x - ax) * PITCHER_SCALE, y: PITCHER_BASE + (h.y - PITCHER_BASE) * PITCHER_SCALE }
}
const CAM = 8, RUN = 16.6
/** 0 at the hand → 1 at the plate. The ball recedes from the camera, so it covers most of the screen early. */
const recede = (t: number) => (1 / CAM - 1 / (CAM + RUN * t)) / (1 / CAM - 1 / (CAM + RUN))
function broadcastBall(f: PitchFlight, t: number) {
  const p = pointOnFlight(f, t), hand = broadcastHand(f.release), d = recede(clamp(t, 0, 1))
  return {
    x: ZX(p.x) + (hand.x - ZX(f.release.x)) * (1 - d),
    y: ZY(p.y) + (hand.y - ZY(f.release.y)) * (1 - d),
    radius: 2.4 + 10 * Math.pow(1 - d, 1.5),
  }
}

export function projectedBall(f: PitchFlight, t: number) {
  if (view === 'broadcast') return broadcastBall(f, t)
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
    sky.addColorStop(0, '#070b16'); sky.addColorStop(1, '#131c2e')
    g.fillStyle = sky; g.fillRect(0, 0, w, 140)
    // Stands
    g.fillStyle = '#141d30'; g.fillRect(0, 34, w, 80)
    for (let row = 0; row < 7; row++) for (let col = 0; col < 56; col++) {
      const x = col * 7.2 + (row % 2) * 3.6 - 4, y = 40 + row * 10
      const hue = (col * 37 + row * 91) % 100
      g.fillStyle = hue < 8 ? '#ffb40077' : hue < 14 ? '#22d3ee66' : hue < 22 ? '#f5f8fc44' : '#34435e99'
      g.beginPath(); g.arc(x, y, 2.4, 0, Math.PI * 2); g.fill()
      g.fillRect(x - 2.6, y + 2, 5.2, 4)
    }
    // Outfield wall + ad boards
    g.fillStyle = '#0c3b24'; g.fillRect(0, 112, w, 12)
    const ads = ['ACE', 'K-ZONE', '155', 'PITCH LAB', 'ACE']
    g.font = '800 8px system-ui'; g.textAlign = 'center'
    ads.forEach((a, i) => { roundRect(g, i * 80 + 4, 113, 72, 10, 2, i % 2 ? '#0e2c3d' : '#2a2210'); g.fillStyle = i % 2 ? '#22d3eecc' : '#ffb400cc'; g.fillText(a, i * 80 + 40, 121) })
    // Grass with mow stripes
    const grass = g.createLinearGradient(0, 124, 0, h)
    grass.addColorStop(0, '#1d7a45'); grass.addColorStop(1, '#0f4a2a')
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

/* ───────────── Arm action ───────────── */

type P = { x: number; y: number }
/**
 * Hand path per arm slot, relative to the throwing shoulder in arm lengths
 * (x: + toward the throwing-arm side, y: + down). cock = loaded position while the meter charges,
 * via/finish = the follow-through after release (quadratic curve).
 */
const SWING: Record<keyof typeof ARM_SLOTS, { cock: [number, number]; via: [number, number]; finish: [number, number] }> = {
  // over the top: hand high behind the head → straight down across the body
  OVERHAND: { cock: [.3, -.95], via: [-.1, .2], finish: [-.65, 1.05] },
  // three-quarter: diagonal from high-outside to the glove-side knee
  THREE_QUARTER: { cock: [.9, -.45], via: [0, .05], finish: [-.8, .85] },
  // sidearm: a flat sweep at shoulder height
  SIDEARM: { cock: [1.1, .15], via: [0, -.1], finish: [-1, .3] },
  // submarine: the hand dips below the knee and scoops up across the chest
  SUBMARINE: { cock: [.5, 1.15], via: [.15, .95], finish: [-.65, -.5] },
}
const quad = (a: P, b: P, c: P, k: number) => ({ x: (1 - k) * (1 - k) * a.x + 2 * (1 - k) * k * b.x + k * k * c.x, y: (1 - k) * (1 - k) * a.y + 2 * (1 - k) * k * b.y + k * k * c.y })
/** Throwing hand: set → cocked while charging → release → slot-shaped follow-through. Draws the swing blur. */
function throwingArm(ctx: CanvasRenderingContext2D, slot: keyof typeof ARM_SLOTS, arm: number, shoulder: P, release: P, setPos: P, L: number, charge: number, flight: PitchFlight | null, t: number) {
  const sw = SWING[slot], at = ([x, y]: [number, number]) => ({ x: shoulder.x + arm * x * L, y: shoulder.y + y * L })
  const cock = at(sw.cock)
  let hand: P
  if (flight) {
    const k = clamp(t * 3.2, 0, 1), e = 1 - (1 - k) * (1 - k)
    hand = quad(release, at(sw.via), at(sw.finish), e)
    // Swing blur: the path from the cocked position through release to the hand, fading out.
    if (k < .75) {
      ctx.save()
      ctx.globalAlpha = .5 * (1 - k / .75); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = L * .32; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(cock.x, cock.y)
      const mid = { x: (cock.x + release.x) / 2 + arm * L * .25, y: (cock.y + release.y) / 2 }
      for (let i = 1; i <= 8; i++) { const q = quad(cock, mid, release, i / 8); ctx.lineTo(q.x, q.y) }
      for (let i = 1; i <= 12; i++) { const q = quad(release, at(sw.via), at(sw.finish), e * i / 12); ctx.lineTo(q.x, q.y) }
      ctx.stroke(); ctx.restore()
    }
  } else {
    const c = clamp(charge * 2.4, 0, 1), e = c * c * (3 - 2 * c)
    hand = { x: setPos.x + (cock.x - setPos.x) * e, y: setPos.y + (cock.y - setPos.y) * e }
  }
  // Elbow: bends outward from the straight line (shoulder → hand).
  const dx = hand.x - shoulder.x, dy = hand.y - shoulder.y, len = Math.hypot(dx, dy) || 1
  const bendOut = Math.max(0, L * 1.05 - len) * .6
  const elbow = { x: shoulder.x + dx / 2 + (dy / len) * bendOut * arm, y: shoulder.y + dy / 2 - (dx / len) * bendOut * arm }
  ctx.beginPath(); ctx.moveTo(shoulder.x, shoulder.y); ctx.lineTo(elbow.x, elbow.y); ctx.lineTo(hand.x, hand.y); ctx.stroke()
  return hand
}

/* ───────────── Broadcast camera (behind the pitcher) ───────────── */

let broadcastCache: HTMLCanvasElement | null = null
function drawBroadcastScenery(ctx: CanvasRenderingContext2D, now: number) {
  const w = STAGE.width, h = STAGE.height
  if (!broadcastCache) {
    const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2
    const g = c.getContext('2d')!; g.scale(2, 2)
    // Stands behind home plate
    const sky = g.createLinearGradient(0, 0, 0, 100)
    sky.addColorStop(0, '#070b16'); sky.addColorStop(1, '#121b2c')
    g.fillStyle = sky; g.fillRect(0, 0, w, 100)
    for (let row = 0; row < 7; row++) for (let col = 0; col < 60; col++) {
      const x = col * 6.8 + (row % 2) * 3.4 - 4, y = 10 + row * 9.5
      const hue = (col * 41 + row * 83) % 100
      g.fillStyle = hue < 8 ? '#ffb40077' : hue < 14 ? '#22d3ee66' : hue < 22 ? '#f5f8fc44' : '#34435e99'
      g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI * 2); g.fill()
      g.fillRect(x - 2.4, y + 2, 4.8, 3.6)
    }
    // Backstop wall + ad boards
    g.fillStyle = '#0f1d31'; g.fillRect(0, 78, w, 24)
    const ads = ['ACE', 'K-ZONE', '155', 'PITCH LAB', 'ACE']
    g.font = '800 8px system-ui'; g.textAlign = 'center'
    ads.forEach((a, i) => { roundRect(g, i * 80 + 4, 84, 72, 11, 2, i % 2 ? '#0e2c3d' : '#2a2210'); g.fillStyle = i % 2 ? '#22d3eecc' : '#ffb400cc'; g.fillText(a, i * 80 + 40, 92.5) })
    // Grass with mow stripes, widening toward the camera
    const grass = g.createLinearGradient(0, 102, 0, h)
    grass.addColorStop(0, '#16603a'); grass.addColorStop(1, '#1f8049')
    g.fillStyle = grass; g.fillRect(0, 102, w, h - 102)
    for (let i = 0; i < 12; i++) { const y = 102 + Math.pow(i / 12, 1.4) * (h - 102), y2 = 102 + Math.pow((i + 1) / 12, 1.4) * (h - 102); g.fillStyle = i % 2 ? '#ffffff07' : '#00000012'; g.fillRect(0, y, w, y2 - y) }
    // Dirt around home plate
    g.fillStyle = '#7b5d3f'; g.beginPath(); g.ellipse(195, 250, 132, 36, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#8e6d4a'; g.beginPath(); g.ellipse(195, 252, 92, 22, 0, 0, Math.PI * 2); g.fill()
    // Foul lines run from the plate out toward the camera
    g.strokeStyle = '#f3f1e680'; g.lineWidth = 2
    g.beginPath(); g.moveTo(170, 258); g.lineTo(-60, 372); g.moveTo(220, 258); g.lineTo(450, 372); g.stroke()
    // Batter's boxes and the plate (the point faces away from this camera)
    g.strokeStyle = '#f3f1e6aa'; g.lineWidth = 1.6
    g.strokeRect(116, 240, 40, 22); g.strokeRect(234, 240, 40, 22)
    g.fillStyle = '#f2f4ee'; g.beginPath(); g.moveTo(166, 258); g.lineTo(224, 258); g.lineTo(224, 254); g.lineTo(195, 248); g.lineTo(166, 254); g.closePath(); g.fill()
    // Mound in the foreground
    g.fillStyle = '#8a6a48'; g.beginPath(); g.ellipse(195, 452, 210, 72, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#a3825b'; g.beginPath(); g.ellipse(190, 446, 130, 38, 0, 0, Math.PI * 2); g.fill()
    broadcastCache = c
  }
  ctx.drawImage(broadcastCache, 0, 0, w, h)
  for (const x of [26, 364]) {
    const halo = ctx.createRadialGradient(x, 6, 0, x, 6, 80)
    halo.addColorStop(0, `rgba(255,248,220,${.22 + Math.sin(now / 900 + x) * .02})`); halo.addColorStop(1, 'rgba(255,248,220,0)')
    ctx.fillStyle = halo; ctx.fillRect(x - 80, 0, 160, 90)
  }
}

/** Umpire and catcher behind the plate; the catcher sets his mitt at the called target. */
function drawCatcher(ctx: CanvasRenderingContext2D, target: { x: number; y: number }) {
  ctx.save()
  ctx.lineCap = 'round'
  // umpire (behind the catcher)
  ctx.fillStyle = '#1b2436'; ctx.beginPath(); ctx.ellipse(195, 200, 21, 27, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#b89478'; ctx.beginPath(); ctx.arc(195, 166, 10, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#10151f'; ctx.beginPath(); ctx.arc(195, 163, 10.5, Math.PI, 0); ctx.fill(); ctx.fillRect(186, 166, 18, 5)
  // catcher: crouched, chest protector, shin guards
  ctx.strokeStyle = '#27324a'; ctx.lineWidth = 9
  ctx.beginPath(); ctx.moveTo(185, 238); ctx.lineTo(176, 256); ctx.moveTo(205, 238); ctx.lineTo(214, 256); ctx.stroke()
  ctx.fillStyle = '#2e3d5a'; ctx.beginPath(); ctx.ellipse(195, 226, 21, 20, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#3d5078'; ctx.beginPath(); ctx.ellipse(195, 224, 13, 15, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#39465e'; ctx.beginPath(); ctx.arc(195, 199, 10.5, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#9aa6bb'; ctx.lineWidth = 1
  for (const y of [196, 200, 204]) { ctx.beginPath(); ctx.moveTo(189, y); ctx.lineTo(201, y); ctx.stroke() }
  // mitt arm (his glove hand is on screen-right: he faces the camera)
  const mitt = { x: clamp(ZX(target.x), 155, 235), y: clamp(ZY(target.y), 165, 250) }
  ctx.strokeStyle = '#2e3d5a'; ctx.lineWidth = 6
  ctx.beginPath(); ctx.moveTo(207, 214); ctx.lineTo(mitt.x, mitt.y); ctx.stroke()
  ctx.fillStyle = '#7a4f2a'; ctx.beginPath(); ctx.arc(mitt.x, mitt.y, 8, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#5e3b1e'; ctx.beginPath(); ctx.arc(mitt.x, mitt.y, 4.5, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

/** The pitcher seen from behind: name on the jersey, arm slot visible in the delivery. */
function drawPitcherBack(ctx: CanvasRenderingContext2D, profile: PitcherProfile, flight: PitchFlight | null, t: number, charge = 0) {
  // From behind, a righty's throwing arm is on screen-right.
  const arm = profile.hand === 'R' ? 1 : -1
  const slot = ARM_SLOTS[profile.armSlot]
  const release = handLocal({ x: -arm * slot.width, y: slot.releaseY - (profile.height - 185) / 90 })
  const follow = flight ? clamp(t * 4, 0, 1) : 0
  const bend = flight ? { OVERHAND: 0, THREE_QUARTER: .25, SIDEARM: .6, SUBMARINE: 1 }[profile.armSlot] * (1 - follow * .6) : 0
  const lean = -arm * bend * 16, dip = bend * 16
  const X = pitcherX(arm === 1)
  ctx.save()
  // Near the camera: scale the figure up around its feet.
  ctx.translate(X, PITCHER_BASE); ctx.scale(PITCHER_SCALE, PITCHER_SCALE); ctx.translate(-X, -PITCHER_BASE)
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  // rubber
  ctx.fillStyle = '#f1efe4'; ctx.fillRect(X - 22, 436, 44, 4)
  // legs: the glove-side leg strides toward the plate during the delivery
  ctx.strokeStyle = '#e9ecef'; ctx.lineWidth = 13
  ctx.beginPath()
  ctx.moveTo(X - arm * 9 + lean * .3, 392 + dip * .3); ctx.lineTo(X - arm * (14 + follow * 8), 414 - follow * 14); ctx.lineTo(X - arm * (16 + follow * 10), 440 - follow * 22)
  ctx.moveTo(X + arm * 9 + lean * .3, 392 + dip * .3); ctx.lineTo(X + arm * 15, 418); ctx.lineTo(X + arm * 17, 446)
  ctx.stroke()
  // torso: jersey back with the pitcher's name
  const tx = X + lean * .6, ty = 364 + dip * .6
  ctx.save(); ctx.translate(tx, ty); ctx.rotate(-arm * bend * .4 + arm * follow * .12)
  ctx.fillStyle = '#eef1f4'; ctx.beginPath(); ctx.roundRect(-24, -30, 48, 58, 14); ctx.fill()
  ctx.fillStyle = '#1f3a66'; ctx.fillRect(-24, 22, 48, 6)
  ctx.textAlign = 'center'; ctx.fillStyle = '#1f3a66'
  ctx.font = "900 8.5px 'Noto Sans KR', system-ui"; ctx.fillText(profile.name.toUpperCase(), 0, -14, 42)
  ctx.font = "italic 900 22px 'Barlow Condensed', system-ui"; ctx.fillText('1', 0, 10)
  ctx.restore()
  // head from behind: cap and neck
  const hx = X + lean, hy = 318 + dip
  ctx.fillStyle = '#c9a283'; ctx.fillRect(hx - 5, hy + 4, 10, 9)
  ctx.fillStyle = '#1f3a66'; ctx.beginPath(); ctx.arc(hx, hy, 12, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#2b4c80'; ctx.beginPath(); ctx.arc(hx, hy - 2, 3, 0, Math.PI * 2); ctx.fill()
  // glove arm
  const gs = { x: X - arm * 19 + lean * .5, y: 340 + dip * .6 }
  const glove = { x: X - arm * (30 - follow * 16), y: 362 + follow * 12 }
  ctx.strokeStyle = '#e9ecef'; ctx.lineWidth = 8
  ctx.beginPath(); ctx.moveTo(gs.x, gs.y); ctx.lineTo(glove.x, glove.y); ctx.stroke()
  ctx.fillStyle = '#6b4a2b'; ctx.beginPath(); ctx.arc(glove.x, glove.y, 7, 0, Math.PI * 2); ctx.fill()
  // throwing arm: set position → release point of this arm slot → follow-through across the body
  const shoulder = { x: X + arm * 19 + lean * .5, y: 340 + dip * .6 }
  const hand = throwingArm(ctx, profile.armSlot, arm, shoulder, release, { x: X + arm * (22 + slot.width * 12), y: 360 + slot.releaseY * 10 }, 40, charge, flight, t)
  ctx.fillStyle = '#d9b99a'; ctx.beginPath(); ctx.arc(hand.x, hand.y, 4.5, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

/* ───────────── Figures ───────────── */

function drawPitcher(ctx: CanvasRenderingContext2D, profile: PitcherProfile, flight: PitchFlight | null, t: number, charge = 0) {
  // Catcher view: the throwing arm of a righty is on screen-left.
  const arm = profile.hand === 'R' ? -1 : 1
  const slot = ARM_SLOTS[profile.armSlot]
  const release = { x: 195 + arm * slot.width * 28, y: 132 + (slot.releaseY - (profile.height - 185) / 90) * 22 }
  const follow = flight ? clamp(t * 4, 0, 1) : 0
  // Lower slots bend the torso away from the throwing arm (submarine: a deep crouch) at release.
  const bend = flight ? { OVERHAND: 0, THREE_QUARTER: .25, SIDEARM: .6, SUBMARINE: 1 }[profile.armSlot] * (1 - follow * .6) : 0
  const lean = -arm * bend * 6, dip = bend * 8
  ctx.save()
  ctx.lineCap = 'round'; ctx.strokeStyle = '#e9ecef'; ctx.fillStyle = '#e9ecef'
  // legs
  ctx.lineWidth = 5
  ctx.beginPath(); ctx.moveTo(191 + lean * .3, 152 + dip * .3); ctx.lineTo(186 - follow * 4, 171); ctx.moveTo(199 + lean * .3, 152 + dip * .3); ctx.lineTo(205 + follow * 3, 171); ctx.stroke()
  // body
  ctx.beginPath(); ctx.ellipse(195 + lean * .6, 141 + dip * .6, 8.5, 13, arm * follow * .2 - arm * bend * .45, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#1f3a66'; ctx.beginPath(); ctx.ellipse(195 + lean * .4, 145 + dip * .4, 8.5, 5, 0, 0, Math.PI); ctx.fill()
  // head + cap
  const hx = 195 + lean, hy = 124 + dip
  ctx.fillStyle = '#d9b99a'; ctx.beginPath(); ctx.arc(hx, hy, 5.2, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#1f3a66'; ctx.beginPath(); ctx.arc(hx, hy - 1.5, 5.4, Math.PI, 0); ctx.fill(); ctx.fillRect(hx - 4, hy - 2, 8, 1.8)
  // glove arm
  const gx = 195 - arm * 6 + lean * .5, gy = 134 + dip * .6
  ctx.strokeStyle = '#e9ecef'; ctx.lineWidth = 3.6
  ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx - arm * (6 - follow * 6), gy + 6 + follow * 4); ctx.stroke()
  ctx.fillStyle = '#6b4a2b'; ctx.beginPath(); ctx.arc(gx - arm * (6 - follow * 6), gy + 7 + follow * 4, 3.4, 0, Math.PI * 2); ctx.fill()
  // throwing arm: cocked → release point of this arm slot → follow-through
  const shoulder = { x: 195 + arm * 6 + lean * .5, y: 133 + dip * .6 }
  ctx.strokeStyle = '#e9ecef'; ctx.lineWidth = 3.6
  // set position already hints the arm slot
  throwingArm(ctx, profile.armSlot, arm, shoulder, release, { x: 195 + arm * (8 + slot.width * 9), y: 136 + slot.releaseY * 7 }, 18, charge, flight, t)
  ctx.restore()
}

function drawBatter(ctx: CanvasRenderingContext2D, side: Hand, anim: BatterAnim, color: string, now: number) {
  // Umpire view: righties stand screen-left. Broadcast: mirrored, farther away, drawn at the plate's depth.
  const g = view === 'broadcast' ? { x: side === 'R' ? 262 : 128, y: 262, k: .8 } : { x: side === 'R' ? 100 : 290, y: 372, k: 1 }
  const dir = g.x < 195 ? 1 : -1 // direction toward the plate
  const ox = 0, oy = 0
  const since = now - anim.at
  const idleBob = Math.sin(now / 420) * 1.2
  let lean = 0, flinch = 0
  if (anim.kind === 'take') flinch = Math.max(0, 1 - since / 260) * 3
  if (anim.kind === 'hbp') flinch = Math.max(0, 1 - since / 500) * 10 * Math.sin(since / 30)
  ctx.save()
  ctx.translate(g.x, g.y); ctx.scale(g.k, g.k)
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
  const barrel = { x: (ZX(anim.barrel.x) - g.x) / g.k, y: (ZY(anim.barrel.y) - g.y) / g.k }
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
  const left = Math.min(ZX(-1), ZX(1)), top = ZY(-1), w = VIEWS[view].w, h = VIEWS[view].h
  if (scene.heat) {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const v = scene.heat[r][c]
      ctx.fillStyle = v > 0 ? `rgba(255,86,70,${Math.min(.42, v * .5)})` : `rgba(70,140,255,${Math.min(.38, -v * .5)})`
      ctx.fillRect(Math.min(ZX(-1 + c * 2 / 3), ZX(-1 + (c + 1) * 2 / 3)), top + r * h / 3, w / 3, h / 3)
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

/** Ghost markers of the pitches this hitter saw in earlier plate appearances. */
function drawMemory(ctx: CanvasRenderingContext2D, memory: PlateAppearance[]) {
  ctx.save()
  memory.forEach((pa, i) => {
    const alpha = i === memory.length - 1 ? .78 : .42
    pa.pitches.forEach(p => {
      const x = ZX(p.x), y = ZY(p.y), def = PITCHES.find(d => d.id === p.pitch)!
      ctx.globalAlpha = alpha
      ctx.fillStyle = def.color + '40'; ctx.strokeStyle = def.color; ctx.lineWidth = 1.4
      ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 7); ctx.lineTo(x - 7, y); ctx.closePath(); ctx.fill(); ctx.stroke()
      ctx.fillStyle = '#f5f8fc'; ctx.font = '800 7px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(def.short.slice(0, 1), x, y + .5)
      if (p.meatball) { ctx.fillStyle = '#ff4d5e'; ctx.fillText('!', x + 8, y - 7) }
    })
  })
  ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic'
  ctx.restore()
}

/** Pulsing critical-miss warning. */
function drawWarning(ctx: CanvasRenderingContext2D, x: number, y: number, now: number, size = 11) {
  const pulse = 1 + Math.sin(now / 70) * .12
  ctx.save()
  ctx.translate(x, y); ctx.scale(pulse, pulse)
  ctx.shadowColor = '#ff4d5e'; ctx.shadowBlur = 16
  ctx.fillStyle = '#ff4d5e'; ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.fill()
  ctx.shadowBlur = 0; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke()
  ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.round(size * 1.5)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('!', 0, 1)
  ctx.restore()
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
    const a = projectedBall(f, TUNNEL_POINT), b = projectedBall(scene.previousFlight, TUNNEL_POINT)
    const good = scene.tunnel > .35
    ctx.strokeStyle = good ? '#22d3ee' : '#ffffff55'; ctx.lineWidth = good ? 2 : 1
    ctx.setLineDash(good ? [] : [3, 3])
    ctx.beginPath(); ctx.arc((a.x + b.x) / 2, (a.y + b.y) / 2, 9 + Math.hypot(a.x - b.x, a.y - b.y) / 2, 0, Math.PI * 2); ctx.stroke()
    ctx.setLineDash([])
    if (good) {
      ctx.fillStyle = '#22d3ee'; ctx.font = '900 10px system-ui'; ctx.textAlign = 'left'
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
  if (view === 'broadcast') {
    // Fair balls fly out toward the center-field camera (grow), pops and fouls go up and away (shrink).
    const ex = 195 - b.spray * (b.type === 'FOUL' ? 300 : 210)
    const ey = { HR: 580, FLY: 470, LINE: 430, GROUND: 405, POP: 30, FOUL: 120 }[b.type]
    const arc = { HR: 60, FLY: 90, LINE: 12, GROUND: 0, POP: 120, FOUL: 30 }[b.type]
    const grow = { HR: 16, FLY: 11, LINE: 8, GROUND: 5, POP: 0, FOUL: 0 }[b.type]
    const x = sx + (ex - sx) * k, y = sy + (ey - sy) * k - Math.sin(k * Math.PI) * arc
    const r = Math.max(1.5, 3.5 + grow * k * k - (grow ? 0 : 2 * k))
    ctx.fillStyle = '#fffdf4'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 10
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0
    return
  }
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
  ctx.translate(195, view === 'broadcast' ? 96 : 138); ctx.scale(pop, pop)
  ctx.textAlign = 'center'
  ctx.font = `italic 900 ${big ? 44 : 34}px 'Barlow Condensed', system-ui`
  const color = { k: '#ffb400', hr: '#ff4d5e', hit: '#ffcf70', out: '#22d3ee', ball: '#f5f8fc', strike: '#f5f8fc', foul: '#f5f8fc', miss: '#ff4d5e' }[result.tone] ?? '#fff'
  ctx.lineWidth = 7; ctx.strokeStyle = '#05080cdd'; ctx.lineJoin = 'round'
  ctx.strokeText(result.text, 0, 0)
  ctx.fillStyle = color; ctx.fillText(result.text, 0, 0)
  ctx.restore()
}

export function renderScene(ctx: CanvasRenderingContext2D, scene: RenderScene) {
  const { flight, flightProgress: t, now } = scene
  view = scene.view ?? 'umpire'
  ctx.clearRect(0, 0, STAGE.width, STAGE.height)
  ctx.save()
  const impactAge = (now - scene.result.at) / 1000
  const punch = !window.matchMedia('(prefers-reduced-motion: reduce)').matches && scene.result.tone === 'k' ? Math.max(0, 1 - impactAge / 1.2) : 0
  const zoom = 1 + punch * .10
  const V = VIEWS[view]
  ctx.translate(V.cx, V.cy); ctx.scale(zoom, zoom); ctx.translate(-V.cx, -V.cy)
  if (view === 'broadcast') {
    drawBroadcastScenery(ctx, now)
    drawCatcher(ctx, flight ? flight.target : scene.target)
    drawBatter(ctx, scene.batterSide, scene.anim, scene.teamColor, now)
    drawZone(ctx, scene)
    if (scene.memory?.length) drawMemory(ctx, scene.memory)
    drawLog(ctx, scene.log, Boolean(flight))
    if (!flight && scene.previewFlight) drawPreview(ctx, scene)
    if (!flight) drawCrosshair(ctx, scene)
    // The pitcher is closest to the camera; the ball leaves his hand and flies away from us.
    drawPitcherBack(ctx, scene.profile, flight, t, scene.charge)
    if (flight && t <= 1) drawBall(ctx, flight, t)
    if (flight?.meatball && t <= 1) { const h = broadcastHand(flight.release); drawWarning(ctx, h.x, h.y - 18, now); drawWarning(ctx, ZX(flight.target.x), ZY(flight.target.y) - 16, now, 7) }
  } else {
    drawScenery(ctx, now)
    drawPitcher(ctx, scene.profile, flight, t, scene.charge)
    drawZone(ctx, scene)
    if (scene.memory?.length) drawMemory(ctx, scene.memory)
    drawLog(ctx, scene.log, Boolean(flight))
    if (!flight && scene.previewFlight) drawPreview(ctx, scene)
    if (!flight) drawCrosshair(ctx, scene)
    // The batter stands in front of the zone plane; the ball passes in front of him near the plate.
    drawBatter(ctx, scene.batterSide, scene.anim, scene.teamColor, now)
    if (flight && t <= 1) drawBall(ctx, flight, t)
    if (flight?.meatball && t <= 1) { drawWarning(ctx, 195, 104, now); drawWarning(ctx, ZX(flight.target.x), ZY(flight.target.y) - 20, now, 8) }
  }
  if (scene.batted) drawBatted(ctx, scene.batted, now)
  if (punch > 0) {
    ctx.strokeStyle = `rgba(255,180,0,${punch})`; ctx.lineWidth = 2 + punch * 3
    ctx.strokeRect(Math.min(ZX(-1), ZX(1)), ZY(-1), V.w, V.h)
    ctx.beginPath(); ctx.arc(V.cx, V.cy, 20 + impactAge * 90, 0, Math.PI * 2); ctx.stroke()
  }
  ctx.restore()
  drawResult(ctx, scene.result, now)
}
