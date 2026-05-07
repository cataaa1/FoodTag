type BeepPattern = Array<{
  start: number;
  frequency: number;
  duration: number;
  volume: number;
}>;

const BEEP_PATTERNS: Record<string, BeepPattern> = {
  classic: [
    { start: 0, frequency: 880, duration: 0.13, volume: 0.32 },
    { start: 0.18, frequency: 1320, duration: 0.13, volume: 0.32 },
    { start: 0.42, frequency: 880, duration: 0.13, volume: 0.32 },
    { start: 0.6, frequency: 1320, duration: 0.13, volume: 0.32 },
    { start: 0.95, frequency: 1040, duration: 0.13, volume: 0.32 },
    { start: 1.13, frequency: 1560, duration: 0.13, volume: 0.32 },
    { start: 1.37, frequency: 1040, duration: 0.13, volume: 0.32 },
    { start: 1.55, frequency: 1560, duration: 0.13, volume: 0.32 },
  ],
  soft: [
    { start: 0, frequency: 740, duration: 0.2, volume: 0.18 },
    { start: 0.28, frequency: 932, duration: 0.2, volume: 0.18 },
    { start: 0.7, frequency: 740, duration: 0.22, volume: 0.18 },
  ],
  marcado: [
    { start: 0, frequency: 988, duration: 0.1, volume: 0.34 },
    { start: 0.16, frequency: 988, duration: 0.1, volume: 0.34 },
    { start: 0.32, frequency: 988, duration: 0.1, volume: 0.34 },
    { start: 0.7, frequency: 1318, duration: 0.16, volume: 0.28 },
    { start: 1.02, frequency: 1318, duration: 0.16, volume: 0.28 },
  ],
} satisfies Record<string, BeepPattern>;

export const CUSTOM_SOUND_STORAGE_KEY = "beeper-custom-sound-v1";

export function playBeeperSound(soundId: string) {
  try {
    if (soundId === "custom") {
      const dataUrl = typeof localStorage !== "undefined"
        ? localStorage.getItem(CUSTOM_SOUND_STORAGE_KEY)
        : null;
      if (dataUrl) {
        const audio = new Audio(dataUrl);
        audio.volume = 0.8;
        void audio.play();
        return;
      }
      // Fall through to classic if no custom sound stored
    }

    const audio = new AudioContext();
    const defaultPattern = BEEP_PATTERNS.classic;
    const pattern = (BEEP_PATTERNS[soundId] ?? defaultPattern) as BeepPattern;

    pattern.forEach((beep) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const startAt = audio.currentTime + beep.start;
      const endAt = startAt + beep.duration;

      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(beep.frequency, startAt);
      gain.gain.setValueAtTime(0.001, startAt);
      gain.gain.exponentialRampToValueAtTime(beep.volume, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, endAt);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(startAt);
      oscillator.stop(endAt);
    });

    window.setTimeout(() => void audio.close(), 2_200);
  } catch {
    // Browsers can block autoplay until the first user gesture.
  }
}
