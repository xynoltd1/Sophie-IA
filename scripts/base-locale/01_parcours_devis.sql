\set ON_ERROR_STOP on
begin;

-- Un utilisateur, une entreprise, un client.
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'patron@test.be');
insert into public.organizations (id, name, slug, country_code)
  values ('22222222-2222-2222-2222-222222222222', 'DIZER LTD', 'dizer-ltd', 'BE');
insert into public.organization_members (organization_id, user_id, role, status)
  values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'OWNER', 'ACTIVE');
insert into public.contacts (id, organization_id, full_name, phone)
  values ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Jean Martin', '+32470123456');

-- A partir d ici, on travaille comme l application : role authenticated,
-- identite portee par le JWT. Si une politique RLS est fausse, ca casse ici.
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set local request.jwt.claim.role = 'authenticated';

insert into public.quotes (id, organization_id, contact_id, title, customer_name, created_by)
  values ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222',
          '33333333-3333-3333-3333-333333333333', 'Debouchage', 'Jean Martin',
          '11111111-1111-1111-1111-111111111111');

insert into public.quote_lines (quote_id, organization_id, label, quantity, unit_price_cents, vat_rate)
  values ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222',
          'Debouchage', 1, 10000, 21);

\echo '--- totaux calcules par la base (attendu 10000 / 2100 / 12100)'
select total_excl_cents, total_vat_cents, total_incl_cents from public.quotes
 where id = '44444444-4444-4444-4444-444444444444';

\echo '--- lecture comme l application, avec la jointure contact'
select q.reference, q.title, c.full_name, c.company_name, c.phone
  from public.quotes q left join public.contacts c on c.id = q.contact_id
 where q.id = '44444444-4444-4444-4444-444444444444';

reset role;
set local role service_role;
\echo '--- numerotation (appel serveur)'
select public.assign_quote_reference('44444444-4444-4444-4444-444444444444') as numero;

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
\echo '--- etat final'
select reference, status, total_incl_cents from public.quotes
 where id = '44444444-4444-4444-4444-444444444444';

\echo '--- isolation : un membre d une autre entreprise voit-il ce devis ?'
reset role;
insert into auth.users (id, email) values ('55555555-5555-5555-5555-555555555555', 'autre@test.be');
insert into public.organizations (id, name, slug, country_code) values ('66666666-6666-6666-6666-666666666666', 'AUTRE SPRL', 'autre-sprl', 'BE');
insert into public.organization_members (organization_id, user_id, role, status)
  values ('66666666-6666-6666-6666-666666666666', '55555555-5555-5555-5555-555555555555', 'OWNER', 'ACTIVE');
set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select count(*) as devis_vus_par_l_autre_entreprise from public.quotes;

rollback;
