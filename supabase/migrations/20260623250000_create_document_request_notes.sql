create table public.document_request_notes (
  id          uuid        primary key default gen_random_uuid(),
  request_id  uuid        not null references public.document_requests(id) on delete cascade,
  author_id   uuid        not null references public.profiles(id),
  body        text        not null check(char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create index document_request_notes_request_id_idx
  on public.document_request_notes(request_id, created_at desc);

alter table public.document_request_notes enable row level security;

create policy "buyer_read_notes"
  on public.document_request_notes for select
  using (
    exists (
      select 1 from public.document_requests dr
      where dr.id = document_request_notes.request_id
        and (
          exists (select 1 from public.buyers b where b.id = dr.buyer_id and b.profile_id = auth.uid())
          or
          exists (select 1 from public.company_users cu
                  where cu.profile_id = auth.uid()
                    and cu.company_id = dr.buyer_id
                    and cu.company_type = 'buyer'
                    and cu.status = 'active')
        )
    )
  );

create policy "buyer_insert_notes"
  on public.document_request_notes for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.document_requests dr
      where dr.id = document_request_notes.request_id
        and (
          exists (select 1 from public.buyers b where b.id = dr.buyer_id and b.profile_id = auth.uid())
          or
          exists (select 1 from public.company_users cu
                  where cu.profile_id = auth.uid()
                    and cu.company_id = dr.buyer_id
                    and cu.company_type = 'buyer'
                    and cu.status = 'active')
        )
    )
  );
