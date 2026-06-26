## Two small sidebar tweaks

### 1. Replace Pin / PinOff with a sidebar-toggle icon
- Swap the `Pin` / `PinOff` icons in the header toggle for `PanelLeftClose` (when pinned) and `PanelLeft` (when auto-hide), matching the standard sidebar-collapse icon the user mocked up.
- Remove the now-unused `Pin` / `PinOff` imports.
- Keep all toggle behavior, tooltip copy, and `localStorage` persistence exactly as-is.

### 2. Stop the auto-hide overlay from colliding with the top nav
- The top header is `h-[72px]` and `sticky top-0 z-50`. The overlay currently uses `top: 0` (plus 48px when impersonating) and `z-40`, so it slides out under/over the header.
- Change the overlay's `top` offset to `72 + (isImpersonating ? 48 : 0)` so it starts right below the header.
- Drop a `border-t border-[#E5E7EB]` on the overlay so the seam under the header reads clean.
- Apply the same offset to the 8px edge-trigger hover zone so hovering the very top (header area) doesn't trigger the popout.
- No change to z-index — header stays above the overlay.

### File touched
- `src/components/buyer/BuyerSidebarLayout.tsx` (single file).
