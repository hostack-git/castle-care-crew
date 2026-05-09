
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS check_in_date date,
  ADD COLUMN IF NOT EXISTS check_out_date date;
