import { Sequencer, WorkletSynthesizer } from 'spessasynth_lib';

import workletUrl from "spessasynth_lib/dist/spessasynth_processor.min.js?url";

async function loadAsArrayBufferAsync(url: string) {
  const response = await fetch(url);
  return await response.arrayBuffer();
}

type NoteOnEvent = {
  midiNote: number;
  channel: number;
  velocity: number;
};
type NoteOffEvent = {
  midiNote: number;
  channel: number;
};

const EVENT_ID_VISUALIZER = "visualizer";

class Player {
  resumeElement = document.querySelector<HTMLElement>("#resume")!;
  currentTimeElement = document.querySelector<HTMLElement>("[data-role='current-time']")!;
  durationElement = document.querySelector<HTMLElement>("[data-role='duration']")!;

  audioContext: AudioContext;
  synth: WorkletSynthesizer;
  seq: Sequencer;
  onNoteOn: (event: NoteOnEvent) => void;
  onNoteOff: (event: NoteOffEvent) => void;
  private intervalTimer: number | undefined;
  private disposed = false;

  private readonly handleResumeClick = () => {
    this.togglePlaybackAsync().catch((error) => console.error(error));
  };

  constructor(audioContext: AudioContext, synth: WorkletSynthesizer, seq: Sequencer, onNoteOn: (event: NoteOnEvent) => void, onNoteOff: (event: NoteOffEvent) => void) {
    this.audioContext = audioContext;
    this.synth = synth;
    this.seq = seq;
    this.onNoteOn = onNoteOn;
    this.onNoteOff = onNoteOff;
    this.setupEvents();
  }
  setupEvents() {

    this.synth.eventHandler.addEvent("noteOn", EVENT_ID_VISUALIZER, this.onNoteOn);
    this.synth.eventHandler.addEvent("noteOff", EVENT_ID_VISUALIZER, this.onNoteOff);
    this.seq.eventHandler.addEvent("metaEvent",EVENT_ID_VISUALIZER,(event)=>{
      if(event.event.statusByte==6){
        const text = new TextDecoder().decode(event.event.data);
        console.log("metaEvent Marker",text);
      }
    })
    this.intervalTimer = window.setInterval(() => {
      this.currentTimeElement.textContent = this.seq.currentTime.toFixed(2);
      this.durationElement.textContent = this.seq.duration.toFixed(2);
    }, 100);
    this.resumeElement.addEventListener("click", this.handleResumeClick);

  }

  private async togglePlaybackAsync() {
    if (this.seq.paused) {
      await this.audioContext.resume();
      this.seq.play();
      this.resumeElement.textContent = "Pause";
    } else {
      this.seq.pause();
      this.resumeElement.textContent = "Resume";
    }
  }

  async dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    this.seq.pause();
    this.synth.eventHandler.removeEvent("noteOn", EVENT_ID_VISUALIZER);
    this.synth.eventHandler.removeEvent("noteOff", EVENT_ID_VISUALIZER);
    this.seq.eventHandler.removeEvent("metaEvent", EVENT_ID_VISUALIZER);
    this.resumeElement.removeEventListener("click", this.handleResumeClick);

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


export async function createPlayerAsync({ onNoteOn, onNoteOff }: { onNoteOn: (event: NoteOnEvent) => void, onNoteOff: (event: NoteOffEvent) => void }): Promise<Player> {
  const sfFile = await loadAsArrayBufferAsync("./assets/soundfonts/GeneralUser-GS/GeneralUserGS.sf3");

  const audioContext = new AudioContext();
  await audioContext.audioWorklet.addModule(workletUrl);
  const synth = new WorkletSynthesizer(audioContext);
  synth.connect(audioContext.destination);
  await synth.soundBankManager.addSoundBank(sfFile, "main");
  const seq = new Sequencer(synth);
  seq.loopCount = Infinity;
  // const midiFile = await loadAsArrayBufferAsync("./assets/smf/fur_Elise_WoO59.mid");
  const midiFile = await loadAsArrayBufferAsync("./assets/smf/fur_Elise_WoO59_marker.mid");
  seq.loadNewSongList([{ binary: midiFile }]);

  const player = new Player(audioContext, synth, seq, onNoteOn, onNoteOff);

  return player;
}
