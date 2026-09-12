import './style.scss'
// import * as THREE from "three";

import { Sequencer, WorkletSynthesizer } from 'spessasynth_lib';

import workletUrl from "spessasynth_lib/dist/spessasynth_processor.min.js?url";

function onHmrDispose(dispose: () => void) {
  import.meta.hot?.dispose(dispose);
}

async function loadAsArrayBufferAsync(url:string){
  const response = await fetch(url);
  return await response.arrayBuffer();
}

async function mainAsync(){
  const sfFile = await loadAsArrayBufferAsync("./assets/soundfonts/GeneralUser-GS/GeneralUserGS.sf3");

  const audioContext = new AudioContext();
  await audioContext.audioWorklet.addModule(workletUrl);
  const synth = new WorkletSynthesizer(audioContext);
  synth.connect(audioContext.destination);
  await synth.soundBankManager.addSoundBank(sfFile, "main");
  const seq = new Sequencer(synth);
  seq.loopCount = Infinity;
  const midiFile = await loadAsArrayBufferAsync("./assets/smf/fur_Elise_WoO59.mid");
  seq.loadNewSongList([{ binary: midiFile }]);


  const resumeElement = document.querySelector<HTMLElement>("#resume")!;
  const currentTimeElement = document.querySelector<HTMLElement>("[data-role='current-time'")!;
  const durationElement = document.querySelector<HTMLElement>("[data-role='duration'")!;

  const intervalTimer=setInterval(()=>{
    currentTimeElement.textContent=seq.currentTime.toFixed(2);
    durationElement.textContent=seq.duration.toFixed(2);
  },100);
  onHmrDispose(()=>{
    clearInterval(intervalTimer);
  });

  resumeElement.addEventListener("click",()=>{
    (async ()=>{
      
      if(seq.paused){
        await audioContext.resume();
        seq.play();
        resumeElement.textContent="Pause";
      }else{
        seq.pause();
        resumeElement.textContent="Resume";
      }
    })().catch((error)=>console.error(error));
  })
}


mainAsync().catch((error)=>console.error(error));

