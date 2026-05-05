# UI Polish Agent Memory

## Landing Page Patterns
- **Showcase cards** (`.landing-showcase`): column on mobile, row on desktop (769px+). Alternates with `.landing-showcase-reverse` for odd indices.
- **Showcase images** (`.landing-showcase-img`): `max-width: 280px` mobile, `320px` desktop. `border-radius: 16px`, `transform: scale(1.1)`, `box-shadow: 0 4px 20px rgba(0,0,0,0.08)`.
- **Interactive mockups** live in `src/components/pages/` — EstadoMockup, PagoMockup, IaMockup. They go inside `.landing-showcase-visual`.
- **Section background**: `.landing-showcases` uses `var(--lp-bg-card, #f8f9fb)`. Individual cards are `#fff`.
- **Desktop breakpoint for landing**: `@media (min-width: 769px)` (line ~10518 in App.css).

## CSS Technique: Image Crossfade Without Layout Shift
Use `display: grid` with `grid-area: 1 / 1` on all images to stack them in the same cell. Toggle `opacity` for fade. Both images always contribute to cell size, preventing layout shift. No need for `position: absolute/relative` switching.

## Toggle Pill Pattern (IaMockup)
- Background: `#e8eaef` (visible contrast against `#fff` card backgrounds)
- Indicator: white with `box-shadow: 0 1px 4px rgba(0,0,0,0.12)`
- Slide animation: `transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)`
- `translateX(N * 100%)` where N = active tab index (0 or 1)

## Landing Page CSS Variables
- `--lp-bg-card`: `#f8f9fb` (light gray sections)
- `--lp-text`: `#111` (primary text)
- `--lp-text-sec`: `#6b7280` (secondary text)
- `--lp-border`: `#e5e7eb`

## Mobile Touch Target
- Min 44px touch target recommended. Toggle buttons use `padding: 0.6rem 0` + `font-size: 0.875rem`.
- Add `-webkit-tap-highlight-color: transparent` on interactive mobile elements.
- Use `::before { inset: -Npx }` pseudo-element trick to expand touch target without changing visual size.

## VideoWidget Pattern (landing page)
- **File:** `src/components/pages/VideoWidget.jsx`, CSS at `/* Video Widget */` section in App.css (~line 10435)
- **States:** mini (fixed bottom-right) | collapsed (pill button bottom-center) | expanded (overlay)
- **z-index:** mini/collapsed = 1000, expanded overlay = 1100 (above landing nav at 200, below app modals at 1101+)
- **Expanded frame:** `border: 3px solid rgba(255,255,255,0.2)` + layered box-shadows for "frame" look
- **Buttons:** dark glass circles `rgba(0,0,0,0.55)` + `backdrop-filter: blur(6px)`, 42px in expanded, 28px in mini
- **Interaction:** mini player is fully clickable (expands), close/mute use `stopPropagation`. Escape key closes expanded.
- **Desktop breakpoint:** `@media (min-width: 768px)` — mini 180px wide, expanded max-width 440px

## App Layout Architecture (desktop)
- **Sidebar:** `position: fixed`, 260px wide (68px collapsed). Desktop at `min-width: 769px`.
- **Main content:** `flex: 1`, `margin-left: 260px` (68px when sidebar collapsed).
- **AI side panel:** `position: sticky`, 320px wide (769-1279px), 380px wide (1280px+). `flex-shrink: 0`.
- **Layout defaults:** sidebar collapsed when `< 1280px`, AI panel closed when `< 1400px`. Set in `Layout.jsx` with `useState(() => ...)`.

## Service Card (lavada-card) Responsive Rules
- **CRITICAL:** `.lavadas-cards` must stay single-column (`flex-direction: column`) on mobile/tablet. The 2-col grid at 481-768px was removed (Mar 2026) because card content is too dense.
- `.clientes-grid` and `.home-recent-list` CAN use 2-col grid at tablet — their cards are simpler.
- **Font scale for `.lavada-card-valor-mini`:** base 1.1rem, 1rem at <= 480px, 1.35rem at 769px+ desktop.
- Card header is `display: flex` on mobile, `display: grid; grid-template-columns: 1fr auto 1fr` on 769px+ desktop.

## App CSS Breakpoint Summary
- `max-width: 480px` — small phones (compact padding, smaller fonts)
- `481px to 768px` — tablet (2-col grid for clients/recent, NOT for service cards)
- `min-width: 769px` — desktop (sidebar visible, grid layout for cards, AI panel)
- `min-width: 1024px` — wider desktop (larger padding, filters visible)
- `min-width: 1280px` — large desktop (AI panel 380px instead of 320px)
