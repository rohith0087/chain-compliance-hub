

# Sidebar Dropdown Hover UX Improvements

## Current State
Both `BuyerSidebarLayout.tsx` and `SupplierSidebarLayout.tsx` have identical hover logic:
- **Open delay**: 150ms (too fast, causes accidental triggers)
- **Close delay**: 200ms (too short, menu disappears if cursor slips)
- **Animation**: None -- submenu renders/unmounts instantly via conditional `{isSubmenuExpanded(item) && <SidebarMenuSub>}`
- **Chevron rotation**: 200ms transition only

## Changes

### 1. Increase hover delays
- **Open delay**: 150ms → **1000ms** (1 second hover intent)
- **Close delay**: 200ms → **500ms** (graceful buffer before closing)

Both files, same pattern -- update the `setTimeout` values in `handleMouseEnter` and `handleMouseLeave`.

### 2. Animate submenu expand/collapse
Currently submenus are conditionally rendered (`&& <SidebarMenuSub>`), causing instant mount/unmount with no transition. Replace with:
- Always render `<SidebarMenuSub>` but wrap in a container with `max-height`, `opacity`, and `overflow-hidden` transitions
- Use CSS grid trick (`grid-template-rows: 0fr` → `1fr`) for smooth height animation
- **Duration**: 400ms with `cubic-bezier(0.4, 0, 0.2, 1)` (ease-out feel -- snappy start, soft settle)

Implementation: wrap the `SidebarMenuSub` in a `div` with transition classes:
```
<div className={`grid transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
  isSubmenuExpanded(item) ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
}`}>
  <div className="overflow-hidden">
    <SidebarMenuSub ...> ... </SidebarMenuSub>
  </div>
</div>
```

### 3. Match chevron animation duration
Update ChevronDown transition from `duration-200` to `duration-[400ms]` with the same easing.

### Files Modified
- `src/components/buyer/BuyerSidebarLayout.tsx` -- update delays + add animated submenu wrapper
- `src/components/supplier/SupplierSidebarLayout.tsx` -- same changes

