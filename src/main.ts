import { setupSpessasynthAsync } from './spessasynth';
import './style.scss'
import * as THREE from "three";

import gsap from "gsap";


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
  const objectDummy=new THREE.Object3D();
  for(let i=0;i<128;i++){
    objectDummy.scale.setScalar(0.05);
    objectDummy.position.x=THREE.MathUtils.mapLinear(i,0,127,-5,5);
    objectDummy.updateMatrix();
    cube.setMatrixAt(i,objectDummy.matrix);
  }
  scene.add( cube );

  camera.position.z = 5;

  // const state={
  //   scale:0,
  // }



  renderer.setAnimationLoop((time)=>{
    // cube.rotation.x = time / 2000;
    // cube.rotation.y = time / 1000;

    renderer.render( scene, camera );

  })


  await setupSpessasynthAsync({
    onNoteOn:(event)=>{
      console.log("noteOn",event);
      const index=THREE.MathUtils.clamp(event.midiNote,0,127);
      objectDummy.position.x=THREE.MathUtils.mapLinear(index,0,127,-5,5);
      objectDummy.scale.setScalar(0.1);
      objectDummy.updateMatrix();
      cube.setMatrixAt(index,objectDummy.matrix);
      cube.instanceMatrix.needsUpdate=true;
    },
    onNoteOff:(event)=>{
      console.log("noteOff",event);
      const index=THREE.MathUtils.clamp(event.midiNote,0,127);
      objectDummy.position.x=THREE.MathUtils.mapLinear(index,0,127,-5,5);
      objectDummy.scale.setScalar(0.05);
      objectDummy.updateMatrix();
      cube.setMatrixAt(index,objectDummy.matrix);
      cube.instanceMatrix.needsUpdate=true;
    },
  });
}


mainAsync().catch((error)=>console.error(error));

