import gsap from "gsap";
import * as THREE from "three";

import type { SectionName } from "./section";

type CameraPreset = {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  fovScale: number;
  duration: number;
};

export const BASE_CAMERA_DISTANCE = 5;

const CAMERA_PRESETS: Record<SectionName, CameraPreset> = {
  intro: {
    position: [0, 0, BASE_CAMERA_DISTANCE],
    target: [0, 0, 0],
    fovScale: 1,
    duration: 2.8,
  },
  call: {
    position: [-0.45, 0.15, 4.8],
    target: [-0.12, 0.05, 0],
    fovScale: 0.96,
    duration: 1.4,
  },
  response: {
    position: [0.45, -0.1, 4.8],
    target: [0.12, -0.03, 0],
    fovScale: 0.96,
    duration: 1.4,
  },
  march: {
    position: [0, -0.22, 4.6],
    target: [0, 0.08, 0],
    fovScale: 0.92,
    duration: 1.6,
  },
  finale: {
    position: [0, 0.18, 5.6],
    target: [0, 0, 0],
    fovScale: 1.04,
    duration: 2.2,
  },
};

export class CameraDirector {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly target = new THREE.Vector3();
  private baseFov = 75;
  private currentSection: SectionName = "intro";

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.applyPreset("intro");
  }

  setBaseFov(baseFov: number) {
    this.baseFov = baseFov;
    this.camera.fov = this.getPreset(this.currentSection).fovScale * baseFov;
    this.camera.updateProjectionMatrix();
  }

  enterSection(section: SectionName, immediate = false) {
    if (section === this.currentSection && !immediate) {
      return;
    }

    this.currentSection = section;
    const preset = this.getPreset(section);
    this.killTweens();

    if (immediate) {
      this.applyPreset(section);
      return;
    }

    const animationOptions = {
      duration: preset.duration,
      ease: "power2.out",
      overwrite: true,
      onUpdate: () => this.camera.lookAt(this.target),
    };

    gsap.to(this.camera.position, {
      x: preset.position[0],
      y: preset.position[1],
      z: preset.position[2],
      ...animationOptions,
    });
    gsap.to(this.target, {
      x: preset.target[0],
      y: preset.target[1],
      z: preset.target[2],
      ...animationOptions,
    });
    gsap.to(this.camera, {
      fov: this.baseFov * preset.fovScale,
      duration: preset.duration,
      ease: "power2.out",
      overwrite: true,
      onUpdate: () => this.camera.updateProjectionMatrix(),
    });
  }

  dispose() {
    this.killTweens();
  }

  private getPreset(section: SectionName) {
    return CAMERA_PRESETS[section];
  }

  private applyPreset(section: SectionName) {
    const preset = this.getPreset(section);
    this.camera.position.set(...preset.position);
    this.target.set(...preset.target);
    this.camera.fov = this.baseFov * preset.fovScale;
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
  }

  private killTweens() {
    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.target);
    gsap.killTweensOf(this.camera);
  }
}
