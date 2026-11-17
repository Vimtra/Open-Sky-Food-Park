---
name: Open Sky Food Park
description: One cart for every food truck at the park, under string lights in Milpitas.
colors:
  night-950: "#070B1F"
  night-900: "#0B1230"
  night-800: "#131C45"
  night-700: "#1E2A5E"
  night-muted: "#A9B1D6"
  ink-900: "#0E1330"
  ink-700: "#3A4060"
  ink-500: "#666C88"
  ink-300: "#B8BCCB"
  surface-0: "#FFFFFF"
  surface-1: "#F5F6FA"
  surface-2: "#ECEEF5"
  line: "rgba(14,19,48,0.11)"
  line-strong: "rgba(14,19,48,0.28)"
  ember-50: "#FFF4EA"
  ember-100: "#FFE6D0"
  ember-400: "#FF9A3D"
  ember-500: "#FF7A1A"
  ember-600: "#F06405"
  ember-700: "#C2470A"
  gold-400: "#FFC247"
  leaf-50: "#E8F6EE"
  leaf-600: "#0C8048"
  leaf-700: "#086B3B"
  chili-50: "#FDECEA"
  chili-600: "#C8281E"
  egg-600: "#B26A00"
typography:
  hero:
    fontFamily: "Figtree, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "3.5rem"
    fontWeight: 800
    lineHeight: "3.75rem"
    letterSpacing: "-0.03em"
  display:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 800
    lineHeight: "2.375rem"
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: "1.875rem"
    letterSpacing: "-0.02em"
  heading:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 800
    lineHeight: "1.625rem"
    letterSpacing: "-0.015em"
  subheading:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: "1.5rem"
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: "1.5rem"
  label:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: "1.25rem"
  small:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: "1.125rem"
  caption:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
    letterSpacing: "0.01em"
  token:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 800
    lineHeight: "2.5rem"
    letterSpacing: "-0.03em"
  step-number:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "6rem"
    fontWeight: 800
    lineHeight: 0.85
    letterSpacing: "-0.04em"
  logo-lettering:
    fontFamily: "Montserrat, sans-serif"
    fontWeight: 400
rounded:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  full: "999px"
spacing:
  gutter-phone: "16px"
  gutter-desktop: "24px"
  container: "1200px"
  container-menu: "840px"
  container-cart: "1000px"
  container-order: "720px"
components:
  button-primary:
    backgroundColor: "{colors.ember-500}"
    textColor: "{colors.night-900}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.ember-400}"
  button-primary-active:
    backgroundColor: "{colors.ember-600}"
  button-primary-lg:
    backgroundColor: "{colors.ember-500}"
    textColor: "{colors.night-900}"
    rounded: "{rounded.md}"
    height: "52px"
    padding: "0 20px"
  button-dark:
    backgroundColor: "{colors.night-900}"
    textColor: "{colors.surface-0}"
    rounded: "{rounded.md}"
    height: "44px"
  button-outline:
    backgroundColor: "{colors.surface-0}"
    textColor: "{colors.ink-900}"
    rounded: "{rounded.md}"
    height: "44px"
  chip:
    backgroundColor: "{colors.surface-0}"
    textColor: "{colors.ink-700}"
    rounded: "{rounded.full}"
    height: "36px"
    padding: "0 14px"
  chip-selected:
    backgroundColor: "{colors.night-900}"
    textColor: "{colors.surface-0}"
  input:
    backgroundColor: "{colors.surface-0}"
    textColor: "{colors.ink-900}"
    rounded: "{rounded.md}"
    height: "48px"
    padding: "0 14px"
  truck-card:
    backgroundColor: "{colors.surface-0}"
    textColor: "{colors.ink-900}"
    rounded: "{rounded.xl}"
    padding: "24px"
  dish-reel:
    backgroundColor: "{colors.night-900}"
    textColor: "{colors.surface-0}"
    rounded: "{rounded.xl}"
    padding: "20px"
  site-header:
    backgroundColor: "{colors.night-900}"
    textColor: "{colors.surface-0}"
---

# Design System: Open Sky Food Park

## Overview

**Creative North Star: "Dinner under the string lights"**

Open Sky is an outdoor food truck park at night: navy sky, warm bulbs strung between palms, glowing truck windows, food on picnic tables. The interface borrows that scene only where it earns it: the header, the footer, and photo heroes, which are dark because the photos are night photos. Everything people actually read and tap sits on clean, light surfaces. The night frames the experience; the light pages do the work.

The page leads with food and trucks, not with marketing. Real photography of real menu dishes carries the appetite, type is bold and plain (one family, Figtree, heavy at the top), and ember orange from the logo marks the things you can do: add, order, pay, view a menu. Motion is quick and purposeful, in the style of a native app: presses answer in 150ms, things enter softly and leave faster, and clips play only while you can see them.

The owner rejected dark navy page backgrounds for the customer site (2026-11-17). The light theme is a fixed decision, not a default to revisit.

**Key Characteristics:**
- Light pages; navy only in the header, footer and photo heroes.
- Ember orange means "action". Ember buttons carry navy text, never white.
- Photo-led: every dish, truck and craving has a real photo; nothing is decorative stock.
- One type family, weight-driven hierarchy, tight negative tracking on big type.
- Alpha borders, concentric radii, OKLCH colour, quiet shadows.
- No invented content: no ratings, reviews, hours, descriptions or allergen claims that the owner has not supplied.

## Colors

A night-sky navy and a warm ember orange, both taken from the logo, over cool near-white surfaces with navy-tinted ink.

The hex values above match `shared/design-tokens.json`, which both the web and the Flutter app read from. Change colours there first, then mirror them. The web writes the same colours in OKLCH in `web/src/app/globals.css` so equal lightness steps look equal.

### Primary
- **Ember** (`ember-500` #FF7A1A · `oklch(72.4% 0.187 48.9)`): primary action fill (Start your order, View menu, Cart, Pay). Hover lightens to `ember-400`, press deepens to `ember-600`.
- **Deep Ember** (`ember-700` #C2470A): orange text and icons on white ("Full menu" links, the active-section underline's text pair). It passes contrast where `ember-500` would not.
- **Ember Tints** (`ember-50`, `ember-100`): payment panel background, focus ring on inputs.

### Secondary
- **Night Sky** (`night-900` #0B1230): header band, footer, photo-hero base and scrims, selected chips, the "dark" button. `night-950` / `night-800` / `night-700` are its pressed, hover and raised steps; `night-muted` is secondary text on navy.

### Tertiary
- **String-Light Gold** (`gold-400` #FFC247): used sparingly for warm highlights on navy; never on white text.

### Status
- **Leaf** (`leaf-600` #0C8048): open now, ready tokens, veg mark, Add button text. `leaf-50` is the ready-card tint.
- **Chili** (`chili-600` #C8281E): errors, sold out, non-veg mark. `chili-50` for error tints.
- **Egg** (`egg-600` #B26A00): the egg diet mark.

### Neutral
- **Ink** (`ink-900` #0E1330 primary text, `ink-700` secondary, `ink-500` meta at ≥4.5:1 on white, `ink-300` disabled).
- **Surfaces** (`surface-0` white page and cards, `surface-1` quiet fills such as search fields and the bill, `surface-2` pressed and disabled fills).
- **Lines** (`line`: ink-900 at 11% for every border and divider; `line-strong` at 28% for hover and emphasis).

### Named Rules
**The Ember Means Act Rule.** Ember fills only things you can press or that confirm an action. Never use it for decoration, section backgrounds or body text.

**The Navy Text On Ember Rule.** Text on `ember-500` is `night-900`. White on ember fails contrast and is never used.

**The Night Frames, Light Works Rule.** Navy belongs to the header, the footer and photo heroes. Page backgrounds, sections and content cards stay on `surface-0` / `surface-1`.

## Typography

**Display and body font:** Figtree (with system-ui, -apple-system, Segoe UI, Roboto, sans-serif)
**Logo lettering:** Montserrat 400, only inside the logo component for "FOOD PARK" and the tagline.

**Character:** One friendly geometric sans, made to feel bold by weight and tracking rather than by mixing families. Big type is extra-bold with tight negative tracking; reading text is regular weight at comfortable sizes.

### Hierarchy
- **Hero** (800, 2rem phone / 3.5rem desktop, 1.07 line height, −0.03em): one per page, the home hero headline.
- **Display** (800, 2rem, −0.025em): page titles on desktop (stall name, cart, order status).
- **Title** (800, 1.5rem, −0.02em): page titles on phones, section headings on desktop.
- **Heading** (800, 1.25rem, −0.015em): section headings on phones, truck card names.
- **Subheading** (700, 1.125rem): dish names in reels, menu section names, step titles.
- **Body** (400, 1rem / 1.5rem): paragraphs and inputs. Keep lines under about 65 characters (`max-w-md` for hero copy).
- **Label** (600, 0.875rem): buttons, chips, tabs, meta that must stay readable.
- **Small / Caption** (400, 0.8125rem / 0.75rem): secondary meta (truck name under a dish, dish counts).
- **Token** (800, 2.5rem, −0.03em, tabular numbers): the pickup token number on order pages.
- **Step number** (800, 4.5rem phone / 6rem desktop, 0.85 line height, −0.04em): the "How it works" numerals, filled with an ember gradient from `ember-400` to `ember-700` in OKLCH.

### Named Rules
**The No Kicker Rule.** No small uppercase eyebrow labels above headings. The heading says it.

**The Tabular Money Rule.** Prices, totals, counts and token numbers use tabular figures so they line up and don't shift.

## Layout

- **Container:** centred, max 1200px, with 16px gutters on phones and 24px from 768px. Focused pages narrow it: stall menu 840px, cart 1000px, order 720px.
- **Breakpoints:** Tailwind defaults; the layout switches at `md` (768px) and `lg` (1024px). Phones get a bottom navigation bar and a full-bleed photo hero; desktop gets the search box and links in the header.
- **Rhythm:** 4px base. Sections on the home page are 48px apart on phones and 64px on desktop. Cards use 16px inner padding on phones and 24px on desktop.
- **Rails:** horizontal lists (cravings, combos, dishes) scroll sideways with hidden scrollbars, edge fades, and arrow buttons on desktop. On phones the dish reels snap one tile at a time.
- **Home order:** photo hero with the truck cards overlapping its bottom edge → What's on your mind? → How it works → Fresh off the trucks (video reels) → Combos and specials → one dish rail per truck.
- **Full height:** use `100dvh`, never `100vh`.

## Elevation & Depth

Mostly flat: depth comes from tonal surfaces and alpha borders. Shadows are reserved for things that float over something else: a card overlapping the hero photo, a button lifted off a photo, the sticky cart bar. On navy, depth comes from lighter surfaces (`night-800`, `night-700`), not shadows.

### Shadow Vocabulary
- **sm** (`0 1px 2px rgb(14 19 48 / 0.08)`): switch knobs, the Add button in the combos rail, new tickets on the stall dashboard.
- **md** (`0 6px 16px -6px rgb(14 19 48 / 0.18), 0 2px 4px rgb(14 19 48 / 0.06)`): the Add button that overlaps a dish photo, stall logos on cover photos.
- **lg** (`0 18px 40px -14px rgb(14 19 48 / 0.3), 0 4px 10px rgb(14 19 48 / 0.08)`): reserved for larger floating panels; currently the floating cart bar on phones.
- **up** (`0 -6px 20px -8px rgb(14 19 48 / 0.18)`): the cart page's fixed checkout bar on phones.
- **Truck card lift** (`0 18px 40px -18px oklch(19.6% 0.06 270.1 / 0.45)`): the truck cards overlapping the hero.
- **Ember glow** (`0 8px 24px -6px oklch(72.4% 0.187 48.9 / 0.6)`): only the hero's "Start your order" button, over the night photo.

### Named Rules
**The Float Earns A Shadow Rule.** A surface gets a shadow only when it sits over other content. Cards in a list on a white page use a `line` border, not a shadow.

## Shapes

- **Radius scale:** 6 / 8 / 12 / 16 / 24px (`xs` to `xl`), plus fully round for chips, avatars, logos and craving photos.
- **Concentric corners:** an inner radius is the outer radius minus the padding between them. A 24px card with a 16px inset holds 8px corners. Content clipped flush to a card edge (a cover photo) inherits the card's corner through `overflow: hidden`.
- **Borders:** always the alpha `line` colour, 1px; hover raises it to `line-strong`. Never a solid grey.
- **Photos:** dish and truck photos are cropped square or 3:2 and fill their frame (`object-cover`). Product shots on white use `mix-blend-mode: multiply` inside an isolated wrapper so their white background melts into the surface.
- **Tap targets:** at least 44px. Small controls (chips, arrows, clear buttons) grow an invisible 44px hit area (`hit-44`) instead of growing visually.

## Components

### Buttons
Confident and compact, pressed like a native app.
- **Shape:** 12px radius (`md`); heights 36 / 44 / 52px for sm / md / lg; bold label weight.
- **Primary:** `ember-500` fill, `night-900` text; hover `ember-400`, press `ember-600`.
- **Dark:** `night-900` fill, white text, for secondary actions on light pages.
- **Outline / Ghost / Danger / Success:** white with a `line` border; text-only; white with `chili-600` text; `leaf-600` fill.
- **Press:** scales to 0.96 over 150ms with `--ease-enter`. Full-width buttons only darken, they don't scale.
- **Loading:** the spinner appears only if the wait passes 300ms and then stays at least 500ms, so it never flashes.

### Chips
- **Style:** pill (999px), 36px tall, white with a `line` border and `ink-700` text; hover `surface-1`.
- **Selected:** `night-900` fill and border, white text, `aria-pressed`.

### Truck Card (signature)
The way into each truck, used in the home hero and on the search page.
- Wide card, 24px radius, white, `line` border, truck-card lift shadow.
- Left: truck name (heading / title), tagline or cuisines, open status and dish count, and a small primary "View menu" button with an arrow that nudges 2px on hover.
- Right 42%: the truck's cover photo, flush to the card edge, scaling to 1.04 on hover. Closed trucks show the photo greyed and faded.
- The whole card is one link. The button is a styled span inside it.

### Dish Reel (signature)
"Fresh off the trucks": short silent clips of real menu dishes.
- Portrait 4:5 tile, 24px radius, navy base, the clip filling the tile over its poster still.
- A navy fade from the bottom holds the dish name (link to the dish), truck name, price and the Add button.
- Three columns on desktop; a snap-scrolling row on phones with the next tile peeking.

### Photo Hero
- **Home:** the night park photo with a looping clip of the same scene on top, a navy scrim pooled behind centred text, the full animated logo, the "Every truck. One cart." headline, one line of copy and the ember "Start your order" button. The truck cards overlap its bottom edge by 80–96px.
- **Stall:** the truck's cover photo, 224px tall on phones (full-bleed) and 288px on desktop (24px radius), with the logo, name, tagline and cuisines over a bottom navy fade.

### Inputs / Fields
- **Style:** 48px tall, 12px radius, white, `line` border; the hover border is `line-strong`.
- **Focus:** `ember-600` border with a 2px `ember-100` ring.
- **Search fields:** a `surface-1` fill instead of a border inside menus; a magnifier icon at the left and a round clear button at the right.
- **Error / disabled:** `chili-600` message under the field; `surface-1` fill and `ink-500` text when disabled.

### Navigation
- **Header:** a navy band with the compact logo (the address sits beside it on wide screens), a search box on desktop, and Orders, Sign in and an ember Cart button.
- **Bottom nav (phones):** Home, Search, Cart (with count), Orders, Account; the active tab is ember. A cart bar sits above it when the cart has items.
- **Menu sections:** a sticky row of category tabs with a 3px ember underline on the section being read; it follows the scroll.

### How It Works
Three steps in a row (stacked on phones): a giant ember-gradient numeral, a step title and one short line. It reveals on scroll, the heading first and then each step 90ms apart.

### Logo
`<OpenSkyLogo>` renders the owner's logo (`Assets/Open Sky Food Park Logo-01.svg`) inline. The full version goes in the hero and footer, the compact one in headers. The white wordmark only works on navy. The home hero plays a one-time intro: letters rise, "Sky" writes itself on, then the four tagline words pop up within 1.2s.

## Motion

Based on the charles-ux-animation guidance the owner pointed to.
- **Curves:** `--ease-enter` cubic-bezier(0.32, 0.72, 0, 1) for things appearing or responding; `--ease-exit` cubic-bezier(0.55, 0, 1, 0.45) for leaving; `--ease-move` cubic-bezier(0.77, 0, 0.175, 1) for moving on screen.
- **Durations:** press, hover and colour 150ms; popovers 200ms; sheets and toasts 260ms; page-level 340ms. Exits are about 25% shorter than entrances.
- **Entrances:** rise 8px out of a 2px blur, staggered 90ms. Never scale from 0; pop-ins start at 0.95.
- **Icon swaps:** the outgoing icon scales to 0.3 and blurs 4px while the new one comes in.
- **Video:** clips are muted loops that play only while at least a quarter is on screen, load about a screen ahead, and fade in over their still. The hero clip plays forward then backward so the loop has no seam.
- **Reduced motion:** entrances appear instantly, the logo shows its final state, and videos are replaced by their stills. Loading spinners still turn.

## Do's and Don'ts

### Do:
- **Do** keep page backgrounds `surface-0` / `surface-1`; use navy only for the header, the footer and photo heroes.
- **Do** put `night-900` text on every ember button.
- **Do** use the alpha `line` (ink at 11%) for borders and dividers, `line-strong` on hover.
- **Do** make inner radii concentric: outer radius minus padding.
- **Do** write gradients `in oklch` so their midpoints stay vivid.
- **Do** match icon stroke width to the text weight beside it (1.75 for normal, 2.25 for semibold, 2.5 for bold, 2.75 for extra-bold).
- **Do** fade the ends of sideways rails with a mask (transparent → black 15% … 85% → transparent).
- **Do** use real photos of real menu items, and leave a field empty when the owner hasn't supplied it.
- **Do** keep tap targets at least 44px.

### Don't:
- **Don't** use dark navy page backgrounds or navy content sections on the customer site; the owner rejected them.
- **Don't** put white text on `ember-500`.
- **Don't** invent ratings, reviews, opening hours, dish descriptions, allergen claims or social handles, even when a mockup shows them.
- **Don't** add a small uppercase kicker above headings.
- **Don't** use solid grey borders or animate `box-shadow`; fade a pseudo-element's shadow instead.
- **Don't** use the retired round badge logo anywhere.
- **Don't** autoplay video off screen or with sound.
