let audio: AudioContext | null = null
function tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0) {
  audio ??= new AudioContext()
  const t = audio.currentTime + delay
  const osc = audio.createOscillator(), gain = audio.createGain()
  osc.type = type; osc.frequency.setValueAtTime(freq, t)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(vol, t + .01); gain.gain.exponentialRampToValueAtTime(.0001, t + dur)
  osc.connect(gain); gain.connect(audio.destination); osc.start(t); osc.stop(t + dur + .02); osc.onended = () => { osc.disconnect(); gain.disconnect() }
}
function noise(dur: number, vol: number, delay = 0) {
  audio ??= new AudioContext()
  const t = audio.currentTime + delay
  const buf = audio.createBuffer(1, Math.floor(audio.sampleRate * dur), audio.sampleRate)
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
  const src = audio.createBufferSource(), gain = audio.createGain(), filter = audio.createBiquadFilter()
  filter.type = 'bandpass'; filter.frequency.value = 900; src.buffer = buf
  gain.gain.value = vol; src.connect(filter); filter.connect(gain); gain.connect(audio.destination); src.start(t); src.onended = () => { src.disconnect(); filter.disconnect(); gain.disconnect() }
}
type Sfx = 'release' | 'mitt' | 'pop' | 'bat' | 'crack' | 'whiff' | 'cheer' | 'ui' | 'k'
export function sfx(kind: Sfx, on: boolean, speed = 140) {
  if (!on) return
  try {
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

export function disposeAudio() { void audio?.close(); audio = null }
