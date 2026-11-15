import { describe, expect, it } from "vitest";
import { dampProgress } from "../../app/components/three/story";
import { BOOK, computeRig, sampleCurve } from "../../app/components/three/quranRig";

describe("coordinated motion", () => {
  it("settles identically at 30, 60 and 144 Hz and on a slow frame", () => {
    const run = (hz: number, rate = 9) => {
      let p = 0;
      for (let i = 0; i < hz; i++) p = dampProgress(p, 1, 1 / hz, rate);
      return p;
    };
    for (const rate of [9, 13]) {
      expect(run(30, rate)).toBeCloseTo(run(144, rate), 10);
      expect(run(60, rate)).toBeCloseTo(dampProgress(0, 1, 1, rate), 10);
    }
    expect(dampProgress(0, 1, 1 / 3)).toBeCloseTo(0.95, 2);
  });
  it("never overshoots on rapid 20/80/45/0 reversals", () => {
    let p = 0;
    for (const target of [.2, .8, .45, 0]) {
      for (let i = 0; i < 12; i++) {
        const next = dampProgress(p, target, 1 / 60);
        expect(next).toBeGreaterThanOrEqual(Math.min(p, target));
        expect(next).toBeLessThanOrEqual(Math.max(p, target));
        p = next;
      }
    }
  });
  it("keeps the hinge attached and geometry reversible across every opening state", () => {
    const forward = Array.from({ length: 201 }, (_, i) => computeRig(i / 200, 6));
    for (let i = 200; i >= 0; i--) {
      const rig = computeRig(i / 200, 6);
      expect(rig).toEqual(forward[i]);
      expect(Math.hypot(rig.hingeFront[0] - rig.hingeBack[0], rig.hingeFront[1] - rig.hingeBack[1])).toBeCloseTo(BOOK.thickness, 12);
      for (const curve of [rig.right, rig.left, ...rig.leaves]) {
        const points = new Float32Array(34), arc = new Float32Array(17);
        sampleCurve(rig.root, curve, BOOK.pageWidth, 16, points, arc);
        expect([...points].every(Number.isFinite)).toBe(true);
        expect(arc[16]).toBe(1);
      }
      if (i) expect(Math.abs(rig.cover - forward[i - 1].cover)).toBeLessThan(.025);
    }
  });
  it("mobile and desktop sampling land on the same page tips", () => {
    for (let i = 0; i <= 100; i++) {
      const rig = computeRig(i / 100, 6);
      for (const curve of [rig.right, rig.left, ...rig.leaves]) {
        const tip = (n: number) => {
          const points = new Float32Array((n + 1) * 2);
          sampleCurve(rig.root, curve, BOOK.pageWidth, n, points, new Float32Array(n + 1));
          return [points[n * 2], points[n * 2 + 1]];
        };
        const a = tip(16), b = tip(96);
        expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(.00001);
      }
    }
  });
});
