# Roadmap: what Swiggy has that we don't

Written 2026-11-19 by Claude A at the owner's request. Compares Open Sky (website, Android app, iOS app, stall dashboard, admin panel) with Swiggy's customer app, its restaurant partner app and its operations side. The work split is in `COLLAB.md` (board rows A10+ and B7+).

Swiggy delivers to homes; Open Sky is a park where people walk up to trucks. So delivery features (addresses, rider tracking on a map, delivery fees, Instamart, Genie) are left out on purpose. Everything below fits a food truck park.

## What we already have

| Area | Done |
|---|---|
| Customer (web) | Home with posters, cravings and truck cards; truck menu with sections and Veg filter; dish page with "goes well with"; search; one cart across trucks; pickup with a token per truck, or table service; order note; coupons and an Offers list; pay online (Stripe) or at the truck; live order tracking; order history; cancel; Google / phone sign-in; Help and Contact pages |
| Android app (B) | Home with truck lot and mascots, truck menu, dish page, cart, tracking, orders, account, settings, welcome tour, search. Demo data only |
| iOS app (A) | Home with trucks as tabs, carousel, favourites (on the phone), dish sheet, cart, tracking, orders, account. Demo data only |
| Stall dashboard | New / Preparing / Ready lanes, accept, reject, sound on new order, sold-out switches, open/closed, one login per truck |
| Admin | Orders (today's sales), support messages, menus and prices, stalls, coupons, posters, park settings, photo upload, stall logins |

## Gaps, by priority

**P1** means it matters for a working park, **P2** makes the product feel complete, and **P3** is nice to have. "Owner" means it needs a decision from the owner before it can be built.

### Customer side

| # | Feature (Swiggy has it) | Why it matters here | Priority |
|---|---|---|---|
| C1 | **Order again**: one tap to refill the cart from a past order | Regulars order the same thing every visit | P1 |
| C2 | **Dish options**: size, spice level, add-ons with their own prices ("Extra pulka +$1.99") | Today every choice has to be a separate dish or typed in a note | P1 |
| C3 | **"Your food is ready" alert**: phone notification, or a text message on the web | Customers walk around the park; they cannot watch the screen | P1 (needs Firebase or an SMS account, owner) |
| C4 | **Favourites everywhere**: heart a dish or truck, synced to the account | iOS has it on the phone only; web and Android have none | P1 |
| C5 | **Rate the order** after pickup: stars and a comment per truck | Real feedback for trucks and the park. Whether ratings are shown publicly is the owner's call; until then only staff see them | P2 (owner: public or private) |
| C6 | **Receipt by email**, and a printable receipt page | Expense claims, proof of payment | P2 (needs an email service, owner) |
| C7 | **Recent and popular searches** under the search box | Faster search; "popular" comes from real order counts, never invented | P2 |
| C8 | **"Add more" suggestions in the cart** (drinks, desserts from other trucks) | Bigger orders across trucks, a park advantage | P2 |
| C9 | **Group order**: friends add to one shared cart, one person pays | People come to the park in groups | P2 |
| C10 | **Order for later**: choose a pickup time today | Beat the evening rush | P2 |
| C11 | **Live wait time** on truck cards ("~15 min", from today's real prep times) | Pick the shorter queue | P2 |
| C12 | **Tips** at checkout | The setting exists but is off | P3 (owner) |
| C13 | **Park events page**: music nights, live screen schedule | The park's tagline is "Food · Fun · Music · Live Screen" | P3 (owner supplies events) |
| C14 | **Loyalty stamps** ("10th meal free") and referral codes | Swiggy One / referral equivalent for a single park | P3 (owner: rules) |
| C15 | **Saved cards / Apple Pay as default**, delete account, notification settings | Account basics; app stores require account deletion | P2 |
| C16 | **Item notes per dish** ("no onions" on one dish, not the whole order) | Fewer mistakes at the truck | P2 |

### Stall (truck) side

| # | Feature | Why | Priority |
|---|---|---|---|
| S1 | **Opening hours per truck**, opening and closing on their own; **pause orders for 15 / 30 min** when slammed | Stops orders the truck cannot cook | P1 |
| S2 | **Prep time on accept** ("ready in 10 min") shown to the customer | The customer knows when to walk over | P1 |
| S3 | **Order history and today's sales** for the truck (count, total, top dishes) | Trucks want to see their own numbers | P1 |
| S4 | **Truck edits its own menu**: prices, photos, descriptions, sold out until tomorrow | Today only the admin can, and the admin is one person | P2 |
| S5 | **Print kitchen ticket** (browser print, 80 mm receipt layout) | Many trucks use ticket rails | P2 |
| S6 | **See ratings and comments** for their truck | Follows C5 | P2 |
| S7 | **Auto-accept** option for trucks that always accept | Fewer taps at rush hour | P3 |

### Admin (park) side

| # | Feature | Why | Priority |
|---|---|---|---|
| A1 | **Reports**: sales by day, by truck and by dish; busiest hours; coupon cost; CSV download | The owner runs the park on these numbers; also needed to pay out trucks | P1 |
| A2 | **Refunds**: when a truck rejects a paid order (or the admin cancels it), refund through Stripe, fully or for one truck's part | Today a rejected paid order keeps the money with no way back | P1 |
| A3 | **Order search and filters** (order number, phone, truck, date, status) and an order detail view | Answering "where is my order" | P1 |
| A4 | **Payout statement per truck** for a date range: items, coupon share, tax, online vs at-truck | How each truck gets paid; depends on the owner's payout decision | P2 (owner) |
| A5 | **Customers list**: orders, total spent, block a customer | Support and abuse handling | P2 |
| A6 | **Reply to support messages** from the admin panel (by email) | Messages arrive but cannot be answered from the panel | P2 (needs email, owner) |
| A7 | **Push or text campaigns** ("Live music tonight, 10% off desserts") | Swiggy pushes offers; we have posters only | P3 (owner) |
| A8 | **Time-based menus and poster schedules** (lunch menu, weekend poster) | Posters and dishes switch on their own | P3 |
| A9 | **Activity log**: who changed which price, coupon or login, and when | Accountability once several people use the admin panel | P3 |

## Not planned (delivery only)

Delivery addresses, rider map tracking, delivery fee and distance, Instamart / Genie / Dineout table booking, membership with free delivery.

## Order of work

1. **Contract v1.6** (A, first, because the apps build on it): dish options, favourites, truck hours and pause, prep time, ratings, refunds, device tokens for alerts, report functions.
2. **In parallel, no contract needed**: Android catches up on what the website already has (coupons v1.5, payment check endpoint, Help and Contact, order again, recent searches). A starts the admin reports and refunds.
3. **After v1.6**: each side builds the new features in its own apps; A does iOS last, following Android.
4. **Owner decisions** listed in `COLLAB.md` section 5 unblock C3, C5, C6, C12–C14, A4, A6, A7.
