export type SoundType = 'chime' | 'bell' | 'ping';

export const SOUND_OPTIONS: { value: SoundType; label: string; description: string }[] = [
  { value: 'chime', label: 'Chime', description: 'Two ascending tones' },
  { value: 'bell', label: 'Bell', description: 'Warm single doorbell' },
  { value: 'ping', label: 'Ping', description: 'Three quick beeps' },
];

const STORAGE_KEY = 'notification-sound-type';

export function getSoundPreference(): SoundType {
  if (typeof window === 'undefined') return 'chime';
  return (localStorage.getItem(STORAGE_KEY) as SoundType) ?? 'chime';
}

export function setSoundPreference(type: SoundType) {
  localStorage.setItem(STORAGE_KEY, type);
}

// Singleton AudioContext — created once, unlocked on first user gesture for iOS
let _ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_ctx) _ctx = new AudioContext();
  // iOS starts contexts suspended; resume is a no-op on already-running contexts
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

// Call this on any user interaction (e.g. a click on the page) to unlock audio on iOS
export function unlockAudio() {
  getContext();
}

export function playNotificationSound(type?: SoundType) {
  try {
    const ctx = getContext();
    if (!ctx) return;

    const tone = type ?? getSoundPreference();

    const playTone = (freq: number, startAt: number, duration: number, volume = 0.4) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(volume, ctx.currentTime + startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration);
      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + startAt + duration);
    };

    const play = (offset: number) => {
      if (tone === 'chime') {
        playTone(880, offset, 0.25);
        playTone(1100, offset + 0.15, 0.25);
      } else if (tone === 'bell') {
        playTone(523, offset, 0.6);
        playTone(1046, offset + 0.05, 0.5, 0.25);
      } else if (tone === 'ping') {
        playTone(660, offset, 0.1);
        playTone(660, offset + 0.12, 0.1);
        playTone(880, offset + 0.24, 0.15);
      }
    };

    play(0);
    play(0.7);
  } catch {
    // silently ignore
  }
}
