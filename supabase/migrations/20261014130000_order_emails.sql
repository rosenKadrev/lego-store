-- =====================================================================
-- Order e-mails (outbox). The database queues them; the Edge Function
-- `order-emails` sends whatever is pending through Brevo.
--   * 'placed'  — new order: confirmation to the customer + notice to the shop
--   * 'shipped' — order handed to the courier: tracking number to the customer
-- The site pokes the function right after placing an order / marking it shipped;
-- anything that failed is retried on the next poke (max 5 attempts).
-- =====================================================================

create type public.order_email_kind as enum ('placed', 'shipped');

create table public.order_emails (
  id         bigint generated always as identity primary key,
  order_id   bigint not null references public.orders (id) on delete cascade,
  kind       public.order_email_kind not null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at    timestamptz,
  attempts   int not null default 0,
  last_error text,
  unique (order_id, kind)
);
create index order_emails_pending_idx on public.order_emails (id) where sent_at is null;

-- Only the Edge Function (service role) touches the queue
alter table public.order_emails enable row level security;
revoke all on public.order_emails from anon, authenticated;

-- Queue an e-mail whenever an order enters a status that has one
create or replace function public.queue_order_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'new' then
    insert into public.order_emails (order_id, kind) values (new.order_id, 'placed')
    on conflict do nothing;
  elsif new.status = 'shipped' then
    insert into public.order_emails (order_id, kind) values (new.order_id, 'shipped')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger order_status_history_queue_email
  after insert on public.order_status_history
  for each row execute function public.queue_order_email();

-- Hands out pending e-mails to one sender at a time; a claim older than 5 minutes is considered lost
create or replace function public.claim_order_emails(p_limit int default 20)
returns setof public.order_emails
language sql
security definer
set search_path = ''
as $$
  update public.order_emails e
     set claimed_at = now(), attempts = e.attempts + 1
   where e.id in (
     select q.id from public.order_emails q
      where q.sent_at is null
        and q.attempts < 5
        and (q.claimed_at is null or q.claimed_at < now() - interval '5 minutes')
      order by q.id
      limit p_limit
      for update skip locked
   )
  returning e.*;
$$;

revoke execute on function public.claim_order_emails from public, anon, authenticated;
revoke execute on function public.queue_order_email from public, anon, authenticated;
