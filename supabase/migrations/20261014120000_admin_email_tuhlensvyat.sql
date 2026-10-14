-- The shop's own mailbox is the admin now; the old personal account becomes a customer.
-- The new account becomes admin once tuhlensvyat@gmail.com is confirmed (see 20261002150000_single_admin.sql).

create or replace function public.admin_email()
returns text
language sql
immutable
set search_path = ''
as $$
  select 'tuhlensvyat@gmail.com'::text;
$$;

-- Re-apply to existing accounts
update public.profiles set role = 'customer' where role = 'admin' and not public.is_owner_account(id);
update public.profiles set role = 'admin' where public.is_owner_account(id);
