-- Open Sky Food Park · contract version 1.3
-- How many people a dish serves. Shown as "Serves 4 | <description>" on menus.
-- Nullable: null hides it. Set per dish in the admin panel.

alter table public.menu_items
  add column if not exists serves int check (serves is null or serves between 1 and 50);
