-- Deleting an account (e.g. a GDPR request) must not be blocked by order history:
-- keep the history rows, just forget who made the change.
alter table public.order_status_history
  drop constraint order_status_history_changed_by_fkey,
  add constraint order_status_history_changed_by_fkey
    foreign key (changed_by) references auth.users (id) on delete set null;
