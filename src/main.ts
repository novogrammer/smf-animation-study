import { createPlayerAsync } from './player';
import { onHmrDispose } from './hmr_utils';
import { ChannelVisualizer } from './channel_visualizer';
import { MidiNoteStateStore } from './midi_note_state';
import './style.scss'
import * as THREE from "three";

// import gsap from "gsap";

const DISPLAY_CHANNELS = [
  { channel: 0, color: 0x00ff00, y: 0.4 },
  { channel: 1, color: 0x00aaff, y: -0.4 },
] as const;

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

  const noteStateStore = new MidiNoteStateStore();

  const geometry = new THREE.BoxGeometry(0.05, 0.05, 0.05);
  const channelVisualizers: ChannelVisualizer[] = DISPLAY_CHANNELS.map(({ channel, color, y }) => {
    const visualizer = new ChannelVisualizer({
      channel,
      color,
      y,
      geometry,
      noteStates: noteStateStore.getChannel(channel),
    });
    scene.add(visualizer.mesh);
    return visualizer;
  });

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
