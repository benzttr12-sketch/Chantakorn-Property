# Website interactions

Design reference: [Chantakorn interaction board in Figma](https://www.figma.com/design/YDeizyGXhXZe6B98uJTR7S?node-id=7-5). The board uses editable Prompt text, reusable card/viewer variants, brand variables, and an actual published property photo.

- Property cards retain their existing links, comparison and favorites. Hover/focus adds a subtle gold outline and elevation; saving a favorite gives one brief heart animation and exposes `aria-pressed`.
- The home hero uses a finite entrance sequence. Its primary call to action has a brief sheen on hover or keyboard focus.
- The property gallery supports touch swipes, a fullscreen viewer, 2× zoom and drag-to-pan. Arrow keys change photos, Escape closes the viewer, Tab remains within its controls, and closing restores the original focus and page scrolling.
- Changing photos resets zoom. Intentional horizontal swipes change photos; vertical scrolling and short gestures do not. Empty galleries show an explicit empty state.
- New effects honor `prefers-reduced-motion`. GSAP and `@gsap/react` own the homepage entrance/reveal effects; no animation runs in a continuous loop and no new service is required.

Verification covers gesture thresholds, empty/single-photo navigation, zoom reset, focus cycling, scroll restoration, and preventing a swipe from accidentally opening the viewer. Browser checks include desktop controls and a 390×844 mobile layout. The temporary Figma capture script is excluded from the source delivered to production.

## Homepage discovery

- The split hero lets visitors choose house, land or condo imagery and open the matching property search. Illustrative category photos are labeled; actual listing photos remain on the listing pages.
- Four shortcuts lead to featured properties, categories, locations and the matchmaker. Sections have header-aware scroll offsets and one GSAP entrance animation on first view. Content stays visible before hydration and without JavaScript.
- Featured filters show real catalog counts and a selected state. A single listing uses a card and a spotlight linked to its actual inquiry form. Cloud failures expose retry; empty categories allow returning to all listings.
- The location explorer changes the selected photo, description and search link. Neighborhood searches use district plus query text; counts use the same published-property fields as search.
- Search controls have associated labels and pressed states. Purchase/rental/consignment buttons wrap on small screens. New motion honors reduced-motion settings.

### GSAP homepage motion

- `HomeExperience` is the existing client boundary; `HeroSection` remains server-rendered. `useGSAP` scopes selectors and reverts this component's animations on unmount. It never clears other components' ScrollTriggers.
- Hero groups enter with a short stagger. Section/card motion starts from opacity 0.8 so text and controls remain readable. Offscreen reveals use `immediateRender: false`; completed entrances clear their inline opacity/transform.
- Featured card wrappers enter with a 0.06-second stagger when real results load or filters change. Loading, error and empty states retain their behavior. `revertOnUpdate` cleans up old result animations; the card's hover, favorite and compare controls keep their existing transforms.
- Only the decorative Hero backdrop uses scroll-linked parallax (scale 1.04, yPercent -1.5 to 1.5), gated to screens at least 1024px with hover/fine pointer. No pinning or scroll replacement is used; maps, valuation, pricing, data/API and staff flows are untouched.
- `gsap.matchMedia` removes motion and restores styles when `prefers-reduced-motion` changes, including while a tween is active. Smaller/touch screens retain finite entrances without parallax.

Review checks: open home at desktop, 390px and 320px; scroll once through sections; change property filters rapidly; test favorite/compare and links; navigate away and back; enable reduced motion before load and during motion; confirm content stays visible and no hydration errors occur. Business integrations require configured credentials for a live end-to-end check; use `NEXT_PUBLIC_DATA_BACKEND=local` for a development-only UI check without sending inquiries.

Manual smoke checks: switch all three hero options and confirm their links; follow every section shortcut; filter an empty category and recover; select each location and cycle previous/next; inspect the inquiry link; check 320px and 390px widths for horizontal overflow and visible controls.

Mobile fixed controls: the comparison dock clears the bottom navigation, and LINE moves above the dock while comparisons are selected. Both offsets account for `safe-area-inset-bottom`; clearing the selection restores LINE. The mobile menu exposes its expanded state and the bottom navigation identifies the current page.

Check the comparison action at 320×640, 360×800 and 390×844: its center must hit the actual button, the dock must sit above navigation, and LINE must sit above the dock. Open/close the comparison table and clear the selection. Viewport checks do not replace a physical iPhone safe-area test.
