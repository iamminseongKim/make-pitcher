import { ARM_SLOTS, clamp, dispersion, pointOnFlight, type PitchFlight, type PitcherProfile } from './game'

export const STAGE = { width: 390, height: 432, zoneX: 195, zoneY: 228, zoneW: 124, zoneH: 136 }

interface RenderScene {
  profile: PitcherProfile
  target: { x: number; y: number }
  flight: PitchFlight | null
  previousFlight: PitchFlight | null
  previewFlight: PitchFlight | null
  flightProgress: number
  showZone: boolean
  result: string
  resultAt: number
  now: number
  batterSwings: boolean
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fill()
}

function drawBatter(ctx: CanvasRenderingContext2D, now: number, active: boolean, hand: string) {
  const swing = active ? Math.sin(now / 100) * .25 : Math.sin(now / 550) * .025
  ctx.save()
  ctx.translate(hand === 'R' ? 278 : 91, 224)
  if (hand === 'L') ctx.scale(-1, 1)
  ctx.rotate(swing)
  ctx.fillStyle = '#0a1720'
  ctx.strokeStyle = '#172b37'
  ctx.lineWidth = 12
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(-10, 42); ctx.lineTo(-20, 83); ctx.moveTo(11, 42); ctx.lineTo(26, 83); ctx.stroke()
  ctx.beginPath(); ctx.ellipse(0, 9, 20, 36, -.08, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(0, -33, 13, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#233d4a'; ctx.beginPath(); ctx.ellipse(-1, -39, 16, 6, -.1, Math.PI, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#152c38'; ctx.lineWidth = 9
  ctx.beginPath(); ctx.moveTo(-13, -3); ctx.lineTo(-31, 12); ctx.moveTo(12, -3); ctx.lineTo(23, 11); ctx.stroke()
  ctx.strokeStyle = '#93a8a5'; ctx.lineWidth = 5
  ctx.beginPath(); ctx.moveTo(19, 10); ctx.lineTo(36 + swing * 15, -70); ctx.stroke()
  ctx.restore()
}

function drawPitcher(ctx: CanvasRenderingContext2D, profile: PitcherProfile) {
  const side = profile.hand === 'R' ? 1 : -1
  const slot = ARM_SLOTS[profile.armSlot]
  const releaseX = 195 + side * slot.width * 90
  const releaseY = 120 + (slot.releaseY - (profile.height - 185) / 90) * 60
  ctx.save()
  ctx.strokeStyle = '#0a1d24'; ctx.fillStyle = '#0b2028'; ctx.lineCap = 'round'
  ctx.lineWidth = 9
  ctx.beginPath(); ctx.moveTo(187, 148); ctx.lineTo(178, 169); ctx.moveTo(202, 148); ctx.lineTo(211, 169); ctx.stroke()
  ctx.beginPath(); ctx.ellipse(195, 131, 15, 25, 0, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(195, 102, 9, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#1e3940'; ctx.fillRect(185, 94, 20, 5)
  ctx.lineWidth = 6
  ctx.beginPath(); ctx.moveTo(195 + side * 11, 122); ctx.lineTo(releaseX, releaseY); ctx.stroke()
  ctx.fillStyle = '#e5ecdf'; ctx.beginPath(); ctx.arc(releaseX, releaseY, 2.7, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

export function projectedBall(f: PitchFlight, t: number) {
  const p = pointOnFlight(f, t)
  return {
    x: 195 + p.x * (90 - 28 * t),
    y: 120 + 108 * t + p.y * (60 + 8 * t),
    radius: 3 + 10 * Math.pow(t, 1.6),
  }
}

function drawTrajectory(ctx: CanvasRenderingContext2D, flight: PitchFlight, progress: number, finished: boolean) {
  const end = clamp(progress, 0, 1)
  if (end <= 0) return
  const release = projectedBall(flight, 0)
  const finish = projectedBall(flight, 1)
  ctx.save()
  ctx.globalAlpha = finished ? .67 : .32
  ctx.setLineDash([3, 5]); ctx.strokeStyle = '#e6f6e3'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(release.x, release.y); ctx.lineTo(finish.x, finish.y); ctx.stroke()
  ctx.setLineDash([]); ctx.globalAlpha = finished ? .95 : 1
  ctx.shadowColor = flight.pitch.color; ctx.shadowBlur = finished ? 10 : 15
  ctx.strokeStyle = flight.pitch.color; ctx.lineWidth = finished ? 3 : 3.7
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  ctx.beginPath()
  for (let i = 0; i <= 64; i++) {
    const t = end * i / 64
    const p = projectedBall(flight, t)
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y)
  }
  ctx.stroke(); ctx.shadowBlur = 0
  for (let i = 1; i <= 4; i++) {
    const markerT = i / 4
    if (markerT > end) break
    const marker = projectedBall(flight, markerT)
    ctx.fillStyle = '#edf9ed'; ctx.beginPath(); ctx.arc(marker.x, marker.y, i === 4 ? 4 : 2, 0, Math.PI * 2); ctx.fill()
  }
  if (finished) {
    const labelX = clamp(finish.x + 13, 13, 255)
    const labelY = clamp(finish.y + 13, 41, 385)
    roundRect(ctx, labelX, labelY, 116, 25, 5, '#0b1d25d9')
    ctx.fillStyle = flight.pitch.color; ctx.font = '800 11px system-ui'
    ctx.fillText(`${flight.pitch.short}  ${flight.speed.toFixed(1)} km/h`, labelX + 7, labelY + 17)
  }
  ctx.restore()
}

function drawPreviewTrajectory(ctx: CanvasRenderingContext2D, flight: PitchFlight) {
  const spread = dispersion(flight.control) * .55
  const lanes = [-spread, 0, spread]
  ctx.save()
  for (const lane of lanes) {
    const variant = lane === 0 ? flight : { ...flight, landing: { x: flight.landing.x + lane, y: flight.landing.y + Math.abs(lane) * .22 } }
    ctx.beginPath()
    for (let i = 0; i <= 50; i++) {
      const p = projectedBall(variant, i / 50)
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y)
    }
    ctx.strokeStyle = lane === 0 ? flight.pitch.color : `${flight.pitch.color}70`
    ctx.lineWidth = lane === 0 ? 2.6 : 1.4
    if (lane !== 0) ctx.setLineDash([4, 5]); else ctx.setLineDash([])
    ctx.stroke()
  }
  const pivot = projectedBall(flight, .76)
  const dx = flight.movement.x * 62
  const dy = flight.movement.y * 68
  const magnitude = Math.hypot(dx, dy) || 1
  const length = 10 + Math.min(13, magnitude * .25)
  const ux = dx / magnitude, uy = dy / magnitude
  const ax = pivot.x + ux * length, ay = pivot.y + uy * length
  ctx.setLineDash([]); ctx.strokeStyle = flight.pitch.color; ctx.lineWidth = 1.7
  ctx.beginPath(); ctx.moveTo(pivot.x, pivot.y); ctx.lineTo(ax, ay)
  ctx.moveTo(ax, ay); ctx.lineTo(ax - ux * 5 - uy * 4, ay - uy * 5 + ux * 4)
  ctx.moveTo(ax, ay); ctx.lineTo(ax - ux * 5 + uy * 4, ay - uy * 5 - ux * 4)
  ctx.stroke()
  ctx.restore()
}

export function renderScene(ctx: CanvasRenderingContext2D, scene: RenderScene) {
  const { profile, target, flight, flightProgress: t, now } = scene
  const w = STAGE.width, h = STAGE.height
  ctx.clearRect(0, 0, w, h)

  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#07151f'); sky.addColorStop(.56, '#12343b'); sky.addColorStop(1, '#0b161a')
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h)
  const glow = ctx.createRadialGradient(195, 155, 10, 195, 170, 230)
  glow.addColorStop(0, '#4f9e8830'); glow.addColorStop(1, '#4f9e8800')
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h)

  // Stadium lights and the crowd sit behind the batter and plate.
  for (let side = 0; side < 2; side++) {
    const x = side ? 346 : 44
    ctx.strokeStyle = '#315161'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(x, 15); ctx.lineTo(x, 150); ctx.stroke()
    roundRect(ctx, x - 24, 13, 48, 10, 2, '#b4e9d891')
    const halo = ctx.createRadialGradient(x, 18, 0, x, 18, 80)
    halo.addColorStop(0, '#a6ffe334'); halo.addColorStop(1, '#a6ffe300')
    ctx.fillStyle = halo; ctx.fillRect(x - 80, 0, 160, 100)
  }
  roundRect(ctx, 0, 65, w, 62, 0, '#0a242b')
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 42; col++) {
      const x = col * 10 + ((row % 2) * 5) - 12
      const y = 72 + row * 11
      const bright = (col * 17 + row * 13) % 11 < 2
      ctx.fillStyle = bright ? '#8db3a95c' : '#47727761'
      ctx.beginPath(); ctx.arc(x, y, bright ? 2.2 : 1.5, 0, Math.PI * 2); ctx.fill()
    }
  }
  ctx.fillStyle = '#0d2c29'; ctx.fillRect(0, 127, w, 167)
  ctx.fillStyle = '#183f35'; ctx.fillRect(0, 294, w, 27)
  ctx.fillStyle = '#6c5c43'; ctx.beginPath(); ctx.ellipse(195, 170, 68, 16, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#725a42'; ctx.beginPath(); ctx.ellipse(195, 346, 150, 52, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#8b7151'; ctx.beginPath(); ctx.ellipse(195, 347, 92, 26, 0, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#e9e7d0a0'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(140, 346); ctx.moveTo(390, 300); ctx.lineTo(250, 346); ctx.stroke()

  const zoneLeft = STAGE.zoneX - STAGE.zoneW / 2
  const zoneTop = STAGE.zoneY - STAGE.zoneH / 2
  const batterActive = Boolean(flight && scene.batterSwings && t > .64 && t < 1)
  drawPitcher(ctx, profile)
  drawBatter(ctx, now, batterActive, profile.hand)

  // Strike zone is a 3x3 grid, with the center line at plate height.
  ctx.fillStyle = '#c2ffeb0b'; ctx.fillRect(zoneLeft, zoneTop, STAGE.zoneW, STAGE.zoneH)
  if (scene.showZone) {
    ctx.strokeStyle = '#b8efd2ab'; ctx.lineWidth = 1.4
    ctx.strokeRect(zoneLeft, zoneTop, STAGE.zoneW, STAGE.zoneH)
    ctx.strokeStyle = '#b8efd23d'; ctx.lineWidth = 1
    for (let i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(zoneLeft + i * STAGE.zoneW / 3, zoneTop); ctx.lineTo(zoneLeft + i * STAGE.zoneW / 3, zoneTop + STAGE.zoneH); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(zoneLeft, zoneTop + i * STAGE.zoneH / 3); ctx.lineTo(zoneLeft + STAGE.zoneW, zoneTop + i * STAGE.zoneH / 3); ctx.stroke()
    }
  }

  // Home plate anchors the perspective under the zone.
  ctx.fillStyle = '#d6e5d3'; ctx.beginPath(); ctx.moveTo(166, 322); ctx.lineTo(224, 322); ctx.lineTo(220, 331); ctx.lineTo(195, 345); ctx.lineTo(170, 331); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#081219'; ctx.font = '700 9px system-ui'; ctx.letterSpacing = '2px'
  ctx.fillText('STRIKE ZONE', zoneLeft + 5, zoneTop - 11)

  if (scene.previewFlight && !flight) drawPreviewTrajectory(ctx, scene.previewFlight)
  if (scene.previousFlight && !flight) drawTrajectory(ctx, scene.previousFlight, 1, true)
  if (flight) drawTrajectory(ctx, flight, t, false)

  if (!flight) {
    const tx = 195 + target.x * 62, ty = 228 + target.y * 68
    const controlError = scene.previewFlight ? dispersion(scene.previewFlight.control) : .76
    const radius = 6 + controlError * 42
    const wobble = controlError * 9
    const wx = tx + Math.sin(now / 270) * wobble
    const wy = ty + Math.cos(now / 310) * wobble * .7
    ctx.fillStyle = '#e7f2ec12'; ctx.beginPath(); ctx.arc(tx, ty, radius, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#e7f2ec8a'; ctx.lineWidth = 1.3; ctx.setLineDash([4, 4])
    ctx.beginPath(); ctx.arc(tx, ty, radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([])
    ctx.strokeStyle = scene.previewFlight?.pitch.color ?? '#ff8076'; ctx.lineWidth = 1.6
    ctx.beginPath(); ctx.arc(wx, wy, 10, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(wx - 16, wy); ctx.lineTo(wx - 7, wy); ctx.moveTo(wx + 7, wy); ctx.lineTo(wx + 16, wy); ctx.moveTo(wx, wy - 16); ctx.lineTo(wx, wy - 7); ctx.moveTo(wx, wy + 7); ctx.lineTo(wx, wy + 16); ctx.stroke()
    ctx.fillStyle = '#fff5e8'; ctx.beginPath(); ctx.arc(wx, wy, 3.2, 0, Math.PI * 2); ctx.fill()
  }

  if (flight && t <= 1) {
    const speedPower = clamp((flight.speed - 130) / 40, 0, 1)
    for (let i = 13; i >= 1; i--) {
      const tt = clamp(t - i * (.008 + speedPower * .002), 0, 1)
      const p = projectedBall(flight, tt)
      ctx.fillStyle = flight.pitch.color + Math.round((1 - i / 14) * (speedPower > .5 ? 70 : 28)).toString(16).padStart(2, '0')
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius * (1 - i / 17), 0, Math.PI * 2); ctx.fill()
    }
    const ball = projectedBall(flight, t)
    if (flight.speed >= 160 && t > .55) {
      ctx.strokeStyle = '#86ecff9a'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.ellipse(ball.x, ball.y, ball.radius * 2.3, ball.radius * 1.35, -.2, 0, Math.PI * 2); ctx.stroke()
    }
    ctx.shadowColor = flight.pitch.color; ctx.shadowBlur = 16 + speedPower * 14
    ctx.fillStyle = '#fff9e6'; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = '#d4524b'; ctx.lineWidth = Math.max(.7, ball.radius * .13)
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius * .66, -.78, .8); ctx.stroke()
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius * .66, 2.3, 3.9); ctx.stroke()
  }

  if (scene.result && now - scene.resultAt < 760) {
    const elapsed = now - scene.resultAt
    const alpha = clamp(1 - Math.max(0, elapsed - 430) / 330, 0, 1)
    ctx.globalAlpha = alpha
    ctx.textAlign = 'center'
    ctx.shadowColor = '#000'; ctx.shadowBlur = 20
    ctx.fillStyle = scene.result.includes('삼진') ? '#e5ff9e' : '#f4fbf4'
    ctx.font = `900 ${scene.result.includes('삼진') ? 35 : 30}px system-ui`
    ctx.fillText(scene.result, 195, 119 - Math.sin(elapsed / 760 * Math.PI) * 12)
    ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.textAlign = 'start'
  }

}
