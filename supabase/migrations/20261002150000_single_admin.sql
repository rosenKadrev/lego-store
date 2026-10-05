-- =====================================================================
-- Single admin: only the shop owner's email can ever be admin.
--   * The owner becomes admin automatically once their email is confirmed
--     (so nobody can grab the role by signing up with that address first).
--   * Everyone else is a customer; promoting anyone else is rejected,
--     even from the SQL editor.
-- =====================================================================

create or replace function public.admin_email()
returns text
language sql
immutable
set search_path = ''
as $$
  select 'roro.910102@gmail.com'::text;
$$;

create or replace function public.is_owner_account(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    where u.id = p_user_id
      and lower(u.email) = public.admin_email()
      and u.email_confirmed_at is not null
  );
$$;

-- Guard: role 'admin' is only valid for the confirmed owner account
create or replace function public.enforce_single_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role = 'admin' and not public.is_owner_account(new.id) then
    raise exception 'Only % can be an admin', public.admin_email();
  end if;
  return new;
end;
$$;

create trigger profiles_enforce_single_admin
  before insert or update of role on public.profiles
  for each row execute function public.enforce_single_admin();

-- Keep the role in sync with the account: on signup, email confirmation and email change
create or replace function public.sync_admin_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set role = case when public.is_owner_account(new.id) then 'admin' else 'customer' end::public.user_role
   where id = new.id
     and role is distinct from case when public.is_owner_account(new.id) then 'admin' else 'customer' end::public.user_role;
  return new;
end;
$$;

-- Fires after on_auth_user_created (triggers run in name order), so the profile exists
create trigger on_auth_user_sync_role
  after insert or update of email, email_confirmed_at on auth.users
  for each row execute function public.sync_admin_role();

revoke execute on function public.is_owner_account from public, anon, authenticated;

-- Apply to existing accounts
update public.profiles set role = 'customer' where role = 'admin' and not public.is_owner_account(id);
update public.profiles set role = 'admin' where public.is_owner_account(id);
