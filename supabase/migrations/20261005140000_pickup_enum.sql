-- New delivery option; separate migration because a new enum value can't be used
-- in the transaction that adds it.
alter type public.delivery_type add value if not exists 'pickup';
