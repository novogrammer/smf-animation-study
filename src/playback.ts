import type { SectionRange } from "./section";

export type NoteOnEvent = {
  midiNote: number;
  channel: number;
  velocity: number;
};
export type NoteOffEvent = {
  midiNote: number;
  channel: number;
};

export type PlaybackEventHandlers = {
  onNoteOn: (event: NoteOnEvent) => void;
  onNoteOff: (event: NoteOffEvent) => void;
  /** シークやループで再生位置が変わったときの状態リセット用。 */
  onTimeChange: (time: number) => void;
  onSectionChange: (section: SectionRange) => void;
};

/** 音声方式に依存しない再生契約。時刻は秒単位の曲内位置。 */
export interface Playback {
  /** ADSRとカメラが共有する、再生元の高精度な時刻。 */
  readonly currentTime: number;
  readonly duration: number;
  readonly paused: boolean;
  play(): Promise<void>;
  pause(): void;
  dispose(): Promise<void>;
}
