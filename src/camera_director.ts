import gsap from "gsap";
import * as THREE from "three";

import type { SectionName, SectionRange } from "./section";

type CameraPreset = {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  fovScale: number;
  duration: number;
};

export const BASE_CAMERA_DISTANCE = 5.8;

const CAMERA_PRESETS: Record<SectionName, CameraPreset> = {
  intro: {
    position: [0, 0, BASE_CAMERA_DISTANCE],
    target: [0, 0, 0],
    fovScale: 1,
    duration: 2.8,
  },
  call: {
    position: [-1.1, 0.45, 4.3],
    target: [0.1, 0.05, 0],
    fovScale: 0.9,
    duration: 1.4,
  },
  response: {
    position: [1.1, -0.35, 4.3],
    target: [-0.1, -0.03, 0],
    fovScale: 0.9,
    duration: 1.4,
  },
  march: {
    position: [0, -0.55, 4],
    target: [0, 0.12, 0],
    fovScale: 0.84,
    duration: 1.6,
  },
  finale: {
    position: [0, 0.45, 6.2],
    target: [0, 0, 0],
    fovScale: 1.08,
    duration: 2.2,
  },
};

const NEXT_SECTION: Record<SectionName, SectionName> = {
  intro: "call",
  call: "response",
  response: "march",
  march: "finale",
  finale: "intro",
};

export class CameraDirector {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly target = new THREE.Vector3();
  private baseFov = 75;
  private currentSection: SectionName = "intro";
  private sectionRange: SectionRange | undefined;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.applyPreset("intro");
  }

  setBaseFov(baseFov: number) {
    this.baseFov = baseFov;
    this.camera.fov = this.getPreset(this.currentSection).fovScale * baseFov;
    this.camera.updateProjectionMatrix();
  }

  enterSection(sectionRange: SectionRange) {
    const section = sectionRange.section;
    const sectionChanged = section !== this.currentSection;
    this.sectionRange = sectionRange;
    this.currentSection = section;
    if (!sectionChanged) {
      return;
    }

    const preset = this.getPreset(section);
    this.killTweens();

    const animationOptions = {
      duration: preset.duration,
      ease: "power2.out",
      overwrite: true,
      onUpdate: () => this.camera.lookAt(this.target),
    };

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

  update(time: number) {
    if (this.sectionRange === undefined) {
      return;
    }

    const { section, startTime, endTime } = this.sectionRange;
    const duration = endTime - startTime;
    const progress = duration > 0
      ? THREE.MathUtils.clamp((time - startTime) / duration, 0, 1)
      : 1;
    const from = this.getPreset(section).position;
    const to = this.getPreset(NEXT_SECTION[section]).position;

    this.camera.position.set(
      THREE.MathUtils.lerp(from[0], to[0], progress),
      THREE.MathUtils.lerp(from[1], to[1], progress),
      THREE.MathUtils.lerp(from[2], to[2], progress),
    );
    this.camera.lookAt(this.target);
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
