"use client";
import { useEffect, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { dampProgress, OPEN_END, OPEN_START, type Story } from "./story";

export const QURAN_Y = -10;

const DEG = Math.PI / 180;
const FOV = 30;
const VIEW = 2 * Math.tan((FOV * DEG) / 2);
const SHELF: Vec3 = [0, 0.02, 0];
const QURAN: Vec3 = [0, QURAN_Y + 0.28, 0];

type Vec3 = [number, number, number];
/**
 * A camera pose described by composition rather than raw coordinates: which object to
 * frame, from where, how much of the viewport it may fill (fw/fh) and where it sits
 * on screen (fx/fy, fractions from centre). This is what keeps resizing correct.
 */
type Key = { p: number; focus: Vec3; az: number; el: number; width: number; height: number; fw: number; fh: number; fx: number; fy: number };

const shelf = { focus: SHELF, width: 4.9, height: 2.6 };
const quran = { focus: QURAN, width: 3.7, height: 2.9 };

const WIDE: Key[] = [
  { p: 0, ...shelf, az: 0, el: 5, fw: 0.4, fh: 0.5, fx: 0.22, fy: -0.02 },
  { p: 0.05, ...shelf, az: 0, el: 5, fw: 0.4, fh: 0.5, fx: 0.22, fy: -0.02 },
  // Establish both subjects during the journey instead of framing the empty gap.
  { p: 0.17, focus: [0, QURAN_Y / 2, 0], width: 5.2, height: 13, az: -12, el: 15, fw: 0.7, fh: 0.84, fx: 0, fy: 0 },
  { p: OPEN_START, ...quran, az: -27, el: 25, fw: 0.36, fh: 0.56, fx: 0, fy: -0.03 },
  { p: OPEN_END, ...quran, az: -9, el: 40, fw: 0.38, fh: 0.6, fx: -0.23, fy: -0.02 },
  { p: 0.9, ...quran, az: -5, el: 42, fw: 0.38, fh: 0.6, fx: -0.23, fy: -0.02 },
  { p: 1, ...quran, az: -3, el: 44, fw: 0.32, fh: 0.5, fx: -0.23, fy: 0.03 },
];

// Portrait screens: objects fill the width and sit in the upper part, copy goes below.
const TALL: Key[] = [
  { p: 0, ...shelf, az: 0, el: 5, fw: 0.94, fh: 0.34, fx: 0, fy: 0.16 },
  { p: 0.05, ...shelf, az: 0, el: 5, fw: 0.94, fh: 0.34, fx: 0, fy: 0.16 },
  { p: 0.17, focus: [0, QURAN_Y / 2, 0], width: 5.2, height: 13, az: -12, el: 15, fw: 0.94, fh: 0.84, fx: 0, fy: 0 },
  { p: OPEN_START, ...quran, az: -27, el: 25, fw: 0.84, fh: 0.4, fx: 0, fy: 0.1 },
  { p: OPEN_END, ...quran, az: -9, el: 42, fw: 0.82, fh: 0.26, fx: 0, fy: 0.235 },
  { p: 0.9, ...quran, az: -5, el: 43, fw: 0.82, fh: 0.26, fx: 0, fy: 0.235 },
  { p: 1, ...quran, az: -3, el: 44, fw: 0.7, fh: 0.22, fx: 0, fy: 0.25 },
];

const smooth = (t: number) => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function CameraRig({
  story,
  tall,
  rtl,
  focus,
  shelfRef,
  quranRef,
}: {
  story: Story;
  tall: boolean;
  /** Mirrors the horizontal composition for right-to-left layouts. */
  rtl: boolean;
  focus: THREE.Vector3;
  shelfRef: RefObject<THREE.Group | null>;
  quranRef: RefObject<THREE.Group | null>;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const pointer = useRef({ x: 0, y: 0, sx: 0, sy: 0 });
  const intro = useRef(0);
  const coarse = useRef(false);
  const scratch = useRef({ right: new THREE.Vector3(), up: new THREE.Vector3() });
  const composition = useRef({ signature: "", elapsed: 1, from: new THREE.Vector3(), orientation: new THREE.Quaternion(), target: new THREE.Quaternion() });

  useEffect(() => {
    coarse.current = window.matchMedia("(pointer: coarse)").matches;
    // Perspective follows the pointer only where there is a real (fine) pointer.
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const move = (e: PointerEvent) => {
      if (story.target > 0.2 || e.pointerType === "touch") return;
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
      invalidate();
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [invalidate, story]);

  useEffect(() => {
    invalidate();
  }, [tall, rtl, invalidate]);

  useFrame(({ camera, size }, delta) => {
    const dt = Math.max(0, delta);
    const ease = 1 - Math.exp(-dt * 7);
    let moving = false;
    const blend = composition.current;
    const signature = `${size.width}/${size.height}/${tall}/${rtl}`;
    if (blend.signature && signature !== blend.signature) {
      blend.elapsed = 0;
      blend.from.copy(camera.position);
      blend.orientation.copy(camera.quaternion);
    }
    blend.signature = signature;

    story.p = dampProgress(story.p, story.target, dt, coarse.current ? 13 : 9);
    if (story.p !== story.target) moving = true;
    story.open = Math.min(1, Math.max(0, (story.p - OPEN_START) / (OPEN_END - OPEN_START)));
    story.apply?.(story.p);

    if (intro.current === 0 && story.target > 0.05) intro.current = 1;
    if (intro.current < 1) {
      intro.current = Math.min(1, intro.current + dt / 1.9);
      moving = true;
    }
    const settle = 1 - (1 - intro.current) ** 3;

    const pt = pointer.current;
    pt.sx += (pt.x - pt.sx) * ease;
    pt.sy += (pt.y - pt.sy) * ease;
    if (Math.abs(pt.x - pt.sx) + Math.abs(pt.y - pt.sy) > 0.002) moving = true;

    const keys = tall ? TALL : WIDE;
    let i = 0;
    while (i < keys.length - 2 && story.p > keys[i + 1].p) i++;
    const a = keys[i];
    const b = keys[i + 1];
    const t = smooth(Math.min(1, Math.max(0, (story.p - a.p) / (b.p - a.p))));
    const aspect = size.width / size.height;
    const fit = (k: Key) => Math.max(k.width / (k.fw * VIEW * aspect), k.height / (k.fh * VIEW));
    const parallax = 1 - smooth(Math.min(1, story.p / 0.2));
    const distance = mix(fit(a), fit(b), t) * (1 + 0.07 * (1 - settle) * parallax);
    const az = (mix(a.az, b.az, t) - 5 * (1 - settle) * parallax + pt.sx * 2.6 * parallax) * DEG;
    const el = (mix(a.el, b.el, t) - pt.sy * 1.6 * parallax) * DEG;

    focus.set(mix(a.focus[0], b.focus[0], t), mix(a.focus[1], b.focus[1], t), mix(a.focus[2], b.focus[2], t));
    camera.position.set(focus.x + distance * Math.sin(az) * Math.cos(el), focus.y + distance * Math.sin(el), focus.z + distance * Math.cos(az) * Math.cos(el));
    camera.lookAt(focus);
    camera.updateMatrix();
    // Slide the camera sideways (no re-aim) so the subject lands at its screen position.
    const { right, up } = scratch.current;
    right.setFromMatrixColumn(camera.matrix, 0);
    up.setFromMatrixColumn(camera.matrix, 1);
    camera.position.addScaledVector(right, (rtl ? 1 : -1) * mix(a.fx, b.fx, t) * distance * VIEW * aspect);
    camera.position.addScaledVector(up, -mix(a.fy, b.fy, t) * distance * VIEW);
    if (blend.elapsed < 0.24) {
      blend.elapsed = Math.min(0.24, blend.elapsed + dt);
      const amount = smooth(blend.elapsed / 0.24);
      camera.position.lerpVectors(blend.from, camera.position, amount);
      blend.target.copy(camera.quaternion);
      camera.quaternion.slerpQuaternions(blend.orientation, blend.target, amount);
      moving = true;
    }

    // Whichever object has left the frame is not drawn at all.
    if (shelfRef.current) shelfRef.current.visible = story.p < 0.36;
    if (quranRef.current) quranRef.current.visible = story.p > 0.05;

    if (moving) invalidate();
  }, -2); // Progress/camera before page deformation and lighting in this same frame.

  return null;
}

export const CAMERA_FOV = FOV;
