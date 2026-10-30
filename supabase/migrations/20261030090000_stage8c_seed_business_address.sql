-- Seed the business address the owner gave for the "Shreeram Daily Milk"
-- header/PDF shown everywhere the business name appears. Only fills it in
-- if still unset, so it never clobbers a value the admin already edited via
-- the Settings page.
update public.business_settings
set address = 'R9 Sector, Life Republic, Kolte Patil'
where id = true and address is null;
