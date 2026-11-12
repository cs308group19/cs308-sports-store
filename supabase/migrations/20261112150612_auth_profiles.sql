-- SCRUM-19: authentication profiles and roles
--
-- Passwords live in auth.users (hashed by Supabase Auth). Everything else we know
-- about a user lives in public.profiles. Profiles are created by the NestJS backend
-- only (registration and the demo seed), so there is deliberately no trigger on
-- auth.users: a user created by hand in the dashboard has no profile and the
-- backend rejects it.

create type public.user_role as enum (
  'customer',
  'product_manager',
  'sales_manager',
  'support_agent'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null,
  -- AES-256-GCM ciphertext written by the backend ("v1:<iv>:<tag>:<data>").
  -- Required for customers, optional for staff; enforced in the backend DTO.
  tax_id_encrypted text,
  home_address text,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_lowercase check (email = lower(email)),
  constraint profiles_full_name_length check (char_length(btrim(full_name)) between 1 and 120),
  constraint profiles_home_address_length check (
    home_address is null or char_length(btrim(home_address)) between 5 and 500
  ),
  -- Defence in depth: a plaintext tax ID can never be stored by mistake.
  constraint profiles_tax_id_is_encrypted check (
    tax_id_encrypted is null or tax_id_encrypted like 'v1:%'
  )
);

comment on table public.profiles is 'Application profile and role for each auth user. Written by the backend only.';
comment on column public.profiles.role is 'Authoritative role. Changed only through the backend user:set-role script.';
comment on column public.profiles.tax_id_encrypted is 'AES-256-GCM ciphertext of the customer tax ID.';

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- The browser never reads or writes this table. All access goes through the backend,
-- which connects as the database owner. RLS is on, no policy exists for anon or
-- authenticated, and their table privileges are revoked as well.
alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated, public;

-- Custom Access Token Hook: copies the role into the JWT as the "user_role" claim so
-- clients can route by role. The backend does not trust this claim; it reads the role
-- from public.profiles on every request.
create function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  profile_role public.user_role;
begin
  claims := event -> 'claims';

  select p.role
    into profile_role
    from public.profiles p
   where p.id = (event ->> 'user_id')::uuid;

  if profile_role is not null then
    claims := jsonb_set(claims, '{user_role}', to_jsonb(profile_role::text));
    event := jsonb_set(event, '{claims}', claims);
  end if;

  return event;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

grant select on table public.profiles to supabase_auth_admin;

create policy "Auth admin can read profiles for the access token hook"
  on public.profiles
  as permissive
  for select
  to supabase_auth_admin
  using (true);
