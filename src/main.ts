import { setupSpessasynthAsync } from './spessasynth';
import './style.scss'
// import * as THREE from "three";


async function mainAsync(){
  await setupSpessasynthAsync();
}


mainAsync().catch((error)=>console.error(error));

