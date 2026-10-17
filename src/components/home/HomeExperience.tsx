'use client';

import { useRef, type ReactNode } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from '@/lib/gsap';

export default function HomeExperience({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!root.current) return;
    const media = gsap.matchMedia();

    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo('[data-home-hero-reveal]', { opacity: 0.8, y: 16 }, {
        opacity: 1,
        y: 0,
        duration: 0.65,
        stagger: 0.07,
        ease: 'power2.out',
        clearProps: 'opacity,transform',
      });

      root.current?.querySelectorAll<HTMLElement>('[data-home-reveal]').forEach(section => {
        // Leave offscreen content readable; apply the entrance only when it reaches view.
        gsap.fromTo(section, { opacity: 0.8, y: 16 }, {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: 'power2.out',
          immediateRender: false,
          clearProps: 'opacity,transform',
          scrollTrigger: { trigger: section, start: 'top 90%', once: true },
        });
      });
    });

    media.add('(min-width: 1024px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
      const backdrop = root.current?.querySelector<HTMLElement>('[data-home-parallax]');
      if (!backdrop) return;
      const transformProperties = ['transform', 'translate', 'rotate', 'scale', 'transform-origin'];
      const originalStyles = transformProperties.map(property => ({
        property,
        value: backdrop.style.getPropertyValue(property),
        priority: backdrop.style.getPropertyPriority(property),
      }));
      // Only the decorative backdrop moves. Scale provides bleed inside the clipped hero.
      gsap.fromTo(backdrop, { yPercent: -1.5, scale: 1.04 }, {
        yPercent: 1.5,
        scale: 1.04,
        ease: 'none',
        scrollTrigger: {
          trigger: root.current?.querySelector('.home-hero'),
          start: 'top top',
          end: 'bottom top',
          scrub: 0.6,
        },
      });
      // Clear GSAP's transform cache before restoring only the owned inline properties.
      // Next/Image's load/placeholder styles must keep their current values.
      return () => {
        gsap.set(backdrop, { clearProps: 'transform' });
        originalStyles.forEach(({ property, value, priority }) => {
          if (value) backdrop.style.setProperty(property, value, priority);
          else backdrop.style.removeProperty(property);
        });
      };
    });

    // Revert only this component's animations, including media changes and route unmounts.
    return () => media.revert();
  }, { scope: root });

  return <div ref={root} className="flex min-h-screen flex-col bg-white">{children}</div>;
}
