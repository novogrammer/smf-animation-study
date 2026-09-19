import * as THREE from "three";

const ROOM_WIDTH = 6;
const ROOM_FLOOR_Y = -0.8;
const ROOM_CEILING_Y = 2.2;
const ROOM_BACK_Z = -2.5;
const ROOM_FRONT_Z = 7.2;
const ROOM_COLOR = 0xffffff;

export class StageRoom {
  readonly object = new THREE.Group();

  private readonly geometry: THREE.PlaneGeometry;
  private readonly material: THREE.MeshStandardMaterial;

  constructor() {
    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.material = new THREE.MeshStandardMaterial({
      color: ROOM_COLOR,
      roughness: 1,
      metalness: 0,
    });

    const roomHeight = ROOM_CEILING_Y - ROOM_FLOOR_Y;
    const roomDepth = ROOM_FRONT_Z - ROOM_BACK_Z;
    const roomCenterY = (ROOM_FLOOR_Y + ROOM_CEILING_Y) / 2;
    const roomCenterZ = (ROOM_BACK_Z + ROOM_FRONT_Z) / 2;

    const backWall = this.createPanel(ROOM_WIDTH, roomHeight);
    backWall.position.set(0, roomCenterY, ROOM_BACK_Z);

    const floor = this.createPanel(ROOM_WIDTH, roomDepth);
    floor.position.set(0, ROOM_FLOOR_Y, roomCenterZ);
    floor.rotation.x = -Math.PI / 2;

    const ceiling = this.createPanel(ROOM_WIDTH, roomDepth);
    ceiling.position.set(0, ROOM_CEILING_Y, roomCenterZ);
    ceiling.rotation.x = Math.PI / 2;

    const leftWall = this.createPanel(roomDepth, roomHeight);
    leftWall.position.set(-ROOM_WIDTH / 2, roomCenterY, roomCenterZ);
    leftWall.rotation.y = Math.PI / 2;

    const rightWall = this.createPanel(roomDepth, roomHeight);
    rightWall.position.set(ROOM_WIDTH / 2, roomCenterY, roomCenterZ);
    rightWall.rotation.y = -Math.PI / 2;

    this.object.add(backWall, floor, ceiling, leftWall, rightWall);
  }

  dispose() {
    this.object.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }

  private createPanel(width: number, height: number): THREE.Mesh {
    const panel = new THREE.Mesh(this.geometry, this.material);
    panel.scale.set(width, height, 1);
    return panel;
  }
}
