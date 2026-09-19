import * as THREE from "three";
import { MIDI_NOTE_COUNT, type NoteState } from "./midi_note_state";

type Adsr = {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
};

type ChannelVisualizerOptions = {
  channel: number;
  color: THREE.ColorRepresentation;
  geometry: THREE.BufferGeometry;
  noteStates: readonly NoteState[];
  layout: ChannelVisualizerLayout;
};

export type ChannelVisualizerLayout = {
  noteStartX: number;
  noteStep: number;
  baseCubeSize: number;
  y: number;
};

const ADSR: Adsr = {
  attack: 0.08,
  decay: 0.15,
  sustain: 0.6,
  release: 0.3,
};

const objectDummy = new THREE.Object3D();

function getAdsrValue(now: number, noteState: NoteState): number {
  if (noteState.startedAt === null) {
    return 0;
  }
  const attackEnd = noteState.startedAt + ADSR.attack;
  const decayEnd = attackEnd + ADSR.decay;

  if (noteState.releasedAt === null || now < noteState.releasedAt) {
    if (now < attackEnd) {
      return (now - noteState.startedAt) / ADSR.attack;
    }

    if (now < decayEnd) {
      const t = (now - attackEnd) / ADSR.decay;
      return 1 + (ADSR.sustain - 1) * t;
    }

    return ADSR.sustain;
  }

  const releaseStartValue = getAdsrValue(noteState.releasedAt, {
    ...noteState,
    releasedAt: null,
  });
  const t = (now - noteState.releasedAt) / ADSR.release;

  return Math.max(0, releaseStartValue * (1 - t));
}

function calcMatrix(
  now: number,
  noteState: NoteState,
  layout: ChannelVisualizerLayout,
): void {
  const envelope = getAdsrValue(now, noteState);
  const amplifier = 10;
  const animationScale = envelope * noteState.velocity / 127 * amplifier + 1;

  objectDummy.scale.setScalar(layout.baseCubeSize * animationScale);
  objectDummy.position.set(
    layout.noteStartX + noteState.midiNote * layout.noteStep,
    0,
    0,
  );
  objectDummy.updateMatrix();
}

export class ChannelVisualizer {
  readonly channel: number;
  readonly mesh: THREE.InstancedMesh;

  private readonly material: THREE.MeshStandardMaterial;
  private readonly noteStates: readonly NoteState[];
  private layout: ChannelVisualizerLayout;
  private disposed = false;

  constructor({ channel, color, geometry, noteStates, layout }: ChannelVisualizerOptions) {
    this.channel = channel;
    this.noteStates = noteStates;
    this.layout = layout;
    this.material = new THREE.MeshStandardMaterial({
      color,
      metalness: 0,
      roughness: 1,
    });
    this.mesh = new THREE.InstancedMesh(geometry, this.material, MIDI_NOTE_COUNT);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.position.y = layout.y;
    this.update(0);
  }

  setLayout(layout: ChannelVisualizerLayout): void {
    this.layout = layout;
    this.mesh.position.y = layout.y;
  }

  update(now: number): void {
    if (this.disposed) {
      return;
    }

    for (let midiNote = 0; midiNote < MIDI_NOTE_COUNT; midiNote++) {
      const noteState = this.noteStates[midiNote];
      if (!noteState) {
        continue;
      }
      calcMatrix(now, noteState, this.layout);
      this.mesh.setMatrixAt(midiNote, objectDummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.mesh.removeFromParent();
    this.material.dispose();
  }
}
