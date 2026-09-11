import './style.css'
// import * as THREE from "three";

import { Sequencer, WorkletSynthesizer } from 'spessasynth_lib';

import workletUrl from "spessasynth_lib/dist/spessasynth_processor.min.js?url";

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

  document.querySelector<HTMLElement>("#play")!.addEventListener("click",()=>{
    (async ()=>{
      await audioContext.resume();
      const midiFile = await loadAsArrayBufferAsync("./assets/smf/fur_Elise_WoO59.mid");
      seq.loadNewSongList([{ binary: midiFile }]);
      seq.play();

    })().catch((error)=>console.error(error));
  })
}


mainAsync().catch((error)=>console.error(error));

