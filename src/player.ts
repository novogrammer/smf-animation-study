import { Sequencer, WorkletSynthesizer } from 'spessasynth_lib';

import workletUrl from "spessasynth_lib/dist/spessasynth_processor.min.js?url";

async function loadAsArrayBufferAsync(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
  }
  return await response.arrayBuffer();
}

export type NoteOnEvent = {
  midiNote: number;
  channel: number;
  velocity: number;
};
export type NoteOffEvent = {
  midiNote: number;
  channel: number;
};

const EVENT_ID_VISUALIZER = "visualizer";

class Player {
  resumeElement = document.querySelector<HTMLButtonElement>("#resume")!;
  statusElement = document.querySelector<HTMLElement>("#player-status")!;
  currentTimeElement = document.querySelector<HTMLElement>("[data-role='current-time']")!;
  durationElement = document.querySelector<HTMLElement>("[data-role='duration']")!;

  audioContext: AudioContext;
  synth: WorkletSynthesizer;
  seq: Sequencer;
  onNoteOn: (event: NoteOnEvent) => void;
  onNoteOff: (event: NoteOffEvent) => void;
  private intervalTimer: number | undefined;
  private disposed = false;

  private readonly handleResumeClick = () => {
    this.togglePlaybackAsync().catch((error) => {
      console.error(error);
      this.statusElement.textContent = "Playback failed. Try again.";
      this.statusElement.setAttribute("role", "alert");
      this.resumeElement.disabled = false;
    });
  };

  constructor(audioContext: AudioContext, synth: WorkletSynthesizer, seq: Sequencer, onNoteOn: (event: NoteOnEvent) => void, onNoteOff: (event: NoteOffEvent) => void) {
    this.audioContext = audioContext;
    this.synth = synth;
    this.seq = seq;
    this.onNoteOn = onNoteOn;
    this.onNoteOff = onNoteOff;
    this.setupEvents();
  }
  setupEvents() {

    this.synth.eventHandler.addEvent("noteOn", EVENT_ID_VISUALIZER, this.onNoteOn);
    this.synth.eventHandler.addEvent("noteOff", EVENT_ID_VISUALIZER, this.onNoteOff);
    this.seq.eventHandler.addEvent("metaEvent",EVENT_ID_VISUALIZER,(event)=>{
      if(event.event.statusByte==6){
        const text = new TextDecoder().decode(event.event.data);
        console.log("metaEvent Marker",text);
      }
    })
    this.intervalTimer = window.setInterval(() => {
      this.updateTime();
    }, 100);
    this.resumeElement.addEventListener("click", this.handleResumeClick);
    this.updateTime();
    this.resumeElement.disabled = false;
    this.statusElement.textContent = "Ready";

  }

  private async togglePlaybackAsync() {
    if (this.seq.paused) {
      this.resumeElement.disabled = true;
      this.statusElement.setAttribute("role", "status");
      this.statusElement.textContent = "Starting audio…";
      try {
        await this.audioContext.resume();
        this.seq.play();
        this.resumeElement.textContent = "Pause";
        this.resumeElement.setAttribute("aria-pressed", "true");
        this.statusElement.textContent = "Playing";
      } finally {
        if (!this.disposed) {
          this.resumeElement.disabled = false;
        }
      }
    } else {
      this.seq.pause();
      this.resumeElement.textContent = "Play";
      this.resumeElement.setAttribute("aria-pressed", "false");
      this.statusElement.textContent = "Paused";
    }
  }

  private updateTime() {
    this.currentTimeElement.textContent = this.seq.currentTime.toFixed(2);
    this.durationElement.textContent = this.seq.duration.toFixed(2);
  }

  async dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    this.seq.pause();
    this.synth.eventHandler.removeEvent("noteOn", EVENT_ID_VISUALIZER);
    this.synth.eventHandler.removeEvent("noteOff", EVENT_ID_VISUALIZER);
    this.seq.eventHandler.removeEvent("metaEvent", EVENT_ID_VISUALIZER);
    this.resumeElement.removeEventListener("click", this.handleResumeClick);
    this.resumeElement.disabled = true;
    this.resumeElement.setAttribute("aria-pressed", "false");

    if (this.intervalTimer !== undefined) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = undefined;
    }

    this.synth.stopAll(true);
    this.synth.disconnect();
    this.synth.destroy();

    if (this.audioContext.state !== "closed") {
      await this.audioContext.close();
    }

  }
}


export async function createPlayerAsync({ onNoteOn, onNoteOff }: { onNoteOn: (event: NoteOnEvent) => void, onNoteOff: (event: NoteOffEvent) => void }): Promise<Player> {
  const sfFile = await loadAsArrayBufferAsync("./assets/soundfonts/GeneralUser-GS/GeneralUserGS.sf3");

  const audioContext = new AudioContext();
  let synth: WorkletSynthesizer | undefined;
  try {
    await audioContext.audioWorklet.addModule(workletUrl);
    synth = new WorkletSynthesizer(audioContext);
    synth.connect(audioContext.destination);
    await synth.soundBankManager.addSoundBank(sfFile, "main");
    const seq = new Sequencer(synth);
    seq.loopCount = Infinity;
    // const midiFile = await loadAsArrayBufferAsync("./assets/smf/fur_Elise_WoO59.mid");
    const midiFile = await loadAsArrayBufferAsync("./assets/smf/fur_Elise_WoO59_marker.mid");
    seq.loadNewSongList([{ binary: midiFile }]);

    return new Player(audioContext, synth, seq, onNoteOn, onNoteOff);
  } catch (error) {
    synth?.disconnect();
    synth?.destroy();
    if (audioContext.state !== "closed") {
      await audioContext.close();
    }
    throw error;
  }
}
