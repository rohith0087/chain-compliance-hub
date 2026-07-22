-- Per-user UI preferences.
-- First use case: which buyer dashboard layout the user prefers. The row
-- persists until the user picks a different view; absence of a row (or an
-- unknown value) means "overview" by default, enforced app-side.
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  buyer_dashboard_view text not null default 'overview'
    check (buyer_dashboard_view in ('overview', 'detailed', 'focus', 'pulse')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

-- A user can only ever see/write their own preferences row.
drop policy if exists "Users can view their own preferences" on public.user_preferences;
create policy "Users can view their own preferences"
  on public.user_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own preferences" on public.user_preferences;
create policy "Users can insert their own preferences"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own preferences" on public.user_preferences;
create policy "Users can update their own preferences"
  on public.user_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function public.update_updated_at_column();
