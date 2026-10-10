import type { Playback, PlaybackEventHandlers } from "./playback";
import { createSpessaSynthPlaybackAsync } from "./spessasynth_playback";

/** 再生方式に依存しない画面コントロール。 */
class Player implements Playback {
  private readonly resumeElement = document.querySelector<HTMLButtonElement>("#resume")!;
  private readonly statusElement = document.querySelector<HTMLElement>("#player-status")!;
  private readonly currentTimeElement = document.querySelector<HTMLElement>("[data-role='current-time']")!;
  private readonly durationElement = document.querySelector<HTMLElement>("[data-role='duration']")!;
  private readonly playback: Playback;
  private readonly intervalTimer: number;
  private disposed = false;

  private readonly handleResumeClick = () => {
    this.togglePlaybackAsync().catch((error) => {
      if (this.disposed) return;
      console.error(error);
      this.statusElement.textContent = "Playback failed. Try again.";
      this.statusElement.setAttribute("role", "alert");
      this.resumeElement.disabled = false;
    });
  };

  constructor(playback: Playback) {
    this.playback = playback;
    this.intervalTimer = window.setInterval(() => this.updateTime(), 100);
    this.resumeElement.addEventListener("click", this.handleResumeClick);
    this.updateTime();
    this.resumeElement.disabled = false;
    this.statusElement.textContent = "Ready";
  }

  get currentTime(): number { return this.playback.currentTime; }
  get duration(): number { return this.playback.duration; }
  get paused(): boolean { return this.playback.paused; }

  async play(): Promise<void> {
    if (this.disposed) return;
    this.resumeElement.disabled = true;
    this.statusElement.setAttribute("role", "status");
    this.statusElement.textContent = "Starting audio…";
    try {
      await this.playback.play();
      if (this.disposed) return;
      this.resumeElement.textContent = "Pause";
      this.resumeElement.setAttribute("aria-pressed", "true");
      this.statusElement.textContent = "Playing";
    } finally {
      if (!this.disposed) this.resumeElement.disabled = false;
    }
  }

  pause(): void {
    if (this.disposed) return;
    this.playback.pause();
    this.resumeElement.textContent = "Play";
    this.resumeElement.setAttribute("aria-pressed", "false");
    this.statusElement.textContent = "Paused";
  }

  private async togglePlaybackAsync() {
    if (this.paused) await this.play();
    else this.pause();
  }

  private updateTime() {
    this.currentTimeElement.textContent = this.currentTime.toFixed(2);
    this.durationElement.textContent = this.duration.toFixed(2);
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.resumeElement.removeEventListener("click", this.handleResumeClick);
    clearInterval(this.intervalTimer);
    this.resumeElement.disabled = true;
    this.resumeElement.setAttribute("aria-pressed", "false");
    await this.playback.dispose();
  }
}

export async function createPlayerAsync(eventHandlers: PlaybackEventHandlers): Promise<Playback> {
  const playback = await createSpessaSynthPlaybackAsync(eventHandlers);
  try {
    return new Player(playback);
  } catch (error) {
    await playback.dispose();
    throw error;
  }
}
