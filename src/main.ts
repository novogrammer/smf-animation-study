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
  const cube = new THREE.Mesh( geometry, material );
  cube.scale.setScalar(0);
  scene.add( cube );

  camera.position.z = 5;

  const state={
    scale:0,
  }


  const timeline = gsap.timeline({
    paused:true,
    onUpdate:()=>{
      cube.scale.setScalar(state.scale);
    }
  })


  timeline.set(state,{
    scale:1,
  },0);
  timeline.to(state,{
    scale:0,
    duration:0.5,
  },0);

  renderer.setAnimationLoop((time)=>{
    cube.rotation.x = time / 2000;
    cube.rotation.y = time / 1000;

    renderer.render( scene, camera );

  })


  await setupSpessasynthAsync({
    onNoteOn:(event)=>{
      timeline.play(0);
      console.log("noteOn",event);
    },
    onNoteOff:(event)=>{
      console.log("noteOff",event);
    },
  });
}


mainAsync().catch((error)=>console.error(error));

