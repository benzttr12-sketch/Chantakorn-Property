'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import styles from './ScrollVideoHero.module.css';

export default function ScrollVideoHero({
  children,
  poster,
  videoSrc,
}: {
  children: ReactNode;
  poster: ReactNode;
  videoSrc: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const stage = stageRef.current;
    const video = videoRef.current;
    if (!track || !stage || !video || !video.canPlayType('video/mp4')) return;

    const motion = window.matchMedia('(prefers-reduced-motion: no-preference) and (min-height: 600px)');
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    let frame = 0;

    function update() {
      frame = 0;
      if (!track || !stage || !video || !track.dataset.scrub || !Number.isFinite(video.duration)) return;

      const distance = track.offsetHeight - stage.offsetHeight;
      if (distance <= 0) return;
      const inset = parseFloat(window.getComputedStyle(stage).top);
      const progress = Math.min(1, Math.max(0, (inset - track.getBoundingClientRect().top) / distance));
      stage.style.setProperty('--hero-progress', String(progress));

      const time = progress * Math.max(0, video.duration - 1 / 24);
      if (!video.seeking && Math.abs(video.currentTime - time) > 1 / 30) video.currentTime = time;
    }

    function scheduleUpdate() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }

    function reset() {
      window.cancelAnimationFrame(frame);
      frame = 0;
      track?.removeAttribute('data-scrub');
      stage?.style.removeProperty('--hero-progress');
      video?.removeAttribute('data-visible');
    }

    function syncPreference() {
      if (!track || !video) return;

      if (motion.matches && !connection?.saveData) {
        track.dataset.scrub = 'true';
        video.src = videoSrc;
        scheduleUpdate();
      } else {
        reset();
        video.removeAttribute('src');
        video.load();
      }
    }

    function showFrame() {
      if (track?.dataset.scrub && video) video.dataset.visible = 'true';
      scheduleUpdate();
    }

    video.addEventListener('loadedmetadata', scheduleUpdate);
    video.addEventListener('loadeddata', showFrame);
    video.addEventListener('seeked', showFrame);
    video.addEventListener('error', reset);
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    motion.addEventListener('change', syncPreference);
    syncPreference();

    return () => {
      reset();
      motion.removeEventListener('change', syncPreference);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      video.removeEventListener('loadedmetadata', scheduleUpdate);
      video.removeEventListener('loadeddata', showFrame);
      video.removeEventListener('seeked', showFrame);
      video.removeEventListener('error', reset);
      video.removeAttribute('src');
      video.load();
    };
  }, [videoSrc]);

  return (
    <div ref={trackRef} className={styles.track}>
      <div ref={stageRef} className={styles.stage}>
        <div aria-hidden="true" className={styles.media}>
          {poster}
          <video ref={videoRef} className={styles.video} muted playsInline preload="metadata" tabIndex={-1} />
        </div>
        {children}
        <div aria-hidden="true" className={styles.progress}><span /></div>
      </div>
    </div>
  );
}
