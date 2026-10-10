import { Sequencer, WorkletSynthesizer } from 'spessasynth_lib';

import workletUrl from "spessasynth_lib/dist/spessasynth_processor.min.js?url";
import {
  parseSectionMarker,
  type SectionMarker,
  type SectionName,
  type SectionRange,
} from "./section";

import type {
  Playback,
  PlaybackEventHandlers,
  NoteOnEvent,
  NoteOffEvent,
} from "./playback";

async function loadAsArrayBufferAsync(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
  }
  return await response.arrayBuffer();
}

const EVENT_ID_VISUALIZER = "visualizer";
const MIDI_MARKER_STATUS = 0x06;
const textDecoder = new TextDecoder();

class SpessaSynthPlayback implements Playback {
  private audioContext: AudioContext;
  private synth: WorkletSynthesizer;
  private seq: Sequencer;
  private onNoteOn: (event: NoteOnEvent) => void;
  private onNoteOff: (event: NoteOffEvent) => void;
  private onTimeChange: (time: number) => void;
  private onSectionChange: (section: SectionRange) => void;
  private sectionMarkers: SectionMarker[];
  private currentSection: SectionName | undefined;
  private disposed = false;

  constructor(
    audioContext: AudioContext,
    synth: WorkletSynthesizer,
    seq: Sequencer,
    sectionMarkers: SectionMarker[],
    { onNoteOn, onNoteOff, onTimeChange, onSectionChange }: PlaybackEventHandlers,
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
  private setupEvents() {

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

      const text = textDecoder.decode(event.data);
      console.log("metaEvent Marker", {
        text,
        tick: event.ticks,
        currentTime: this.seq.currentTime,
        highResolutionTime: this.seq.currentHighResolutionTime,
      });

      const section = parseSectionMarker(text);
      if (section !== undefined) {
        this.setSection(section);
      }
    });
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

    const markerIndex = this.sectionMarkers.findIndex(
      (marker) => marker.section === section,
    );
    const marker = this.sectionMarkers[markerIndex];
    if (marker === undefined) {
      return;
    }

    this.currentSection = section;
    this.onSectionChange({
      section,
      startTime: marker.time,
      endTime: this.sectionMarkers[markerIndex + 1]?.time ?? this.seq.duration,
    });
  }

  get currentTime(): number {
    return this.seq.currentHighResolutionTime;
  }

  get duration(): number {
    return this.seq.duration;
  }

  get paused(): boolean {
    return this.seq.paused;
  }

  async play(): Promise<void> {
    if (this.disposed) return;
    await this.audioContext.resume();
    if (!this.disposed) this.seq.play();
  }

  pause(): void {
    this.seq.pause();
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
    this.synth.stopAll(true);
    this.synth.disconnect();
    this.synth.destroy();

    if (this.audioContext.state !== "closed") {
      await this.audioContext.close();
    }

  }
}


export async function createSpessaSynthPlaybackAsync(eventHandlers: PlaybackEventHandlers): Promise<Playback> {
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

    return new SpessaSynthPlayback(audioContext, synth, seq, sectionMarkers, eventHandlers);
  } catch (error) {
    synth?.disconnect();
    synth?.destroy();
    if (audioContext.state !== "closed") {
      await audioContext.close();
    }
    throw error;
  }
}
