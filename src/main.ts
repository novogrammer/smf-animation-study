import { createPlayerAsync } from './player';
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
  midiNote: number,
  startedAt: number | null;
  releasedAt: number | null;
  velocity: number;
}

function getAdsrValue(
  now: number,
  noteState: NoteState,
  adsr: Adsr,
): number {
  if(noteState.startedAt === null){
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

function calcMatrix(objectDummy:THREE.Object3D,now:number,noteState:NoteState){
  const adsr: Adsr = {
    attack: 0.08,
    decay: 0.15,
    sustain: 0.6,
    release: 0.3,
  };
  const envelope = getAdsrValue(now,noteState,adsr);

  const scale=envelope * noteState.velocity / 127 + 0.05;
  objectDummy.scale.setScalar(scale);
  objectDummy.position.x=THREE.MathUtils.mapLinear(noteState.midiNote,0,127,-5,5);
  objectDummy.updateMatrix();

}

async function mainAsync(){

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

  const viewElement = document.querySelector<HTMLCanvasElement>("#view")!;

  const renderer = new THREE.WebGLRenderer({
    canvas:viewElement,
  });
  renderer.setSize( window.innerWidth, window.innerHeight );

  const geometry = new THREE.BoxGeometry( 1, 1, 1 );
  const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
  const cube = new THREE.InstancedMesh( geometry, material, 128 );
  cube.instanceMatrix.setUsage( THREE.DynamicDrawUsage );
  const noteStateList:NoteState[]=[];
  

  const objectDummy=new THREE.Object3D();
  for(let i=0;i<128;i++){
    const noteState:NoteState={
      midiNote:i,
      startedAt:null,
      releasedAt:null,
      velocity:0,
    }
    calcMatrix(objectDummy,0,noteState);
    cube.setMatrixAt(i,objectDummy.matrix);
    noteStateList.push(noteState);
  }
  scene.add( cube );

  camera.position.z = 5;

  // const state={
  //   scale:0,
  // }


  const player=await createPlayerAsync({
    onNoteOn:(event)=>{
      console.log("noteOn",event);
      const noteState=noteStateList[event.midiNote];
      if(!noteState){
        throw new Error("noteState is null");
      }
      noteState.startedAt=player.seq.currentHighResolutionTime;
      noteState.releasedAt=null;
      noteState.velocity=event.velocity;
    },
    onNoteOff:(event)=>{
      console.log("noteOff",event);

      const noteState=noteStateList[event.midiNote];
      if(!noteState){
        throw new Error("noteState is null");
      }
      noteState.releasedAt=player.seq.currentHighResolutionTime;
    },
  });

  renderer.setAnimationLoop(()=>{
    for(let i=0;i<128;i++){
      const noteState=noteStateList[i];
      if(!noteState){
        throw new Error("noteState is null");
      }
      calcMatrix(objectDummy,player.seq.currentHighResolutionTime,noteState);
      cube.setMatrixAt(i,objectDummy.matrix);
    }
    cube.instanceMatrix.needsUpdate=true;

    renderer.render( scene, camera );

  })


}


mainAsync().catch((error)=>console.error(error));

