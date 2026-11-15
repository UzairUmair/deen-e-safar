"use client";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { tr } from "../../features/i18n";
import { useResponsiveScene } from "../../hooks/useResponsiveScene";
import { OPEN_END, type Story } from "../three/story";
import { shelfBooks } from "./content";
import { HomeHero } from "./HomeHero";
import { InteractiveBookshelf } from "./InteractiveBookshelf";
import { QuranExplorerReveal } from "./QuranExplorerReveal";

// three.js, R3F and drei only ever load through this boundary.
const HomeScene = lazy(() => import("../three/HomeScene"));

const MOTES = [
  [12, 30, 0], [22, 62, 3], [31, 18, 6], [38, 74, 1], [47, 40, 4], [9, 80, 7], [27, 46, 2], [43, 12, 5],
];

/**
 * Hero → Quran → surah previews as one scroll-driven story. A single progress value
 * (0–1 across `.story-track`) drives both the 3D scene and the DOM timeline, so the
 * visitor's scroll position is the only clock and scrolling back reverses everything.
 */
export function QuranScrollSection({ go, rtl }: { go: (page: string) => void; rtl: boolean }) {
  const { mode, tall, lowPower } = useResponsiveScene();
  const root = useRef<HTMLDivElement>(null);
  const story = useRef<Story>({ target: 0, p: 0, open: 0 }).current;
  const invalidate = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const live = mode === "3d";

  const onReady = useCallback((fn: () => void) => {
    invalidate.current = fn;
    setReady(true);
  }, []);
  const select = useCallback((id: string | null) => setSelected(id), []);

  useEffect(() => {
    if (!live || !root.current) return;
    let cancelled = false;
    let revert = () => {};
    import("gsap").then(({ gsap }) => {
      if (cancelled || !root.current) return;
      let detach = () => {};
      const context = gsap.context(() => {
        // Positions and durations are fractions of the whole track (timeline length = 1).
        const tl = gsap.timeline({
          paused: true,
          defaults: { ease: "none" },
        });
        // The R3F frame controller is the only clock for both DOM and geometry.
        story.apply = (p) => tl.progress(p);
        tl.to({}, { duration: 1 }, 0);
        tl.to(".scroll-cue", { autoAlpha: 0, duration: 0.03 }, 0.005);
        tl.to(".hero-copy", { autoAlpha: 0, y: -24, duration: 0.1 }, 0.02);
        tl.to(".shelf-ui", { autoAlpha: 0, y: -28, duration: 0.06 }, 0.02);
        tl.to(".stage-night", { opacity: 1, duration: 0.2 }, 0.38);
        tl.fromTo(".guide-copy", { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.07 }, OPEN_END - 0.03);
        tl.fromTo(".surah-preview", { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.07, stagger: 0.022 }, OPEN_END + 0.07);
        // Keep the settled scene visible until native scrolling releases the sticky
        // stage. Fading everything before release leaves an empty viewport at 100%.
        tl.progress(story.p);
        const track = root.current!.querySelector<HTMLElement>(".story-track")!;
        let start = 0;
        let range = 1;
        let shelfActive = true;
        const sync = () => {
          // Cached bounds: no layout reads, React frames or scroll interception.
          const next = Math.min(1, Math.max(0, (window.scrollY - start) / range));
          if (shelfActive && next > 0.08) {
            setHovered(null);
            setSelected(null);
            document.body.style.cursor = "";
          }
          shelfActive = next <= 0.08;
          // Scrolling ordinary sections after the story must not redraw WebGL.
          if (next !== story.target) {
            story.target = next;
            invalidate.current();
          }
        };
        const measure = () => {
          // Layout offsets exclude the route entrance's temporary translation.
          // Reading a transformed rect here would leave a stale start after entry.
          start = 0;
          for (let node: HTMLElement | null = track; node; node = node.offsetParent as HTMLElement | null) start += node.offsetTop;
          range = Math.max(1, track.offsetHeight - window.innerHeight);
          sync();
          invalidate.current();
        };
        const observer = new ResizeObserver(measure);
        observer.observe(track);
        window.addEventListener("scroll", sync, { passive: true });
        window.addEventListener("resize", measure, { passive: true });
        window.visualViewport?.addEventListener("resize", measure, { passive: true });
        document.fonts.ready.then(() => { if (!cancelled) measure(); });
        measure();
        detach = () => {
          observer.disconnect();
          window.removeEventListener("scroll", sync);
          window.removeEventListener("resize", measure);
          window.visualViewport?.removeEventListener("resize", measure);
        };
      }, root);
      revert = () => { detach(); context.revert(); };
      root.current.dataset.timeline = "ready";
    });
    return () => {
      cancelled = true;
      revert();
      story.apply = undefined;
      invalidate.current = () => {};
      document.body.style.cursor = "";
    };
  }, [live, story]);

  return (
    <div className="story" data-mode={mode} ref={root}>
      <HomeHero go={go} />
      <div className="story-track">
        <div className="story-stage">
          <div className="stage-day" aria-hidden="true">
            <svg className="stage-arch" viewBox="0 0 400 520" fill="none">
              <path d="M20 520V230C20 110 110 40 200 8c90 32 180 102 180 222v290" stroke="currentColor" strokeWidth="1.2" />
              <path d="M52 520V238C52 136 126 76 200 46c74 30 148 90 148 192v282" stroke="currentColor" strokeWidth="0.7" />
            </svg>
            <span className="stage-star s1">✦</span>
            <span className="stage-star s2">✧</span>
            <span className="stage-star s3">✦</span>
          </div>
          <div className="stage-night" aria-hidden="true">
            <div className="stage-pattern" />
            <div className="stage-glow" />
            {MOTES.map(([x, y, d]) => (
              <i key={`${x}-${y}`} className="stage-mote" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${-d}s` }} />
            ))}
          </div>
          <div className="hero-area">
            <div className="story-visual">
              <img
                className="shelf-poster"
                data-hidden={live && ready}
                src="/home-bookshelf.webp"
                alt={tr("A cream and gold bookshelf holding four study books: Seerah, Hadith, Islamic History, and Quran Studies")}
                width={1100}
                height={640}
                fetchPriority="high"
              />
              {live && (
                <div className="story-canvas" data-ready={ready} aria-hidden="true">
                  <Suspense fallback={null}>
                    <HomeScene story={story} tall={tall} rtl={rtl} lowPower={lowPower} books={shelfBooks} raisedId={hovered || selected} onHover={setHovered} onSelect={select} onReady={onReady} />
                  </Suspense>
                </div>
              )}
              {live && !ready && (
                <p className="scene-loading" role="status">
                  <span aria-hidden="true" />
                  {tr("Preparing the 3D library…")}
                </p>
              )}
            </div>
            <InteractiveBookshelf books={shelfBooks} hovered={hovered} selected={selected} onHover={setHovered} onSelect={select} go={go} />
            {live && (
              <p className="scroll-cue">
                {tr("Scroll to open the Quran")}
                <ChevronDown size={16} aria-hidden="true" />
              </p>
            )}
          </div>
          <QuranExplorerReveal go={go} staticImage={mode === "static"} />
        </div>
      </div>
    </div>
  );
}
