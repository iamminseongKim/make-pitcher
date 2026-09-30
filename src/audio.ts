let audio: AudioContext | null = null
/** Effects bus: every synth tone and sample goes through this gain (효과음 볼륨). */
let sfxBus: GainNode | null = null
let sfxLevel = .8
function ctx() {
  audio ??= new AudioContext()
  if (!sfxBus) { sfxBus = audio.createGain(); sfxBus.gain.value = sfxLevel; sfxBus.connect(audio.destination) }
  return audio
}
const out = () => { ctx(); return sfxBus! }

/* ───────── Recorded samples (public/audio, ~76KB total) with the synth as fallback ───────── */
const SAMPLES = { whoosh: 'whoosh', catch: 'catch', hit: 'hit', crowd: 'crowd', levelup: 'levelup' } as const
type Sample = keyof typeof SAMPLES
const buffers: Partial<Record<Sample, AudioBuffer>> = {}
let loading = false
/** Starts fetching samples on the first sound (after a user gesture); until then the synth plays. */
function load() {
  if (loading || !audio) return
  loading = true
  const ctx = audio as AudioContext
  for (const key of Object.keys(SAMPLES) as Sample[]) {
    fetch(`/audio/${SAMPLES[key]}.mp3`).then(r => r.ok ? r.arrayBuffer() : Promise.reject()).then(b => ctx.decodeAudioData(b)).then(buf => { if (audio === ctx) buffers[key] = buf }).catch(() => { /* synth fallback */ })
  }
}
function sample(key: Sample, vol: number, rate = 1, delay = 0) {
  const buf = buffers[key]
  if (!audio || !buf) return false
  const src = audio.createBufferSource(), gain = audio.createGain()
  src.buffer = buf; src.playbackRate.value = rate; gain.gain.value = vol
  src.connect(gain); gain.connect(out()); src.start(audio.currentTime + delay)
  src.onended = () => { src.disconnect(); gain.disconnect() }
  return true
}
function tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0) {
  const audio = ctx()
  const t = audio.currentTime + delay
  const osc = audio.createOscillator(), gain = audio.createGain()
  osc.type = type; osc.frequency.setValueAtTime(freq, t)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(vol, t + .01); gain.gain.exponentialRampToValueAtTime(.0001, t + dur)
  osc.connect(gain); gain.connect(out()); osc.start(t); osc.stop(t + dur + .02); osc.onended = () => { osc.disconnect(); gain.disconnect() }
}
function noise(dur: number, vol: number, delay = 0) {
  const audio = ctx()
  const t = audio.currentTime + delay
  const buf = audio.createBuffer(1, Math.floor(audio.sampleRate * dur), audio.sampleRate)
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
  const src = audio.createBufferSource(), gain = audio.createGain(), filter = audio.createBiquadFilter()
  filter.type = 'bandpass'; filter.frequency.value = 900; src.buffer = buf
  gain.gain.value = vol; src.connect(filter); filter.connect(gain); gain.connect(out()); src.start(t); src.onended = () => { src.disconnect(); filter.disconnect(); gain.disconnect() }
}
type Sfx = 'release' | 'mitt' | 'pop' | 'bat' | 'crack' | 'whiff' | 'cheer' | 'ui' | 'k' | 'levelup'
export function sfx(kind: Sfx, on: boolean, speed = 140) {
  if (!on) return
  try {
    ctx()
    if (audio!.state === 'suspended') void audio!.resume()
    load()
    // Faster pitches whoosh higher and shorter.
    if (kind === 'release' && sample('whoosh', .55, Math.max(.85, Math.min(1.2, .6 + speed / 350)))) return
    if (kind === 'mitt' && sample('catch', .7)) return
    if (kind === 'pop' && sample('catch', 1, 1.12)) { noise(.04, .2); return }
    if (kind === 'crack' && sample('hit', .8)) return
    if (kind === 'cheer' && sample('crowd', .45)) return
    if (kind === 'levelup' && sample('levelup', .5)) return
    if (kind === 'levelup') { tone(660, .09, 'triangle', .07); tone(990, .14, 'triangle', .07, undefined, .08); return }
    if (kind === 'release') tone(220 + speed * 2, .22, 'sawtooth', .025, 100 + speed)
    if (kind === 'mitt') { tone(95, .09, 'square', .1, 45); noise(.05, .25) }
    if (kind === 'pop') { tone(150, .07, 'square', .14, 50); noise(.06, .45) }
    if (kind === 'whiff') noise(.18, .12)
    if (kind === 'bat') { tone(420, .06, 'triangle', .12, 180); noise(.05, .3) }
    if (kind === 'crack') { tone(900, .05, 'square', .12, 300); noise(.09, .7) }
    if (kind === 'cheer') { for (let i = 0; i < 6; i++) noise(.5, .06, i * .08) }
    if (kind === 'k') { tone(660, .09, 'triangle', .07); tone(880, .12, 'triangle', .07, undefined, .09) }
    if (kind === 'ui') tone(540, .05, 'triangle', .05)
  } catch { /* Audio is optional. */ }
}

/* ───────── Background music: 3-track shuffle playlist (streamed — not decoded into memory) ───────── */
const BGM_TRACKS = ['/audio/bgm.mp3', '/audio/bgm2.mp3', '/audio/bgm3.mp3']
let bgmBag: number[] = []
let bgmLast = -1
/** Shuffle-bag: every track once per round, never the same track twice in a row. */
function nextBgm() {
  if (!bgmBag.length) {
    bgmBag = BGM_TRACKS.map((_, i) => i)
    for (let i = bgmBag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bgmBag[i], bgmBag[j]] = [bgmBag[j], bgmBag[i]] }
    if (bgmBag[0] === bgmLast && bgmBag.length > 1) [bgmBag[0], bgmBag[1]] = [bgmBag[1], bgmBag[0]]
  }
  bgmLast = bgmBag.shift()!
  return BGM_TRACKS[bgmLast]
}
let bgmWanted = false
let bgmLevel = .5
let bgmEl: HTMLAudioElement | null = null
let bgmGain: GainNode | null = null
let fading = false
const BGM_FADE = 1.6
function bgmTarget() { return bgmWanted && document.visibilityState !== 'hidden' ? bgmLevel : 0 }
function ramp(to: number, seconds = .5) {
  if (!audio || !bgmGain) return
  bgmGain.gain.cancelScheduledValues(audio.currentTime)
  bgmGain.gain.setTargetAtTime(to, audio.currentTime, seconds / 3)
}
function ensureBgm() {
  if (bgmEl) return
  const c = ctx()
  bgmEl = new Audio(nextBgm())
  bgmEl.preload = 'auto'
  // Route through Web Audio so volume works on iOS too (HTMLMediaElement.volume is read-only there).
  bgmGain = c.createGain(); bgmGain.gain.value = 0
  c.createMediaElementSource(bgmEl).connect(bgmGain); bgmGain.connect(c.destination)
  // Fade out over the last seconds, switch to the next track, fade back in.
  bgmEl.addEventListener('timeupdate', () => {
    if (!bgmEl || fading || !bgmEl.duration) return
    if (bgmEl.duration - bgmEl.currentTime < BGM_FADE) { fading = true; ramp(0, BGM_FADE) }
  })
  bgmEl.addEventListener('ended', () => { if (!bgmEl) return; fading = false; bgmEl.src = nextBgm(); void bgmEl.play().catch(() => {}); ramp(bgmTarget(), 1.2) })
}
/** Browsers block audio until a tap: retry on the first gesture. */
let unlockArmed = false
function armUnlock() {
  if (unlockArmed) return
  unlockArmed = true
  const go = () => { unlockArmed = false; window.removeEventListener('pointerdown', go); window.removeEventListener('keydown', go); syncBgm() }
  window.addEventListener('pointerdown', go, { once: true }); window.addEventListener('keydown', go, { once: true })
}
function syncBgm() {
  try {
    if (!bgmWanted || bgmLevel <= 0) { if (bgmEl && !bgmEl.paused) { ramp(0, .4); const el = bgmEl; window.setTimeout(() => { if (!bgmWanted || bgmLevel <= 0) el.pause() }, 450) } return }
    ensureBgm()
    if (audio!.state === 'suspended') void audio!.resume().catch(() => {})
    if (document.visibilityState === 'hidden') { ramp(0, .3); return }
    if (bgmEl!.paused) bgmEl!.play().then(() => ramp(bgmTarget(), 1.5)).catch(() => armUnlock())
    else if (!fading) ramp(bgmTarget(), .3)
    if (audio!.state !== 'running') armUnlock()
  } catch { /* audio optional */ }
}
/** Turn the soundtrack on/off (0 volume also stops it). */
export function setBgm(on: boolean) { bgmWanted = on; syncBgm() }
/** 0…1 for background music and effects (설정의 볼륨 슬라이더). */
export function setVolumes(bgm: number, fx: number) {
  bgmLevel = Math.max(0, Math.min(1, bgm)) * .6 // the track is mastered loud (≈ -16 LUFS); 100% sits under the effects
  sfxLevel = Math.max(0, Math.min(1, fx))
  if (sfxBus && audio) sfxBus.gain.setTargetAtTime(sfxLevel, audio.currentTime, .05)
  syncBgm()
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
  if (!bgmEl) return
  if (document.visibilityState === 'hidden') { ramp(0, .2); window.setTimeout(() => { if (document.visibilityState === 'hidden') bgmEl?.pause() }, 250) }
  else syncBgm()
})

export function disposeAudio() {
  bgmEl?.pause(); bgmEl = null; bgmGain = null; fading = false
  void audio?.close(); audio = null; sfxBus = null; loading = false
  for (const k of Object.keys(buffers) as Sample[]) delete buffers[k]
}
