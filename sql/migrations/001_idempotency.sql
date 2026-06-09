create table if not exists idempotency_keys (
  key text primary key,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idempotency_keys_status_idx on idempotency_keys (status);
