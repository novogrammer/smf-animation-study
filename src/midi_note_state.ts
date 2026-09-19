export const MIDI_CHANNEL_COUNT = 16;
export const MIDI_NOTE_COUNT = 128;

export interface NoteState {
  channel: number;
  midiNote: number;
  startedAt: number | null;
  releasedAt: number | null;
  velocity: number;
}

export class MidiNoteStateStore {
  private readonly channels: NoteState[][];
  private readonly warnedInvalidNoteEvents = new Set<string>();

  constructor() {
    this.channels = Array.from(
      { length: MIDI_CHANNEL_COUNT },
      (_, channel) => Array.from(
        { length: MIDI_NOTE_COUNT },
        (_, midiNote): NoteState => ({
          channel,
          midiNote,
          startedAt: null,
          releasedAt: null,
          velocity: 0,
        }),
      ),
    );
  }

  noteOn(channel: number, midiNote: number, velocity: number, now: number): void {
    const noteState = this.getNoteState(channel, midiNote);
    if (!noteState) {
      return;
    }
    noteState.startedAt = now;
    noteState.releasedAt = null;
    noteState.velocity = velocity;
  }

  noteOff(channel: number, midiNote: number, now: number): void {
    const noteState = this.getNoteState(channel, midiNote);
    if (!noteState) {
      return;
    }
    noteState.releasedAt = now;
  }

  reset(): void {
    for (const channel of this.channels) {
      for (const noteState of channel) {
        noteState.startedAt = null;
        noteState.releasedAt = null;
        noteState.velocity = 0;
      }
    }
  }

  getChannel(channel: number): readonly NoteState[] {
    const noteStates = this.channels[channel];
    if (!noteStates) {
      throw new RangeError(`MIDI channel must be between 0 and ${MIDI_CHANNEL_COUNT - 1}: ${channel}`);
    }
    return noteStates;
  }

  private getNoteState(channel: number, midiNote: number): NoteState | undefined {
    const noteState = this.channels[channel]?.[midiNote];
    if (!noteState) {
      const warningKey = `${channel}:${midiNote}`;
      if (!this.warnedInvalidNoteEvents.has(warningKey)) {
        this.warnedInvalidNoteEvents.add(warningKey);
        console.warn("Ignoring MIDI note event outside the supported range", {
          channel,
          midiNote,
        });
      }
    }
    return noteState;
  }
}
