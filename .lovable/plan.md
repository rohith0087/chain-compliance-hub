## Cleanest layout: sidebar owns the full left column, header only spans the content pane

Right now the top header is `sticky top-0` inside the right (content) column and spans its full width. The auto-hide overlay slides out at `left:0, top:0` with width 280 and height = viewport. The structural collision is that the header's leftmost ~208px sit *above* the overlay's top 72px, so the overlay's logo / "New Request" zone slips behind the header. Patching it by pushing the overlay down 72px is a band-aid — it leaves a dead strip and breaks the "full-height left column" feel.

The clean fix is to restructure the shell so the sidebar (rail + overlay) is the only thing that lives in the left column, and the top header is moved entirely inside the right content pane — never above the sidebar at all.

### Structural change

1. **Sidebar column is full-height and owns x = 0…(rail width).** The in-flow `<aside>` already does this; nothing changes here.
2. **Header moves into the right content pane only.** The current header is already in the right column DOM-wise, but it visually overlaps the sidebar area because of the overlay. We make this explicit by:
   - Removing `sticky top-0` framing assumptions that fight the overlay.
   - Keeping the header at `position: sticky; top: 0` *inside the content column*, so it naturally starts at the right edge of the sidebar rail (x = 72 in auto-hide, x = 280 in pinned). It never extends over the sidebar column.
3. **Auto-hide overlay returns to full-height (`top: 0`, height = viewport).** No more 72px offset. The overlay spans the full left edge of the screen and visually replaces the rail while open.
4. **z-index reorder so the overlay paints above the header in the overlap strip.**
   - Overlay: `z-50` (was z-40).
   - Edge trigger: `z-50` (was z-30) so hover still works once overlay is up.
   - Header: stays at `z-40` (lowered from z-50). The header is still above page content and the in-flow sidebar rail, but the overlay — which only exists during a deliberate hover — paints on top of the small left strip of the header it overlaps. Notification, search, branch selector, and profile controls all sit well to the right of x=280, so none of them are ever covered.

This matches the Notion/Linear pattern: a full-height left rail, and a header that lives strictly in the content pane.

### Edge-trigger detail
- Edge-trigger zone goes back to `top: 0, bottom: 0, left: 0, width: 8px` (full height).
- Raise its z-index to `z-50` so it still receives hover even when the header is layered nearby.

### Files touched
- `src/components/buyer/BuyerSidebarLayout.tsx` (single file).
  - Revert `overlayTopOffset` back to `isImpersonating ? 48 : 0`.
  - Remove the `top: overlayTopOffset` from the edge-trigger; restore `top-0 bottom-0`.
  - Remove the extra `border-t` on the overlay.
  - Bump overlay and edge-trigger to `z-50`; lower the top header to `z-40`.

### What stays untouched
- Hover timings (1100ms open / 300ms close), easing, animation properties, mode toggle, persistence, mobile sheet behavior, all navigation logic, and the visual look of header / sidebar / overlay themselves.
