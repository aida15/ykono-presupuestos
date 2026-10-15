-- =====================================================================
-- YKONO Quote Studio · Esquema principal
-- Todos los importes en céntimos enteros (bigint), porcentajes en puntos
-- básicos (int, 100 = 1 %) y cantidades/horas en centésimas (int).
-- Multiusuario preparado: cada fila pertenece a un "studio" y el acceso
-- se concede por pertenencia (studio_members), no por usuario.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.pricing_method as enum
  ('fixed','per_unit','hourly','base_plus_addons','complexity','manual','external');
create type public.price_status as enum
  ('approved_rate','estimate_pending','manual_approved','pending_valuation');
create type public.external_treatment as enum ('informative','resale','suplido');
create type public.quote_status as enum ('draft','ready','sent','accepted','rejected','archived');
create type public.payment_mode as enum ('percent','fixed');
create type public.member_role as enum ('owner','member');
create type public.project_status as enum ('briefing','quoting','won','lost','archived');
create type public.interview_status as enum ('active','summary','completed','abandoned');

-- ---------------------------------------------------------------------
-- Estudio, miembros y perfiles
-- ---------------------------------------------------------------------
create table public.studios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.studio_members (
  studio_id uuid not null references public.studios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (studio_id, user_id)
);
create index studio_members_user_idx on public.studio_members(user_id);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  default_studio_id uuid references public.studios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ¿Pertenece el usuario actual al estudio? SECURITY DEFINER para evitar
-- recursión de RLS sobre studio_members. search_path fijado.
create or replace function public.is_studio_member(p_studio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.studio_members m
    where m.studio_id = p_studio_id and m.user_id = auth.uid()
  );
$$;
revoke all on function public.is_studio_member(uuid) from public;
grant execute on function public.is_studio_member(uuid) to authenticated;

create table public.studio_settings (
  studio_id uuid primary key references public.studios(id) on delete cascade,
  product_name text not null default 'YKONO Quote Studio',
  trade_name text not null default 'YKONO',
  tagline text not null default 'Estudio Creativo',
  legal_name text,
  tax_id text,
  address_line text,
  postal_code text,
  city text,
  province text,
  phone text,
  email text,
  website text,
  logo_path text,
  quote_prefix text not null default 'YK' check (quote_prefix ~ '^[A-Z0-9]{1,6}$'),
  default_vat_rate_bp int not null default 2100 check (default_vat_rate_bp between 0 and 10000),
  default_validity_days int not null default 30 check (default_validity_days between 1 and 365),
  default_payment_mode public.payment_mode not null default 'percent',
  -- [{label, milestone, due_hint, percent_bp}]
  default_payments jsonb not null default '[]'::jsonb,
  default_payment_terms text not null default '',
  -- [{title, text}]
  default_conditions jsonb not null default '[]'::jsonb,
  default_exclusions jsonb not null default '[]'::jsonb,
  closing_text text not null default '',
  ai_enabled boolean not null default true,
  ai_model_interview text not null default 'claude-sonnet-5-5',
  ai_model_drafting text not null default 'claude-sonnet-5-5',
  -- {accent, ink, surface, show_cover, show_closing}
  pdf_preferences jsonb not null default '{}'::jsonb,
  archive_pdfs boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  trade_name text not null,
  legal_name text,
  tax_id text,
  address_line text,
  postal_code text,
  city text,
  province text,
  country text default 'España',
  email text,
  phone text,
  website text,
  sector text,
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clients_studio_idx on public.clients(studio_id, updated_at desc);

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index client_contacts_client_idx on public.client_contacts(client_id);

-- ---------------------------------------------------------------------
-- Proyectos
-- ---------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  name text not null,
  sector text,
  context text,
  objectives jsonb not null default '[]'::jsonb,
  target_audience text,
  starting_point text,
  languages jsonb not null default '["Castellano"]'::jsonb,
  desired_deadline text,
  status public.project_status not null default 'briefing',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_studio_idx on public.projects(studio_id, updated_at desc);

-- ---------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------
create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  parent_id uuid references public.service_categories(id) on delete set null,
  name text not null,
  slug text not null,
  description text,
  sort_order int not null default 0,
  active boolean not null default true,
  unique (studio_id, slug)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  category_id uuid references public.service_categories(id) on delete set null,
  name text not null,
  internal_description text,
  commercial_description text,
  unit text not null default 'ud.',
  is_external_cost boolean not null default false,
  default_external_treatment public.external_treatment,
  is_optional_default boolean not null default false,
  default_exclusions jsonb not null default '[]'::jsonb,
  default_deliverables jsonb not null default '[]'::jsonb,
  -- servicios que la IA puede sugerir como complemento: [service_id]
  complements jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index services_studio_idx on public.services(studio_id, category_id, sort_order);

-- Las tarifas son versionadas e inmutables: un cambio crea una versión nueva
-- y desactiva la anterior. Los presupuestos guardan un snapshot de la versión usada.
create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  version int not null default 1,
  method public.pricing_method not null,
  unit_price_cents bigint check (unit_price_cents is null or unit_price_cents >= 0),
  hourly_rate_cents bigint check (hourly_rate_cents is null or hourly_rate_cents >= 0),
  estimated_hours int check (estimated_hours is null or estimated_hours >= 0), -- centésimas
  default_quantity int not null default 100,                                    -- centésimas
  -- [{label, price, qty}]
  addons jsonb not null default '[]'::jsonb,
  -- {levels:[{key,label,factor_bp}], default_level}
  complexity jsonb,
  -- estado con el que entra la partida al presupuesto
  default_price_status public.price_status not null default 'approved_rate',
  notes text,
  is_current boolean not null default true,
  valid_from timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (service_id, version)
);
create unique index pricing_rules_one_current on public.pricing_rules(service_id) where is_current;

create table public.service_questions (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  discipline text not null,  -- strategy | identity | digital | packaging | editorial | social | recurring | common
  service_id uuid references public.services(id) on delete set null,
  question text not null,
  help_text text,
  answer_type text not null default 'text' check (answer_type in ('text','number','boolean','choice','multi')),
  options jsonb not null default '[]'::jsonb,
  -- condición de aparición: {"field": "brand_status", "equals": "new"}
  condition jsonb,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index service_questions_studio_idx on public.service_questions(studio_id, discipline, sort_order);

-- ---------------------------------------------------------------------
-- Presupuestos
-- ---------------------------------------------------------------------
create table public.quote_counters (
  studio_id uuid not null references public.studios(id) on delete cascade,
  year int not null,
  last_number int not null default 0,
  primary key (studio_id, year)
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  number text not null,                     -- YK-2026-001
  version int not null default 1,
  parent_quote_id uuid references public.quotes(id) on delete set null,
  status public.quote_status not null default 'draft',
  title text not null default '',
  subtitle text not null default '',
  addressee text not null default '',
  issue_date date not null default current_date,
  validity_days int not null default 30 check (validity_days between 1 and 365),
  valid_until date generated always as (issue_date + validity_days) stored,
  currency char(3) not null default 'EUR',
  vat_rate_bp int not null default 2100 check (vat_rate_bp between 0 and 10000),
  global_discount_bp int not null default 0 check (global_discount_bp between 0 and 10000),
  payment_mode public.payment_mode not null default 'percent',
  payment_terms text not null default '',
  conditions jsonb not null default '[]'::jsonb,
  exclusions jsonb not null default '[]'::jsonb,
  notes_internal text not null default '',
  -- snapshot calculado por el motor de precios en el último guardado
  totals jsonb not null default '{}'::jsonb,
  total_cents bigint not null default 0,
  taxable_base_cents bigint not null default 0,
  -- copia de los datos del cliente en el momento de cerrar el presupuesto
  client_snapshot jsonb,
  finalized_at timestamptz,
  sent_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, number, version)
);
create index quotes_studio_idx on public.quotes(studio_id, updated_at desc);
create index quotes_client_idx on public.quotes(client_id);

create table public.quote_sections (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  type text not null,
  title text not null default '',
  content jsonb not null default '{}'::jsonb,
  visible boolean not null default true,
  sort_order int not null default 0
);
create index quote_sections_quote_idx on public.quote_sections(quote_id, sort_order);

create table public.quote_phases (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  name text not null,
  description text not null default '',
  deliverables jsonb not null default '[]'::jsonb,
  timing text not null default '',
  sort_order int not null default 0
);
create index quote_phases_quote_idx on public.quote_phases(quote_id, sort_order);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  phase_id uuid references public.quote_phases(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  pricing_rule_id uuid references public.pricing_rules(id) on delete set null,
  name text not null,
  description text not null default '',
  unit text not null default 'ud.',
  method public.pricing_method not null,
  quantity int not null default 100 check (quantity >= 0),
  unit_price_cents bigint,
  hours int check (hours is null or hours >= 0),
  hourly_rate_cents bigint,
  addons jsonb not null default '[]'::jsonb,
  complexity_level text,
  complexity_factor_bp int,
  discount_bp int not null default 0 check (discount_bp between 0 and 10000),
  vat_rate_bp int check (vat_rate_bp is null or vat_rate_bp between 0 and 10000),
  kind text not null default 'own' check (kind in ('own','external')),
  external_treatment public.external_treatment,
  price_status public.price_status not null,
  is_optional boolean not null default false,
  optional_included boolean not null default false,
  rule_snapshot jsonb,
  -- importes calculados en el último guardado (solo lectura para informes)
  net_cents bigint,
  sort_order int not null default 0
);
create index quote_items_quote_idx on public.quote_items(quote_id, sort_order);

create table public.quote_payments (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  label text not null,
  milestone text not null default '',
  due_hint text not null default '',
  planned_date date,
  percent_bp int check (percent_bp is null or percent_bp between 0 and 10000),
  amount_cents bigint check (amount_cents is null or amount_cents >= 0),
  -- calculados
  net_cents bigint,
  total_cents bigint,
  sort_order int not null default 0
);
create index quote_payments_quote_idx on public.quote_payments(quote_id, sort_order);

-- ---------------------------------------------------------------------
-- Entrevistas y documentos
-- ---------------------------------------------------------------------
create table public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  status public.interview_status not null default 'active',
  state jsonb not null default '{}'::jsonb,
  -- [{role, content, at}] — solo el texto visible, sin prompts del sistema
  messages jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index interview_sessions_studio_idx on public.interview_sessions(studio_id, updated_at desc);

create table public.generated_documents (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  quote_number text not null,
  quote_version int not null,
  doc_version int not null,
  file_name text not null,
  storage_path text,
  byte_size int,
  sha256 text,
  -- copia íntegra de los datos que originaron el PDF (presupuesto + cliente + ajustes)
  data_snapshot jsonb not null,
  total_cents bigint not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (quote_id, doc_version)
);
create index generated_documents_quote_idx on public.generated_documents(quote_id, doc_version desc);

-- ---------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','studio_settings','clients','projects','services','quotes','interview_sessions']
  loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;
