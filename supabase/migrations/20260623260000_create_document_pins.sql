create table public.document_pins (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  request_id uuid        not null references public.document_requests(id) on delete cascade,
  pinned_at  timestamptz not null default now(),
  unique (user_id, request_id)
);

create index document_pins_user_id_idx on public.document_pins(user_id, pinned_at desc);

alter table public.document_pins enable row level security;

create policy "pins_select_own" on public.document_pins for select using (user_id = auth.uid());
create policy "pins_insert_own" on public.document_pins for insert with check (user_id = auth.uid());
create policy "pins_delete_own" on public.document_pins for delete using (user_id = auth.uid());
