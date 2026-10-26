-- =====================================================================
-- YKONO Quote Studio · Módulo de leads (prospección)
-- =====================================================================

create type public.lead_status as enum ('new', 'analyzed', 'contacted', 'replied', 'converted', 'discarded');

create table public.lead_searches (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  query text not null,
  location text not null default '',
  provider text not null default 'google_places',
  results_count int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index lead_searches_studio_idx on public.lead_searches(studio_id, created_at desc);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  search_id uuid references public.lead_searches(id) on delete set null,
  source text not null default 'manual',          -- google_places | manual
  place_id text,                                   -- id de Google Places
  name text not null,
  category text,
  website text,
  phone text,
  address text,
  city text,
  maps_url text,
  -- datos de la ficha de Google tal cual llegan (sin reseñas ni valoraciones)
  google jsonb,
  -- resultado del análisis
  status public.lead_status not null default 'new',
  score int check (score between 0 and 100),
  criteria jsonb not null default '[]'::jsonb,      -- [{id, axis, label, met, evidence}]
  triggers jsonb not null default '[]'::jsonb,      -- señales de momento detectadas
  manual_triggers jsonb not null default '[]'::jsonb, -- señales de momento marcadas a mano
  site jsonb,                                       -- señales técnicas de la web
  offers jsonb not null default '[]'::jsonb,        -- [{service_id, name, reasons, net_cents}]
  pitch jsonb,                                      -- argumentos internos, para el cliente, mensaje…
  contact jsonb,                                    -- emails, formulario, redes detectadas
  discard_reason text,
  screenshot text,                                  -- captura móvil (data URL) del análisis
  notes text not null default '',
  client_id uuid references public.clients(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  analyzed_at timestamptz,
  contacted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_studio_idx on public.leads(studio_id, status, score desc nulls last);
create unique index leads_place_unique on public.leads(studio_id, place_id) where place_id is not null;
create unique index leads_website_unique on public.leads(studio_id, lower(website)) where website is not null and place_id is null;

create trigger leads_touch before update on public.leads
  for each row execute function public.touch_updated_at();

alter table public.lead_searches enable row level security;
alter table public.lead_searches force row level security;
create policy lead_searches_member_all on public.lead_searches for all to authenticated
  using (public.is_studio_member(studio_id)) with check (public.is_studio_member(studio_id));

alter table public.leads enable row level security;
alter table public.leads force row level security;
create policy leads_member_all on public.leads for all to authenticated
  using (public.is_studio_member(studio_id)) with check (public.is_studio_member(studio_id));

grant select, insert, update, delete on public.leads, public.lead_searches to authenticated;
