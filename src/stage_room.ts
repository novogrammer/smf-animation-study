import * as THREE from "three";

const ROOM_WIDTH = 12;
const ROOM_HEIGHT = 7;
const ROOM_DEPTH = 18;
const ROOM_CENTER_Z = 1;
const ROOM_COLOR = 0xffffff;

export class StageRoom {
  readonly mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  private readonly geometry: THREE.BoxGeometry;
  private readonly material: THREE.MeshStandardMaterial;

  constructor() {
    this.geometry = new THREE.BoxGeometry(
      ROOM_WIDTH,
      ROOM_HEIGHT,
      ROOM_DEPTH,
    );
    this.material = new THREE.MeshStandardMaterial({
      color: ROOM_COLOR,
      side: THREE.BackSide,
      roughness: 1,
      metalness: 0,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.z = ROOM_CENTER_Z;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
