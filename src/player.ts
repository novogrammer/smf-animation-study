import { Sequencer, WorkletSynthesizer } from 'spessasynth_lib';

import workletUrl from "spessasynth_lib/dist/spessasynth_processor.min.js?url";
import { parseSectionMarker, type SectionMarker, type SectionName } from "./section";

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

type PlayerEventHandlers = {
  onNoteOn: (event: NoteOnEvent) => void;
  onNoteOff: (event: NoteOffEvent) => void;
  onTimeChange: (time: number) => void;
  onSectionChange: (section: SectionName) => void;
};

const EVENT_ID_VISUALIZER = "visualizer";
const MIDI_MARKER_STATUS = 0x06;
const textDecoder = new TextDecoder();

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
  onTimeChange: (time: number) => void;
  onSectionChange: (section: SectionName) => void;
  sectionMarkers: SectionMarker[];
  private currentSection: SectionName | undefined;
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

  constructor(
    audioContext: AudioContext,
    synth: WorkletSynthesizer,
    seq: Sequencer,
    sectionMarkers: SectionMarker[],
    { onNoteOn, onNoteOff, onTimeChange, onSectionChange }: PlayerEventHandlers,
  ) {
    this.audioContext = audioContext;
    this.synth = synth;
    this.seq = seq;
    this.onNoteOn = onNoteOn;
    this.onNoteOff = onNoteOff;
    this.onTimeChange = onTimeChange;
    this.onSectionChange = onSectionChange;
    this.sectionMarkers = sectionMarkers;
    this.setupEvents();
  }
  setupEvents() {

    this.synth.eventHandler.addEvent("noteOn", EVENT_ID_VISUALIZER, this.onNoteOn);
    this.synth.eventHandler.addEvent("noteOff", EVENT_ID_VISUALIZER, this.onNoteOff);
    this.seq.eventHandler.addEvent("timeChange", EVENT_ID_VISUALIZER, (time) => {
      this.onTimeChange(time);
      this.syncSection(time);
    });
    this.seq.eventHandler.addEvent("metaEvent", EVENT_ID_VISUALIZER, ({ event }) => {
      if (event.statusByte !== MIDI_MARKER_STATUS) {
        return;
      }

      const section = parseSectionMarker(textDecoder.decode(event.data));
      if (section !== undefined) {
        this.setSection(section);
      }
    });
    this.intervalTimer = window.setInterval(() => {
      this.updateTime();
    }, 100);
    this.resumeElement.addEventListener("click", this.handleResumeClick);
    this.updateTime();
    this.resumeElement.disabled = false;
    this.statusElement.textContent = "Ready";
    this.syncSection(this.seq.currentTime);

  }

  private syncSection(time: number) {
    const marker = this.sectionMarkers.findLast((candidate) => candidate.time <= time);
    if (marker !== undefined) {
      this.setSection(marker.section);
    }
  }

  private setSection(section: SectionName) {
    if (section === this.currentSection) {
      return;
    }
    this.currentSection = section;
    this.onSectionChange(section);
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
    this.seq.eventHandler.removeEvent("timeChange", EVENT_ID_VISUALIZER);
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


export async function createPlayerAsync(eventHandlers: PlayerEventHandlers): Promise<Player> {
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
    // const midiFile = await loadAsArrayBufferAsync("./assets/smf/fur_Elise_WoO59_marker.mid");
    const midiFile = await loadAsArrayBufferAsync("./assets/smf/When_the_Saints_Go_Marching_In--novo.mid");
    seq.loadNewSongList([{ binary: midiFile }]);
    const midi = await seq.getMIDI();
    const sectionMarkers = midi.tracks
      .flatMap((track) => track.events)
      .filter((event) => event.statusByte === MIDI_MARKER_STATUS)
      .map((event): SectionMarker | undefined => {
        const section = parseSectionMarker(textDecoder.decode(event.data));
        return section === undefined
          ? undefined
          : { section, time: midi.midiTicksToSeconds(event.ticks) };
      })
      .filter((marker): marker is SectionMarker => marker !== undefined)
      .sort((a, b) => a.time - b.time);

    return new Player(audioContext, synth, seq, sectionMarkers, eventHandlers);
  } catch (error) {
    synth?.disconnect();
    synth?.destroy();
    if (audioContext.state !== "closed") {
      await audioContext.close();
    }
    throw error;
  }
}
