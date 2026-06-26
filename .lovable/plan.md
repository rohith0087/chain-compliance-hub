## Buyer Sidebar — Pinned vs Auto-Hide Icon Mode

Add a two-mode display system to `src/components/buyer/BuyerSidebarLayout.tsx`. Nothing about routing, permissions, accordion behavior, or visual styling from the recent refresh changes — this is purely about width, position, and hover choreography.

### Modes

1. **Pinned Mode** (default)
   - Sidebar is fixed at 280px in the normal flow.
   - All labels, group headings, dropdowns, help card, version line visible.
   - Main content is offset by 280px (current behavior).

2. **Auto-Hide Icon Mode**
   - Sidebar renders as a 72px icon rail in the flow (main content gains the extra 208px).
   - Only icons are visible: company logo, New Request `+`, every nav row icon (Workspace + Admin), help icon, and a small version dot. Submenu items and section labels are hidden in rail state.
   - On hover over the rail (or the 8px left-edge trigger zone) sustained for **1100ms**, an overlay panel slides out at 280px on top of the page content (`position: fixed`, soft shadow, same visual content as Pinned). Rail stays in place underneath so layout doesn't shift.
   - Overlay stays open while cursor is inside it; on mouse leave, wait **300ms** then slide back.
   - Toggle button switches between Pinned and Auto-Hide modes; the mode is persisted in `localStorage` (`buyer-sidebar-mode`).

### State & control

- New local state in `BuyerSidebarLayout`:
  - `mode: 'pinned' | 'auto-hide'` (persisted).
  - `overlayOpen: boolean` (only meaningful in auto-hide).
  - Two refs for the open-delay (1100ms) and close-delay (300ms) timers, plus a ref for the 8px edge trigger zone.
- Replace the existing `SidebarTrigger` in the header with a small toggle button (Pin / PinOff icon from lucide) that flips `mode`. Keep `SidebarTrigger` available for the mobile sheet behavior the shadcn `<Sidebar>` already provides (we don't touch `useIsMobile` paths).
- `prefers-reduced-motion`: when true, snap between states with no transition; popout still opens/closes but instantly.

### Rendering structure

Replace the current single `<Sidebar>` block with:

```text
<aside class="sidebar-rail"  width = mode==='pinned' ? 280 : 72 />   ← in-flow
{mode==='auto-hide' && (
  <div class="edge-trigger" />                                       ← 8px hover zone, fixed left:0
  <aside class="sidebar-overlay"
         data-open={overlayOpen}
         translateX = overlayOpen ? 0 : -280 />                      ← fixed, z-40, shadow-xl
)}
```

The rail and overlay share one render function `renderSidebarBody(variant: 'rail' | 'full')` that returns the existing header / New Request / Workspace group / Admin group / footer markup. `variant === 'rail'` hides all text/badges/submenus and centers icons inside a `w-12 h-11` button; `variant === 'full'` is the current 280px layout untouched.

The overlay always renders the `'full'` variant. The in-flow rail renders `'full'` when `mode === 'pinned'` and `'rail'` when `mode === 'auto-hide'`.

### Hover choreography

- `onMouseEnter` on rail or edge-trigger zone: clear close-timer; start open-timer (1100ms) → set `overlayOpen=true`.
- `onMouseLeave` on rail/edge-trigger AND overlay: clear open-timer; start close-timer (300ms) → set `overlayOpen=false`. Entering the overlay before the close timer fires cancels it (overlay and rail are siblings, so they each manage their own enter/leave but write to the same timers).
- Switching to Pinned mode while overlay is open clears both timers and unmounts the overlay/edge-trigger.

### Animation tokens

Define inline style or a small CSS block (no new global tokens):
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)`.
- Rail width transition: 220ms.
- Overlay translate-in: 260ms.
- Overlay translate-out: 220ms.
- Label/opacity fade tied to width transition.
- Wrap all durations in `@media (prefers-reduced-motion: reduce) { transition-duration: 0ms }`.

Only `width`, `transform`, and `opacity` animate.

### Edge cases

- Mobile (`useIsMobile`): force `mode = 'pinned'` semantics and skip the rail/overlay machinery — shadcn `<Sidebar>` already provides the offcanvas sheet; the toggle button hides.
- Impersonation banner offset (existing `pt-12` on the outer wrapper) is preserved; the overlay's `top` is set to `0` plus the same offset so it lines up with the rail.
- `activeDropdown` state stays as-is; in rail variant submenus are hidden so clicks just navigate.

### Technical notes

- File touched: `src/components/buyer/BuyerSidebarLayout.tsx` (single file).
- New icons from `lucide-react`: `Pin`, `PinOff`.
- Persist mode with a `useEffect` that reads/writes `localStorage.getItem('buyer-sidebar-mode')` on mount/change.
- No changes to `@/components/ui/sidebar`, no new dependencies, no schema/backend changes.

### What stays untouched

- `navigationItems`, submenu arrays, permission filtering, branch logic, accordion behavior, badges, top header (search palette, branch selector, notification center, profile dropdown, role switch), main content wrapper, mobile sheet behavior, visual styling from the previous refresh.
