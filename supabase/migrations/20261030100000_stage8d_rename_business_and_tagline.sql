-- The dealer is renamed, and a tagline is added for the new site-wide fixed
-- header (shown above the sidebar on every admin page). business_settings
-- stays the single source of truth already used by the sidebar, PDFs, and
-- the order payment QR — nothing else needs to change to pick this up.

alter table public.business_settings add column tagline text;

alter table public.business_settings
  alter column business_name set default 'Shreeram Doodh diary & sweets';

update public.business_settings
set
  business_name = 'Shreeram Doodh diary & sweets',
  tagline = 'Quality & Purity are our first priority.'
where id = true;
