-- Ironly — tables Supabase pour la synchronisation multi-appareils.
-- À exécuter une seule fois dans l'éditeur SQL de ton projet Supabase
-- (le même projet que celui utilisé par Aurora : tables séparées,
-- préfixées "ironly_", donc aucun risque pour les données d'Aurora).

create extension if not exists pgcrypto;

create table if not exists ironly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  exercises jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists ironly_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  plan_id uuid references ironly_plans(id) on delete set null,
  plan_name text,
  exercises jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists ironly_custom_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  muscle_group text not null,
  metric text not null,
  created_at timestamptz not null default now()
);

alter table ironly_plans enable row level security;
alter table ironly_sessions enable row level security;
alter table ironly_custom_exercises enable row level security;

-- Chacun ne peut lire/écrire que ses propres données.
create policy "ironly_plans_select_own" on ironly_plans for select using (auth.uid() = user_id);
create policy "ironly_plans_insert_own" on ironly_plans for insert with check (auth.uid() = user_id);
create policy "ironly_plans_update_own" on ironly_plans for update using (auth.uid() = user_id);
create policy "ironly_plans_delete_own" on ironly_plans for delete using (auth.uid() = user_id);

create policy "ironly_sessions_select_own" on ironly_sessions for select using (auth.uid() = user_id);
create policy "ironly_sessions_insert_own" on ironly_sessions for insert with check (auth.uid() = user_id);
create policy "ironly_sessions_update_own" on ironly_sessions for update using (auth.uid() = user_id);
create policy "ironly_sessions_delete_own" on ironly_sessions for delete using (auth.uid() = user_id);

create policy "ironly_custom_exercises_select_own" on ironly_custom_exercises for select using (auth.uid() = user_id);
create policy "ironly_custom_exercises_insert_own" on ironly_custom_exercises for insert with check (auth.uid() = user_id);
create policy "ironly_custom_exercises_delete_own" on ironly_custom_exercises for delete using (auth.uid() = user_id);
