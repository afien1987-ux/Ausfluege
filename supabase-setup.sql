-- In Supabase: Projekt öffnen -> "SQL Editor" -> Neues Query -> diesen Code einfügen -> Run

create table if not exists pool_data (
  room_code text not null,
  data_key text not null,
  data_value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (room_code, data_key)
);

alter table pool_data enable row level security;

-- Erlaubt Lesen/Schreiben ohne Login (die App hat keinen Nutzer-Login,
-- der Familien-Code ist der einzige Schutz -> wähle einen nicht erratbaren Code!)
create policy "allow anon read/write"
  on pool_data
  for all
  using (true)
  with check (true);
