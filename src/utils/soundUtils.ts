export function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const play = (freq: number, startAt: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.4, ctx.currentTime + startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + 0.25);
      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + startAt + 0.25);
    };
    play(880, 0);
    play(1100, 0.15);
  } catch {
    // silently ignore — AudioContext blocked before user gesture
  }
}
