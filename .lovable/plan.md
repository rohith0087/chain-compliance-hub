## Pure-white body background

Change the app body background token from the current cool off-white (`230 30% 98%`) to pure white (`0 0% 100%`) so the body reads cleaner and lets cards/sidebar stand out more.

### Change
- `src/index.css`: update `--background` in the `:root` block from `230 30% 98%` → `0 0% 100%`.
- Dark mode `--background` stays untouched.
- The second `--background` redefinition further down (`210 20% 98%`) is part of a separate design-token block — also align it to `0 0% 100%` so there's no conflict.

### Why this is enough
All page surfaces (`<body>`, dashboard root, modal/page wrappers) already use `bg-background`, so flipping the token cascades app-wide with no component edits.

### What stays untouched
- Sidebar surface (`#FAFAFB`), cards (`--card` = white), borders, and every other token.
