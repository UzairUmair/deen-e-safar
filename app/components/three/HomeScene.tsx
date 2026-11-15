"use client";
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { BookshelfScene } from "./BookshelfScene";
import type { ShelfBook } from "./BookModel";
import { CAMERA_FOV, CameraRig, QURAN_Y } from "./CameraRig";
import type { Story } from "./story";
import { QuranBook } from "./QuranBook";
import { SceneLighting } from "./SceneLighting";

/**
 * Compiles every shader and uploads every texture up front. Otherwise that work lands
 * on the first frame in which the Quran scrolls into view and the scroll visibly hitches.
 */
function Warmup() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    gl.compile(scene, camera);
    scene.traverse((object) => {
      const material = (object as THREE.Mesh).material;
      for (const m of Array.isArray(material) ? material : material ? [material] : []) {
        for (const value of Object.values(m)) if (value instanceof THREE.Texture && value.image) gl.initTexture(value);
      }
    });
  }, [gl, scene, camera]);
  return null;
}

function Ready({ onReady }: { onReady: (invalidate: () => void) => void }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const frame = requestAnimationFrame(() => onReady(invalidate));
    return () => cancelAnimationFrame(frame);
  }, [invalidate, onReady]);
  return null;
}

/** Opt-in QA only; ordinary visits incur no DOM writes or telemetry. */
function MotionProbe({ story }: { story: Story }) {
  const enabled = useRef(false);
  const frame = useRef(0);
  useEffect(() => { enabled.current = new URLSearchParams(location.search).has("motion-debug"); }, []);
  useFrame(({ gl }) => {
    if (!enabled.current) return;
    gl.domElement.dataset.motion = JSON.stringify({ frame: ++frame.current, p: story.p, target: story.target, open: story.open, calls: gl.info.render.calls, triangles: gl.info.render.triangles, ...gl.info.memory });
  });
  return null;
}

/**
 * The single WebGL canvas behind the homepage story: bookshelf and Quran live in one
 * world so the camera can travel between them. Loaded lazily; renders on demand only.
 */
export default function HomeScene({
  story,
  tall,
  rtl,
  lowPower,
  books,
  raisedId,
  onHover,
  onSelect,
  onReady,
}: {
  story: Story;
  tall: boolean;
  rtl: boolean;
  lowPower: boolean;
  books: ShelfBook[];
  raisedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onReady: (invalidate: () => void) => void;
}) {
  const focus = useMemo(() => new THREE.Vector3(), []);
  const shelfRef = useRef<THREE.Group>(null);
  const quranRef = useRef<THREE.Group>(null);
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, lowPower ? 1.25 : 1.5]}
      shadows={lowPower ? false : { type: THREE.PCFShadowMap }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ fov: CAMERA_FOV, near: 0.5, far: 90, position: [0, 0, 16] }}
      resize={{ scroll: false, debounce: { scroll: 0, resize: 60 } }}
      style={{ touchAction: "pan-y" }}
    >
      <CameraRig story={story} tall={tall} rtl={rtl} focus={focus} shelfRef={shelfRef} quranRef={quranRef} />
      <SceneLighting focus={focus} shadows={!lowPower} />
      <group ref={shelfRef}>
        <BookshelfScene books={books} raisedId={raisedId} interactive={() => story.p < 0.08} onHover={onHover} onSelect={onSelect} />
      </group>
      <group ref={quranRef} position={[0, QURAN_Y, 0]}>
        <QuranBook story={story} lowPower={lowPower} />
      </group>
      <Warmup />
      <Ready onReady={onReady} />
      <MotionProbe story={story} />
    </Canvas>
  );
}
