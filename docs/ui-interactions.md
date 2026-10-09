# Website interactions

Design reference: [Chantakorn interaction board in Figma](https://www.figma.com/design/YDeizyGXhXZe6B98uJTR7S?node-id=7-5). The board uses editable Prompt text, reusable card/viewer variants, brand variables, and an actual published property photo.

- Property cards retain their existing links, comparison and favorites. Hover/focus adds a subtle gold outline and elevation; saving a favorite gives one brief heart animation and exposes `aria-pressed`.
- The home hero uses a finite entrance sequence. Its primary call to action has a brief sheen on hover or keyboard focus.
- The property gallery supports touch swipes, a fullscreen viewer, 2× zoom and drag-to-pan. Arrow keys change photos, Escape closes the viewer, Tab remains within its controls, and closing restores the original focus and page scrolling.
- Changing photos resets zoom. Intentional horizontal swipes change photos; vertical scrolling and short gestures do not. Empty galleries show an explicit empty state.
- New effects honor `prefers-reduced-motion`. No added animation runs continuously; no new library or service is required.

Verification covers gesture thresholds, empty/single-photo navigation, zoom reset, focus cycling, scroll restoration, and preventing a swipe from accidentally opening the viewer. Browser checks include desktop controls and a 390×844 mobile layout. The temporary Figma capture script is excluded from the source delivered to production.
