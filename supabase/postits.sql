-- 비북스-M 가오픈 포스트잇. Supabase에 적용되면 방문객끼리 공유됩니다.
-- (로컬만 쓸 때는 테이블이 없어도 앱은 localStorage로 동작)

create table if not exists public.bbooks_postits (
  id text primary key,
  text text not null check (char_length(text) > 0 and char_length(text) <= 40),
  color text not null,
  shape text not null,
  x double precision not null,
  y double precision not null,
  rot double precision not null default 0,
  nickname text,
  created_at timestamptz not null default now()
);

alter table public.bbooks_postits enable row level security;

drop policy if exists "bbooks_postits_select" on public.bbooks_postits;
drop policy if exists "bbooks_postits_insert" on public.bbooks_postits;

create policy "bbooks_postits_select"
  on public.bbooks_postits for select
  to anon, authenticated
  using (true);

create policy "bbooks_postits_insert"
  on public.bbooks_postits for insert
  to anon, authenticated
  with check (true);

-- upsert용 (같은 id 재전송)
drop policy if exists "bbooks_postits_update" on public.bbooks_postits;
create policy "bbooks_postits_update"
  on public.bbooks_postits for update
  to anon, authenticated
  using (true)
  with check (true);

-- 다른 탭·기기에서 바로 보이도록 Realtime
do $$
begin
  alter publication supabase_realtime add table public.bbooks_postits;
exception
  when duplicate_object then null;
end $$;
