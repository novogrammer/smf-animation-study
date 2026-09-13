import { Sequencer, WorkletSynthesizer } from 'spessasynth_lib';

import workletUrl from "spessasynth_lib/dist/spessasynth_processor.min.js?url";
import { onHmrDispose } from './hmr_utils';


async function loadAsArrayBufferAsync(url:string){
  const response = await fetch(url);
  return await response.arrayBuffer();
}


export async function setupSpessasynthAsync(){
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

  const EVENT_ID_VISUALIZER="visualizer";
  synth.eventHandler.addEvent("noteOn",EVENT_ID_VISUALIZER,(event)=>{
    console.log("noteOn",event);
  });
  synth.eventHandler.addEvent("noteOff",EVENT_ID_VISUALIZER,(event)=>{
    console.log("noteOff",event);
  });
  onHmrDispose(()=>{
    synth.eventHandler.removeEvent("noteOn",EVENT_ID_VISUALIZER);
    synth.eventHandler.removeEvent("noteOff",EVENT_ID_VISUALIZER);
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

