-- Magazines become a fourth kind of sellable item. Separate migration: a new enum value
-- can't be used in the same transaction that adds it.
alter type public.item_type add value if not exists 'magazine';
