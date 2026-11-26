-- Puerta Cantera Residencial · Esquema Supabase
-- Tablas vinculadas: viviendas -> vehiculos -> marbetes -> registros_acceso

create extension if not exists pgcrypto;

create table if not exists public.viviendas (
  id uuid primary key default gen_random_uuid(),
  residente_titular text not null,
  calle text not null,
  numero_exterior text not null,
  numero_interior text,
  telefono text,
  tipo_residente text not null default 'Residente',
  al_corriente boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.vehiculos (
  id uuid primary key default gen_random_uuid(),
  vivienda_id uuid not null references public.viviendas(id) on delete cascade,
  placas text not null unique,
  created_at timestamptz not null default now(),
  marca text,
  modelo text,
  color text
);

create table if not exists public.marbetes (
  id uuid primary key default gen_random_uuid(),
  folio integer not null unique,
  codigo_qr uuid not null unique default gen_random_uuid(),
  vehiculo_id uuid not null references public.vehiculos(id) on delete cascade,
  estatus text not null default 'activo',
  fecha_emision date not null default current_date,
  fecha_vencimiento date,
  notas text
);

create table if not exists public.registros_acceso (
  id uuid primary key default gen_random_uuid(),
  marbete_id uuid not null references public.marbetes(id) on delete cascade,
  tipo_movimiento text not null,
  fecha_hora timestamptz not null default now(),
  guardia_id uuid references auth.users(id) on delete set null,
  observaciones text
);

create index if not exists idx_vehiculos_vivienda_id on public.vehiculos(vivienda_id);
create index if not exists idx_marbetes_vehiculo_id on public.marbetes(vehiculo_id);
create index if not exists idx_registros_acceso_marbete_id on public.registros_acceso(marbete_id);
create index if not exists idx_registros_acceso_fecha_hora on public.registros_acceso(fecha_hora desc);
