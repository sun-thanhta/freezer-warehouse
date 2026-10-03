-- YCCMS — local seed, runs after migrations on `supabase db reset`.
-- Reference data that every environment needs (e.g. roles) lives in migrations, not here.
-- Auth users cannot be created reliably from SQL: `npm run db:reset` runs scripts/create-dev-users.mjs afterwards.
-- Business fixtures (RFP: 12 SKU, CUS-001…005, AGR-001…015) are added here together with their module migrations.
select 1;
