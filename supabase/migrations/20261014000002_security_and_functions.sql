-- =====================================================================
-- YKONO Quote Studio · RLS, integridad y funciones de negocio
-- =====================================================================

-- ---------------------------------------------------------------------
-- RLS: todo lo que tiene studio_id solo es visible para sus miembros.
-- ---------------------------------------------------------------------
alter table public.studios enable row level security;
alter table public.studio_members enable row level security;
alter table public.profiles enable row level security;

create policy studios_select on public.studios
  for select to authenticated using (public.is_studio_member(id));
create policy studios_update on public.studios
  for update to authenticated using (public.is_studio_member(id)) with check (public.is_studio_member(id));

-- La pertenencia solo se lee; altas y bajas se hacen desde SQL (ver supabase/bootstrap.sql).
create policy studio_members_select on public.studio_members
  for select to authenticated using (user_id = auth.uid());

create policy profiles_own on public.profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array[
    'studio_settings','clients','client_contacts','projects','service_categories','services',
    'pricing_rules','service_questions','quote_counters','quotes','quote_sections','quote_phases',
    'quote_items','quote_payments','interview_sessions','generated_documents'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (public.is_studio_member(studio_id))
         with check (public.is_studio_member(studio_id))',
      t || '_member_all', t);
  end loop;
end $$;

-- Los documentos generados son un registro histórico: no se modifican.
create policy generated_documents_no_update on public.generated_documents
  as restrictive for update to authenticated using (false);

-- Las versiones antiguas de tarifas no se reescriben: solo se puede cambiar is_current.
create or replace function public.guard_pricing_rule_immutable()
returns trigger language plpgsql as $$
begin
  if (new.method, new.unit_price_cents, new.hourly_rate_cents, new.estimated_hours, new.default_quantity,
      new.addons, new.complexity, new.default_price_status, new.version, new.service_id)
     is distinct from
     (old.method, old.unit_price_cents, old.hourly_rate_cents, old.estimated_hours, old.default_quantity,
      old.addons, old.complexity, old.default_price_status, old.version, old.service_id) then
    raise exception 'Las tarifas son inmutables: crea una versión nueva';
  end if;
  return new;
end $$;
create trigger pricing_rules_immutable before update on public.pricing_rules
  for each row execute function public.guard_pricing_rule_immutable();

-- ---------------------------------------------------------------------
-- Integridad: las filas hijas pertenecen al mismo estudio que su padre.
-- ---------------------------------------------------------------------
create or replace function public.enforce_parent_studio()
returns trigger language plpgsql as $$
declare parent_studio uuid;
begin
  if tg_table_name in ('quote_sections','quote_phases','quote_items','quote_payments','generated_documents') then
    select studio_id into parent_studio from public.quotes where id = new.quote_id;
  elsif tg_table_name = 'client_contacts' then
    select studio_id into parent_studio from public.clients where id = new.client_id;
  elsif tg_table_name = 'pricing_rules' then
    select studio_id into parent_studio from public.services where id = new.service_id;
  end if;
  if parent_studio is null or parent_studio <> new.studio_id then
    raise exception 'studio_id no coincide con el registro padre (%).', tg_table_name;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['quote_sections','quote_phases','quote_items','quote_payments','generated_documents','client_contacts','pricing_rules']
  loop
    execute format('create trigger %I_parent_studio before insert or update on public.%I
                    for each row execute function public.enforce_parent_studio()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Numeración YK-AAAA-NNN, correlativa por estudio y año, sin huecos por concurrencia.
-- ---------------------------------------------------------------------
create or replace function public.next_quote_number(p_studio_id uuid)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_year int := extract(year from (now() at time zone 'Europe/Madrid'))::int;
  v_next int;
  v_prefix text;
begin
  if not public.is_studio_member(p_studio_id) then
    raise exception 'Sin acceso al estudio';
  end if;
  select coalesce(quote_prefix, 'YK') into v_prefix from public.studio_settings where studio_id = p_studio_id;
  insert into public.quote_counters as c (studio_id, year, last_number)
    values (p_studio_id, v_year, 1)
    on conflict (studio_id, year) do update set last_number = c.last_number + 1
    returning last_number into v_next;
  return format('%s-%s-%s', coalesce(v_prefix, 'YK'), v_year, lpad(v_next::text, 3, '0'));
end $$;

-- ---------------------------------------------------------------------
-- Guardado atómico del presupuesto completo (cabecera + fases + partidas +
-- secciones + pagos). SECURITY INVOKER: se aplican las políticas RLS.
-- Los totales llegan ya calculados por el motor de precios del servidor.
-- ---------------------------------------------------------------------
create or replace function public.save_quote_bundle(p jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid := (p->>'id')::uuid;
  v_studio uuid;
  v_status public.quote_status;
begin
  select studio_id, status into v_studio, v_status from public.quotes where id = v_id for update;
  if v_studio is null then
    raise exception 'Presupuesto no encontrado';
  end if;
  if v_status <> 'draft' then
    raise exception 'Solo se pueden editar borradores. Crea una nueva versión o reabre el presupuesto.';
  end if;

  update public.quotes set
    client_id = nullif(p->>'client_id','')::uuid,
    project_id = nullif(p->>'project_id','')::uuid,
    title = coalesce(p->>'title',''),
    subtitle = coalesce(p->>'subtitle',''),
    addressee = coalesce(p->>'addressee',''),
    issue_date = (p->>'issue_date')::date,
    validity_days = (p->>'validity_days')::int,
    vat_rate_bp = (p->>'vat_rate_bp')::int,
    global_discount_bp = coalesce((p->>'global_discount_bp')::int, 0),
    payment_mode = (p->>'payment_mode')::public.payment_mode,
    payment_terms = coalesce(p->>'payment_terms',''),
    conditions = coalesce(p->'conditions','[]'::jsonb),
    exclusions = coalesce(p->'exclusions','[]'::jsonb),
    notes_internal = coalesce(p->>'notes_internal',''),
    totals = coalesce(p->'totals','{}'::jsonb),
    total_cents = coalesce((p->'totals'->>'total')::bigint, 0),
    taxable_base_cents = coalesce((p->'totals'->>'taxableBase')::bigint, 0)
  where id = v_id;

  -- Fases
  delete from public.quote_phases
   where quote_id = v_id
     and id not in (select (e->>'id')::uuid from jsonb_array_elements(coalesce(p->'phases','[]')) e);
  insert into public.quote_phases (id, studio_id, quote_id, name, description, deliverables, timing, sort_order)
  select (e->>'id')::uuid, v_studio, v_id, e->>'name', coalesce(e->>'description',''),
         coalesce(e->'deliverables','[]'), coalesce(e->>'timing',''), (o - 1)::int
    from jsonb_array_elements(coalesce(p->'phases','[]')) with ordinality as x(e, o)
  on conflict (id) do update set
    name = excluded.name, description = excluded.description, deliverables = excluded.deliverables,
    timing = excluded.timing, sort_order = excluded.sort_order
  where public.quote_phases.quote_id = v_id;

  -- Partidas
  delete from public.quote_items
   where quote_id = v_id
     and id not in (select (e->>'id')::uuid from jsonb_array_elements(coalesce(p->'items','[]')) e);
  insert into public.quote_items (
    id, studio_id, quote_id, phase_id, service_id, pricing_rule_id, name, description, unit, method,
    quantity, unit_price_cents, hours, hourly_rate_cents, addons, complexity_level, complexity_factor_bp,
    discount_bp, vat_rate_bp, kind, external_treatment, price_status, is_optional, optional_included,
    rule_snapshot, net_cents, sort_order)
  select (e->>'id')::uuid, v_studio, v_id,
         nullif(e->>'phase_id','')::uuid, nullif(e->>'service_id','')::uuid, nullif(e->>'pricing_rule_id','')::uuid,
         e->>'name', coalesce(e->>'description',''), coalesce(e->>'unit','ud.'),
         (e->>'method')::public.pricing_method,
         coalesce((e->>'quantity')::int, 100), (e->>'unit_price')::bigint, (e->>'hours')::int,
         (e->>'hourly_rate')::bigint, coalesce(e->'addons','[]'), e->>'complexity_level',
         (e->>'complexity_factor_bp')::int, coalesce((e->>'discount_bp')::int, 0), (e->>'vat_rate_bp')::int,
         coalesce(e->>'kind','own'), (e->>'external_treatment')::public.external_treatment,
         (e->>'price_status')::public.price_status, coalesce((e->>'is_optional')::boolean, false),
         coalesce((e->>'optional_included')::boolean, false),
         case when e->'rule_snapshot' = 'null'::jsonb then null else e->'rule_snapshot' end,
         (p->'totals'->'lines'->(e->>'id')->>'net')::bigint,
         (o - 1)::int
    from jsonb_array_elements(coalesce(p->'items','[]')) with ordinality as x(e, o)
  on conflict (id) do update set
    phase_id = excluded.phase_id, service_id = excluded.service_id, pricing_rule_id = excluded.pricing_rule_id,
    name = excluded.name, description = excluded.description, unit = excluded.unit, method = excluded.method,
    quantity = excluded.quantity, unit_price_cents = excluded.unit_price_cents, hours = excluded.hours,
    hourly_rate_cents = excluded.hourly_rate_cents, addons = excluded.addons,
    complexity_level = excluded.complexity_level, complexity_factor_bp = excluded.complexity_factor_bp,
    discount_bp = excluded.discount_bp, vat_rate_bp = excluded.vat_rate_bp, kind = excluded.kind,
    external_treatment = excluded.external_treatment, price_status = excluded.price_status,
    is_optional = excluded.is_optional, optional_included = excluded.optional_included,
    rule_snapshot = excluded.rule_snapshot, net_cents = excluded.net_cents, sort_order = excluded.sort_order
  where public.quote_items.quote_id = v_id;

  -- Secciones
  delete from public.quote_sections
   where quote_id = v_id
     and id not in (select (e->>'id')::uuid from jsonb_array_elements(coalesce(p->'sections','[]')) e);
  insert into public.quote_sections (id, studio_id, quote_id, type, title, content, visible, sort_order)
  select (e->>'id')::uuid, v_studio, v_id, e->>'type', coalesce(e->>'title',''), coalesce(e->'content','{}'),
         coalesce((e->>'visible')::boolean, true), (o - 1)::int
    from jsonb_array_elements(coalesce(p->'sections','[]')) with ordinality as x(e, o)
  on conflict (id) do update set
    type = excluded.type, title = excluded.title, content = excluded.content,
    visible = excluded.visible, sort_order = excluded.sort_order
  where public.quote_sections.quote_id = v_id;

  -- Pagos
  delete from public.quote_payments
   where quote_id = v_id
     and id not in (select (e->>'id')::uuid from jsonb_array_elements(coalesce(p->'payments','[]')) e);
  insert into public.quote_payments (id, studio_id, quote_id, label, milestone, due_hint, planned_date,
                                     percent_bp, amount_cents, net_cents, total_cents, sort_order)
  select (e->>'id')::uuid, v_studio, v_id, e->>'label', coalesce(e->>'milestone',''), coalesce(e->>'due_hint',''),
         nullif(e->>'planned_date','')::date, (e->>'percent_bp')::int, (e->>'amount')::bigint,
         (e->>'net')::bigint, (e->>'total')::bigint, (o - 1)::int
    from jsonb_array_elements(coalesce(p->'payments','[]')) with ordinality as x(e, o)
  on conflict (id) do update set
    label = excluded.label, milestone = excluded.milestone, due_hint = excluded.due_hint,
    planned_date = excluded.planned_date, percent_bp = excluded.percent_bp, amount_cents = excluded.amount_cents,
    net_cents = excluded.net_cents, total_cents = excluded.total_cents, sort_order = excluded.sort_order
  where public.quote_payments.quote_id = v_id;
end $$;

revoke all on function public.save_quote_bundle(jsonb) from public, anon;
grant execute on function public.save_quote_bundle(jsonb) to authenticated;
revoke all on function public.next_quote_number(uuid) from public, anon;
grant execute on function public.next_quote_number(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Alta de usuaria en el estudio (solo desde el SQL editor / service role).
-- ---------------------------------------------------------------------
create or replace function public.add_studio_member(p_email text, p_role public.member_role default 'owner')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_user uuid; v_studio uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(p_email);
  if v_user is null then raise exception 'No existe ninguna usuaria con el email %', p_email; end if;
  select id into v_studio from public.studios order by created_at limit 1;
  if v_studio is null then raise exception 'No hay ningún estudio creado (ejecuta el seed)'; end if;
  insert into public.studio_members (studio_id, user_id, role) values (v_studio, v_user, p_role)
    on conflict do nothing;
  insert into public.profiles (id, default_studio_id) values (v_user, v_studio)
    on conflict (id) do update set default_studio_id = excluded.default_studio_id;
end $$;
revoke all on function public.add_studio_member(text, public.member_role) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Storage: buckets privados, carpeta raíz = studio_id.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents', 'documents', false, 20971520, array['application/pdf']),
  ('brand', 'brand', false, 5242880, array['image/png','image/jpeg','image/svg+xml'])
on conflict (id) do nothing;

create policy "studio members read own files" on storage.objects
  for select to authenticated
  using (bucket_id in ('documents','brand')
         and public.is_studio_member(((storage.foldername(name))[1])::uuid));

create policy "studio members write own files" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('documents','brand')
              and public.is_studio_member(((storage.foldername(name))[1])::uuid));

create policy "studio members replace brand files" on storage.objects
  for update to authenticated
  using (bucket_id = 'brand' and public.is_studio_member(((storage.foldername(name))[1])::uuid));

create policy "studio members delete brand files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'brand' and public.is_studio_member(((storage.foldername(name))[1])::uuid));
