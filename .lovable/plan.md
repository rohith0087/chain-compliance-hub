
## Buyer Sidebar — Compact Premium Refresh

Purely visual refresh of `src/components/buyer/BuyerSidebarLayout.tsx`. All routes, navigation logic, permissions, accordion-on-click behavior, hover-to-open timing, branch logic, header, and main-content area stay exactly as they are. No new dependencies, no schema/backend changes.

The existing structure already supports everything the spec needs (single-open accordion via `activeDropdown` state, nested submenu items, help card, version button) — I only restyle the surfaces and reorganize the section labels.

### 1. Sidebar surface
- `<Sidebar>` background → `bg-[#FAFAFB]`, right border `border-[#E5E7EB]`.

### 2. Compact buyer header (≈72px)
- `SidebarHeader`: `px-4 py-3 border-b border-[#E5E7EB]`.
- Logo container `h-10 w-10 rounded-xl` (was `h-8 w-8`).
- Company name `text-[15px] font-semibold text-slate-900`.
- User name `text-[13px] text-slate-500`.

### 3. New Request button
- Replace the gradient + blurred icon with a solid pill: `h-12 rounded-[14px] bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-[15px] shadow-sm`.
- Plus icon in a soft circle: `h-7 w-7 rounded-full bg-white/15 flex items-center justify-center`, icon `h-4 w-4`.
- Wrap in `px-3 pt-3 pb-1` so it doesn't hug the edges.
- Branch badge styling unchanged.

### 4. Workspace + Admin grouping
- Split `navigationItems` rendering into two `<SidebarGroup>`s without changing the array contents:
  - **Workspace** group: Dashboard, Suppliers, Requests & Documents, Compliance, Onboarding Pipeline, Messages.
  - **Admin** group: Settings.
- Group label style: `px-4 pt-5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400`.
- Filter is just `item.value === 'settings'` for Admin, everything else for Workspace — preserves existing permission filtering.

### 5. Nav item rows
- `SidebarMenuButton` class becomes `h-11 px-3 rounded-xl gap-3 text-[15px] font-medium`.
- Icon `h-5 w-5` (was `h-4 w-4`), keep the existing hover scale.
- Default text `text-slate-700`, hover `hover:bg-[#F1F5F9]`.
- Active state: drop the blurred glow and gradient bar. Replace with:
  - 3px left rail: `absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary`.
  - Button surface `bg-primary/10 text-primary font-semibold`.
- Chevron stays right-aligned; rotation animation unchanged.
- Badge unchanged.

### 6. Nested submenu items
- `SidebarMenuSub` wrapper: `ml-9 mt-1 pl-3 border-l border-[#E5E7EB]` for a subtle indent guide.
- Each sub button: `h-8 px-3 rounded-lg text-[14px] text-slate-500 hover:text-slate-900 hover:bg-[#F1F5F9]`; active sub `text-primary font-medium bg-primary/5`.
- Keep the existing `grid-rows-[0fr] → grid-rows-[1fr]` open/close animation (already soft) and the single-open accordion behavior via `activeDropdown`.

### 7. Compact help card
- Replace the centered card in `SidebarFooter` with a horizontal row:
  ```tsx
  <button onClick={() => navigate('/help')}
    className="w-full rounded-2xl bg-white border border-[#E5E7EB] p-3 flex items-center gap-3 hover:bg-[#F1F5F9] transition-colors text-left">
    <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
      <HelpCircle className="h-5 w-5" />
    </div>
    <div className="min-w-0">
      <div className="text-[14px] font-semibold text-slate-900">Need help?</div>
      <div className="text-[12px] text-slate-500 truncate">Docs & guides</div>
    </div>
  </button>
  ```
- Hidden when sidebar is `collapsed` (same guard as today).

### 8. Tiny version line
- Replace `VersionButton`'s big pill rendering with a small muted line: `<button className="w-full px-1 py-1 text-[12px] text-slate-400 hover:text-slate-600 transition-colors text-left">TraceR2C v{APP_VERSION}</button>`.
- Still opens `WhatsNewDialog` on click — no behavioral change.

### 9. Footer container
- `SidebarFooter` → `p-3 space-y-2 border-t border-[#E5E7EB]`.

### Color handling
- The brand blue already maps to the `--primary` / `--primary-hover` design tokens — reuse those (no hardcoded `#3154D4`).
- Neutrals (`#FAFAFB`, `#E5E7EB`, `#F1F5F9`, `#9CA3AF`) are slate values closely matching existing slate-50/200/100/400; used inline as arbitrary Tailwind values only where slate utilities don't match exactly, to keep the spec's exact tone without adding new global tokens.

### What stays untouched
- `navigationItems` array, submenu arrays, permission filtering, branch logic, hover-to-open timing, accordion state, single-open behavior, badges, top header, search palette, branch selector, notification center, profile dropdown, role switch, main content wrapper, mobile/collapsed behavior (SidebarTrigger still in header).

### File touched
- `src/components/buyer/BuyerSidebarLayout.tsx` — single file edit.
