# Open Sky Food Park

Food-ordering product for a food truck park in Milpitas, CA: Next.js website (`web/`), Flutter apps (`mobile/`), one shared Supabase database (`supabase/`).

**Two Claude Code accounts work in this same folder at the same time.** Before doing anything:

1. Read `COLLAB.md` in full. It says which account owns which folders, what is in progress, and holds the message log between the two accounts.
2. Work only inside the folders your role owns. Ask for changes elsewhere through the log in `COLLAB.md`.
3. When you finish a piece of work or get blocked, add a log entry and update your rows on the board in `COLLAB.md`.

If the user has not said which role you are: the account that built `web/` is **Claude A**; the other is **Claude B** (Flutter). Ask the user if unsure.

## Rules that protect the other account's work

- Never run `git reset`, `git checkout -- .`, `git stash`, `git clean`, or `git add -A`. The other account's uncommitted work is in this same working tree. Stage only paths you own, and commit only when the user asks.
- Never rewrite `COLLAB.md` wholesale. Re-read it right before editing and make small targeted edits.
- Never edit files in `Assets/` (the owner's originals).
- Never put keys or passwords in any tracked file or in `COLLAB.md`. They live in `web/.env.local` and `mobile/.env`.

## Product facts

`PRODUCT.md` is the product record (users, scope, what is undecided). `DESIGN.md` is the visual system once written. `shared/design-tokens.json` holds the colors, type and spacing both UIs must use. Do not invent prices, ratings, reviews or allergen claims; leave unknown fields empty. Dish descriptions are owner-requested drafts in `shared/seed/descriptions.mjs`: keep them to what the dish is, with no allergen, portion or side-dish claims.
