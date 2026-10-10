import { BasicMIDI } from "spessasynth_core";
import type { Playback, PlaybackEventHandlers, NoteOnEvent, NoteOffEvent } from "./playback";
import { parseSectionMarker, type SectionMarker, type SectionName } from "./section";

type TimelineEvent =
  | { time: number; type: "noteOn"; note: NoteOnEvent }
  | { time: number; type: "noteOff"; note: NoteOffEvent }
  | { time: number; type: "section"; section: SectionName };

/** SMFと独自時計だけで進行する。Web Audioや音声用リソースは使わない。 */
export class NoAudioPlayback implements Playback {
  readonly duration: number;
  private readonly events: TimelineEvent[] = [];
  private readonly sections: SectionMarker[] = [];
  private readonly loopStart: number;
  private readonly loopEnd: number;
  private readonly handlers: PlaybackEventHandlers;
  private position: number;
  private anchorPosition = 0;
  private anchorTime = 0;
  private eventIndex = 0;
  private currentSection: SectionName | undefined;
  private isPaused = true;
  private disposed = false;
  private frameId: number | undefined;

  constructor(midi: BasicMIDI, handlers: PlaybackEventHandlers) {
    this.handlers = handlers;
    this.duration = midi.duration;
    this.loopStart = midi.midiTicksToSeconds(midi.loop.start);
    this.loopEnd = midi.midiTicksToSeconds(midi.loop.end);
    if (!Number.isFinite(this.loopEnd) || this.loopEnd <= this.loopStart) {
      throw new Error("SMF must have a valid playback range.");
    }
    this.position = midi.midiTicksToSeconds(midi.firstNoteOn);
    const decoder = new TextDecoder();
    for (const entry of midi.timeline) {
      const event = midi.tracks[entry.tr].events[entry.ev];
      const time = midi.midiTicksToSeconds(event.ticks);
      const status = event.statusByte & 0xf0;
      const channel = event.statusByte & 0x0f;
      if (status === 0x90 && event.data[1] > 0) {
        this.events.push({ time, type: "noteOn", note: {
          channel, midiNote: event.data[0], velocity: event.data[1],
        } });
      } else if (status === 0x80 || (status === 0x90 && event.data[1] === 0)) {
        this.events.push({ time, type: "noteOff", note: { channel, midiNote: event.data[0] } });
      } else if (event.statusByte === 0x06) {
        const section = parseSectionMarker(decoder.decode(event.data));
        if (section !== undefined) {
          this.events.push({ time, type: "section", section });
          this.sections.push({ time, section });
        }
      }
    }
    this.syncSection(this.position);
  }

  get currentTime(): number { return this.position; }
  get paused(): boolean { return this.isPaused; }

  async play(): Promise<void> {
    if (this.disposed || !this.isPaused) return;
    this.anchorPosition = this.position;
    this.anchorTime = performance.now();
    this.isPaused = false;
    this.processUntil(this.position);
    this.frameId = requestAnimationFrame(this.handleFrame);
  }

  pause(): void {
    if (this.disposed || this.isPaused) return;
    this.advance(performance.now());
    this.isPaused = true;
    if (this.frameId !== undefined) cancelAnimationFrame(this.frameId);
    this.frameId = undefined;
  }

  private readonly handleFrame = () => {
    if (this.disposed || this.isPaused) return;
    this.advance(performance.now());
    this.frameId = requestAnimationFrame(this.handleFrame);
  };

  private advance(now: number) {
    const time = this.anchorPosition + (now - this.anchorTime) / 1000;
    if (time < this.loopEnd) {
      this.position = time;
      this.processUntil(time);
      return;
    }

    // 背景タブ等で複数周分遅れても、現在の周の状態だけを復元する。
    this.processUntil(this.loopEnd);
    const target = this.loopStart + (time - this.loopEnd) % (this.loopEnd - this.loopStart);
    this.position = this.loopStart;
    this.handlers.onTimeChange(this.loopStart);
    this.eventIndex = 0;
    this.currentSection = undefined;
    while (this.events[this.eventIndex]?.time < this.loopStart) {
      const event = this.events[this.eventIndex++]!;
      if (event.type !== "section") this.emit(event);
    }
    this.syncSection(this.loopStart);
    this.position = target;
    this.processUntil(target);
    this.anchorPosition = target;
    this.anchorTime = now;
  }

  private processUntil(time: number) {
    while (this.events[this.eventIndex]?.time <= time) {
      this.emit(this.events[this.eventIndex++]!);
    }
  }

  private emit(event: TimelineEvent) {
    if (event.type === "noteOn") this.handlers.onNoteOn(event.note, event.time);
    else if (event.type === "noteOff") this.handlers.onNoteOff(event.note, event.time);
    else this.setSection(event.section);
  }

  private syncSection(time: number) {
    const marker = this.sections.findLast((candidate) => candidate.time <= time);
    if (marker) this.setSection(marker.section);
  }

  private setSection(section: SectionName) {
    if (this.currentSection === section) return;
    const index = this.sections.findIndex((marker) => marker.section === section);
    const marker = this.sections[index];
    if (!marker) return;
    this.currentSection = section;
    this.handlers.onSectionChange({
      section, startTime: marker.time, endTime: this.sections[index + 1]?.time ?? this.duration,
    });
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.isPaused = true;
    if (this.frameId !== undefined) cancelAnimationFrame(this.frameId);
    this.frameId = undefined;
  }
}

export async function createNoAudioPlaybackAsync(handlers: PlaybackEventHandlers): Promise<Playback> {
  const response = await fetch("./assets/smf/When_the_Saints_Go_Marching_In--novo.mid");
  if (!response.ok) throw new Error(`Failed to load SMF: ${response.status} ${response.statusText}`);
  const midi = BasicMIDI.fromArrayBuffer(await response.arrayBuffer());
  return new NoAudioPlayback(midi, handlers);
}
