-- Open Sky Food Park · contract version 1.4
-- Cup or portion size for drinks and desserts, e.g. "12 oz". Shown in place of "Serves N"
-- as "12 oz | <description>". Nullable: null hides it. Set per dish in the admin panel.

alter table public.menu_items
  add column if not exists size_label text check (size_label is null or char_length(size_label) between 1 and 24);
