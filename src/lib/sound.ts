/** A short beep. Sound is optional; callers always show a visual alert too. */
export function playBeep(durationSeconds = 0.8, frequency = 880): void {
  try {
    const AudioCtx = window.AudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSeconds);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationSeconds);
    osc.onended = () => void ctx.close();
  } catch {
    // Audio blocked or unsupported.
  }
}
