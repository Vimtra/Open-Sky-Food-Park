# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

Website (Next.js) plus native Android and iOS apps (Flutter). The website is the `web` surface; the Flutter app is one product that adapts per OS.

## Stack

- **Website, stall dashboard, admin panel, payment API:** Next.js (user's choice).
- **Android and iOS apps:** Flutter (user's choice).
- **Shared database:** one database used by both the website and the apps (user's requirement). Delegated choice: Supabase (Postgres, phone-OTP auth, realtime order updates, image storage) because it has first-party SDKs for both Next.js and Flutter.
- **Payments:** Stripe (delegated choice: US cards, Apple Pay, Google Pay), server calls made from Next.js route handlers.

## Users

- **Customers** visiting Open Sky Food Park in Milpitas, California, on their own phones, usually standing or seated outdoors in the evening and deciding what to eat across several food trucks.
- **Stall (food truck) owners and staff** receiving orders during service, on a phone or counter tablet.
- **Park management (admin)** maintaining stalls, menus, prices and offers.

## Product Purpose

Let a visitor order from any of the stalls in Open Sky Food Park from one app or website, pay once, and know exactly when and where to collect each part of the order. Success: an order placed without queueing at a truck window, and each stall seeing and fulfilling its part without confusion.

## Positioning

One cart across every stall in a single physical food truck park. A customer can mix dishes from several stalls in one order, and each stall gets only its own portion with its own token number.

## Operating Context

- Open Sky Food Park is an outdoor food truck park in the Bay Area ("Food · Fun · Music · Live Screen"). Menu artwork gives the address as 200 Serra Way, Milpitas, CA; the Instagram bio starts "47 junipero…". Address to be confirmed by the owner.
- Orders are fulfilled inside the park. The customer picks at checkout: **pickup** (collect from each stall with a token number when it shows Ready) or **table** (enter a table number and the food is brought over).
- No home delivery in this phase.
- Each order splits into one stall order per stall. Stall order statuses: Placed, Preparing, Ready, Completed (or Cancelled).
- Prices are in US dollars.

## Capabilities and Constraints

In scope for phase 1 (confirmed):

- Customer ordering on web, Android and iOS: browse stalls, menus, search, multi-stall cart, checkout, order tracking, order history.
- Stall owner dashboard: live incoming orders, status updates, item in/out of stock, open/closed.
- Admin panel: manage stalls, menus, prices, offers and banners.
- Real backend with login and online payment.

Undecided (open, do not invent):

- Prices for PandemKodi Dhaba (its menu artwork shows only Fresh Live Pulka at $1.99) and for Desi Desserts' Chocolate Chip Brownie. Seed data carries placeholder prices that must be replaced.
- Menus for the other stalls in the park.
- Sales tax rate, tips, service fees, and how money is paid out to each stall.
- Opening hours, table numbering, and where each truck stands in the park.
- SMS provider for phone OTP, and the Supabase and Stripe accounts themselves.
- Whether stall owners also get a mobile app or use the web dashboard only.

## Brand Commitments

- Name: **Open Sky Food Park** (also written "OpenSky Food Truck Park" on stall artwork). Tagline on the logo: "Food · Fun · Music · Live Screen".
- Logo: `Assets/Open Sky Food Park Logo-01.svg` is the logo from 2026-11-17 on (white "Open" with a fork in the O, orange-gradient "Sky", chef hat, "FOOD PARK", tagline). Working copies live in `shared/img/brand/`. The wordmark is white, so it only sits on night surfaces; a dark-on-light version and a compact icon are still to come from the designer. The earlier round badge (`Assets/Open Sky Food Park logo.jpg`) is retired and must not be used.
- Identity the owner confirmed: night sky plus glowing ember orange.
- Reference the user made binding: **Swiggy-style UI/UX** (familiar food-ordering layout and interaction patterns). The identity (name, logo, artwork, copy) is Open Sky's own.
- The owner's standing UI rules (alpha borders, OKLCH palettes, nested-radius maths, edge-faded carousels, motion timings and curves) are binding for web and apps. They are listed in `COLLAB.md` and encoded in `shared/design-tokens.json`.
- Dish photos under `shared/img/photo/` are AI-generated stand-ins awaiting the owner's approval, not photographs of the real dishes.
- Instagram: instagram.com/openskyfoodpark.

## Evidence on Hand

- `Assets/` holds the owner's originals: the park logo, the PandemKodi Dhaba menu and five combo posters, and the Desi Desserts menu with prices.
- Real stalls so far: **PandemKodi Dhaba** ("Dhaba Style. Desi Flavours.", +1 408 786 4343, @pandemkodi_dhaba) and **Desi Desserts**.
- No ratings, reviews, prep times, dish descriptions or allergen information exist. Do not fabricate them; leave those fields empty.

## Product Principles

1. The park is the unit, not the restaurant: a cart always spans stalls.
2. Every screen answers "what do I do next and where do I go": token numbers and stall locations are first-class.
3. Web and apps behave the same because they share one database and one set of server-side rules for price and order state.
4. Stall staff are busy: their screens need the fewest taps of any surface.
