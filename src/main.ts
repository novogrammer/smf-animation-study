import { createPlayerAsync } from './player';
import { onHmrDispose } from './hmr_utils';
import './style.scss'
import * as THREE from "three";

// import gsap from "gsap";

type Adsr = {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
};


interface NoteState {
  channel: number;
  midiNote: number;
  startedAt: number | null;
  releasedAt: number | null;
  velocity: number;
}

type ChannelVisualizer = {
  channel: number;
  mesh: THREE.InstancedMesh;
  material: THREE.MeshStandardMaterial;
};

const MIDI_CHANNEL_COUNT = 16;
const MIDI_NOTE_COUNT = 128;
const DISPLAY_CHANNELS = [
  { channel: 0, color: 0x00ff00, y: 0.4 },
  { channel: 1, color: 0x00aaff, y: -0.4 },
] as const;

function getAdsrValue(
  now: number,
  noteState: NoteState,
  adsr: Adsr,
): number {
  if (noteState.startedAt === null) {
    return 0;
  }
  const attackEnd = noteState.startedAt + adsr.attack;
  const decayEnd = attackEnd + adsr.decay;

  if (noteState.releasedAt === null || now < noteState.releasedAt) {
    if (now < attackEnd) {
      return (now - noteState.startedAt) / adsr.attack;
    }

    if (now < decayEnd) {
      const t = (now - attackEnd) / adsr.decay;
      return 1 + (adsr.sustain - 1) * t;
    }

    return adsr.sustain;
  }

  // releaseされてなかった場合の値
  const releaseStartValue = getAdsrValue(
    noteState.releasedAt,
    {
      ...noteState,
      releasedAt: null,
    },
    adsr,
  );

  const t = (now - noteState.releasedAt) / adsr.release;

  return Math.max(0, releaseStartValue * (1 - t));
}

function calcMatrix(objectDummy: THREE.Object3D, now: number, noteState: NoteState) {
  const adsr: Adsr = {
    attack: 0.08,
    decay: 0.15,
    sustain: 0.6,
    release: 0.3,
  };
  const envelope = getAdsrValue(now, noteState, adsr);

  const amplifier = 10;
  const scale = envelope * noteState.velocity / 127 * amplifier + 1;
  objectDummy.scale.setScalar(scale);
  objectDummy.position.set(
    THREE.MathUtils.mapLinear(noteState.midiNote, 0, MIDI_NOTE_COUNT - 1, -5, 5),
    0,
    0,
  );
  objectDummy.updateMatrix();

}

async function mainAsync() {

  const resumeElement = document.querySelector<HTMLButtonElement>("#resume")!;
  const statusElement = document.querySelector<HTMLElement>("#player-status")!;
  resumeElement.disabled = true;
  resumeElement.textContent = "Play";
  resumeElement.setAttribute("aria-pressed", "false");
  statusElement.setAttribute("role", "status");
  statusElement.textContent = "Loading audio…";

  const scene = new THREE.Scene();
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
  directionalLight.position.set(10, 10, 10);
  scene.add(directionalLight);
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);

  const viewElement = document.querySelector<HTMLCanvasElement>("#view")!;

  const renderer = new THREE.WebGLRenderer({
    canvas: viewElement,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const handleResize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
  };
  handleResize();
  window.addEventListener("resize", handleResize);

  const noteStates: NoteState[][] = Array.from(
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

  const geometry = new THREE.BoxGeometry(0.05, 0.05, 0.05);
  const objectDummy = new THREE.Object3D();
  const channelVisualizers: ChannelVisualizer[] = DISPLAY_CHANNELS.map(({ channel, color, y }) => {
    const material = new THREE.MeshStandardMaterial({
      color,
      metalness: 0,
      roughness: 1,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, MIDI_NOTE_COUNT);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.position.y = y;

    const channelStates = noteStates[channel];
    for (let midiNote = 0; midiNote < MIDI_NOTE_COUNT; midiNote++) {
      const noteState = channelStates?.[midiNote];
      if (!noteState) {
        continue;
      }
      calcMatrix(objectDummy, 0, noteState);
      mesh.setMatrixAt(midiNote, objectDummy.matrix);
    }

    scene.add(mesh);
    return { channel, mesh, material };
  });

  const warnedInvalidNoteEvents = new Set<string>();
  const getNoteState = (channel: number, midiNote: number): NoteState | undefined => {
    const noteState = noteStates[channel]?.[midiNote];
    if (!noteState) {
      const warningKey = `${channel}:${midiNote}`;
      if (!warnedInvalidNoteEvents.has(warningKey)) {
        warnedInvalidNoteEvents.add(warningKey);
        console.warn("Ignoring MIDI note event outside the supported range", {
          channel,
          midiNote,
        });
      }
    }
    return noteState;
  };

  camera.position.z = 5;

  // const state={
  //   scale:0,
  // }


  let player: Awaited<ReturnType<typeof createPlayerAsync>> | undefined;
  let disposed = false;
  const getCurrentTime = () => player?.seq.currentHighResolutionTime ?? 0;

  onHmrDispose(async () => {
    disposed = true;
    window.removeEventListener("resize", handleResize);
    renderer.setAnimationLoop(null);

    geometry.dispose();
    for (const visualizer of channelVisualizers) {
      visualizer.material.dispose();
    }
    renderer.dispose();

    await player?.dispose();
  });

  player = await createPlayerAsync({
    onNoteOn: (event) => {
      console.log("noteOn", event);
      const noteState = getNoteState(event.channel, event.midiNote);
      if (!noteState) {
        return;
      }
      noteState.startedAt = getCurrentTime();
      noteState.releasedAt = null;
      noteState.velocity = event.velocity;
    },
    onNoteOff: (event) => {
      console.log("noteOff", event);

      const noteState = getNoteState(event.channel, event.midiNote);
      if (!noteState) {
        return;
      }
      noteState.releasedAt = getCurrentTime();
    },
  });

  if (disposed) {
    await player.dispose();
    return;
  }
  const activePlayer = player;

  renderer.setAnimationLoop(() => {
    const now = activePlayer.seq.currentHighResolutionTime;
    for (const visualizer of channelVisualizers) {
      const channelStates = noteStates[visualizer.channel];
      if (!channelStates) {
        continue;
      }
      for (let midiNote = 0; midiNote < MIDI_NOTE_COUNT; midiNote++) {
        const noteState = channelStates[midiNote];
        if (!noteState) {
          continue;
        }
        calcMatrix(objectDummy, now, noteState);
        visualizer.mesh.setMatrixAt(midiNote, objectDummy.matrix);
      }
      visualizer.mesh.instanceMatrix.needsUpdate = true;
    }

    renderer.render(scene, camera);

  })


}


mainAsync().catch((error) => {
  console.error(error);
  const resumeElement = document.querySelector<HTMLButtonElement>("#resume");
  const statusElement = document.querySelector<HTMLElement>("#player-status");
  if (resumeElement) {
    resumeElement.disabled = true;
  }
  if (statusElement) {
    statusElement.setAttribute("role", "alert");
    statusElement.textContent = "Could not load audio. Reload the page to try again.";
  }
});
