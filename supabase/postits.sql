-- 비북스-M 가오픈 포스트잇. 하루(board_day) 단위 보드.
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
  author_id text,
  board_day text,
  created_at timestamptz not null default now()
);

alter table public.bbooks_postits add column if not exists author_id text;
alter table public.bbooks_postits add column if not exists board_day text;

-- 기존 행에 board_day가 없으면 서울 날짜로 채움
update public.bbooks_postits
set board_day = to_char(created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD')
where board_day is null;

create index if not exists bbooks_postits_board_day_idx on public.bbooks_postits (board_day);

alter table public.bbooks_postits enable row level security;

drop policy if exists "bbooks_postits_select" on public.bbooks_postits;
drop policy if exists "bbooks_postits_insert" on public.bbooks_postits;
drop policy if exists "bbooks_postits_update" on public.bbooks_postits;
drop policy if exists "bbooks_postits_delete" on public.bbooks_postits;

create policy "bbooks_postits_select"
  on public.bbooks_postits for select
  to anon, authenticated
  using (true);

create policy "bbooks_postits_insert"
  on public.bbooks_postits for insert
  to anon, authenticated
  with check (true);

create policy "bbooks_postits_update"
  on public.bbooks_postits for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "bbooks_postits_delete"
  on public.bbooks_postits for delete
  to anon, authenticated
  using (true);

do $$
begin
  alter publication supabase_realtime add table public.bbooks_postits;
exception
  when duplicate_object then null;
end $$;
