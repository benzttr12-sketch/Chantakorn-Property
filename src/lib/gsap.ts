'use client';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

// Client consumers share registration; useGSAP uses an SSR-safe effect and owns cleanup.
gsap.registerPlugin(ScrollTrigger, useGSAP);

export { gsap, ScrollTrigger };
