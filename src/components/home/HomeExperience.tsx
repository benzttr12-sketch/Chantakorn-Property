'use client';

import { useEffect, useRef, type ReactNode } from 'react';

export default function HomeExperience({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!root.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('home-section-enter');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -48px 0px' });
    root.current.querySelectorAll('[data-home-reveal]').forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return <div ref={root} className="flex min-h-screen flex-col bg-white">{children}</div>;
}
