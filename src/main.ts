import { createPlayerAsync } from './player';
import { onHmrDispose } from './hmr_utils';
import { ChannelVisualizer, type ChannelVisualizerLayout } from './channel_visualizer';
import { MIDI_NOTE_COUNT, MidiNoteStateStore } from './midi_note_state';
import './style.scss'
import * as THREE from "three";

// import gsap from "gsap";

const DISPLAY_CHANNELS = [
  { channel: 0, color: 0x00ff00 },
  { channel: 1, color: 0x0000ff },
  { channel: 9, color: 0xff0000 },
] as const;

const VISUALIZATION_PLANE_Z = 0;
const MIN_VIEW_SIZE = 2;
const HORIZONTAL_PADDING_RATIO = 0.08;
const BASE_CUBE_SIZE_RATIO = 0.01;
const LANE_GAP_RATIO = 0.12;

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
  camera.position.z = 5;

  const viewElement = document.querySelector<HTMLCanvasElement>("#view")!;

  const renderer = new THREE.WebGLRenderer({
    canvas: viewElement,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const viewSize = new THREE.Vector2();
  let channelVisualizers: ChannelVisualizer[] = [];

  const createChannelLayout = (channelIndex: number): ChannelVisualizerLayout => {
    const sceneUnit = Math.min(viewSize.x, viewSize.y);
    const horizontalPadding = sceneUnit * HORIZONTAL_PADDING_RATIO;
    const usableWidth = viewSize.x - horizontalPadding * 2;
    const laneGap = sceneUnit * LANE_GAP_RATIO;
    const laneOffset = (DISPLAY_CHANNELS.length - 1) / 2 - channelIndex;

    return {
      noteStartX: -usableWidth / 2,
      noteStep: usableWidth / (MIDI_NOTE_COUNT - 1),
      baseCubeSize: sceneUnit * BASE_CUBE_SIZE_RATIO,
      y: laneOffset * laneGap,
    };
  };

  const handleResize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;
    const distance = camera.position.z - VISUALIZATION_PLANE_Z;
    const requiredViewHeight = aspect >= 1
      ? MIN_VIEW_SIZE
      : MIN_VIEW_SIZE / aspect;

    camera.aspect = aspect;
    camera.fov = THREE.MathUtils.radToDeg(
      2 * Math.atan(requiredViewHeight / (2 * distance)),
    );
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    camera.getViewSize(distance, viewSize);

    channelVisualizers.forEach((visualizer, index) => {
      visualizer.setLayout(createChannelLayout(index));
    });
  };
  handleResize();

  const noteStateStore = new MidiNoteStateStore();

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  channelVisualizers = DISPLAY_CHANNELS.map(({ channel, color }, index) => {
    const visualizer = new ChannelVisualizer({
      channel,
      color,
      geometry,
      noteStates: noteStateStore.getChannel(channel),
      layout: createChannelLayout(index),
    });
    scene.add(visualizer.mesh);
    return visualizer;
  });
  window.addEventListener("resize", handleResize);

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

    for (const visualizer of channelVisualizers) {
      visualizer.dispose();
    }
    geometry.dispose();
    renderer.dispose();

    await player?.dispose();
  });

  player = await createPlayerAsync({
    onNoteOn: (event) => {
      console.log("noteOn", event);
      noteStateStore.noteOn(
        event.channel,
        event.midiNote,
        event.velocity,
        getCurrentTime(),
      );
    },
    onNoteOff: (event) => {
      console.log("noteOff", event);
      noteStateStore.noteOff(event.channel, event.midiNote, getCurrentTime());
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
      visualizer.update(now);
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
