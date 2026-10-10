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

/** 描画側が参照する時計。時刻は秒単位の曲内位置。 */
export interface PlaybackClock {
  /** ADSRとカメラが共有する、再生元の高精度な時刻。 */
  readonly currentTime: number;
}

/** 再生側が提供する開始・一時停止の操作と再生状態。UIは含まない。 */
export interface PlaybackTransport extends PlaybackClock {
  readonly duration: number;
  readonly paused: boolean;
  play(): Promise<void>;
  pause(): void;
}

/** 初期化処理が所有し、終了時に破棄する再生実装。 */
export interface Playback extends PlaybackTransport {
  dispose(): Promise<void>;
}
