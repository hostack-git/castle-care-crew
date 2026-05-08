DO $$ BEGIN
  CREATE TYPE public.room_status AS ENUM (
    'ready', 'booked', 'checked_in', 'needs_cleaning', 'cleaning', 'maintenance'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.room_kind AS ENUM ('room', 'cottage');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind public.room_kind NOT NULL DEFAULT 'room',
  status public.room_status NOT NULL DEFAULT 'ready',
  guest_name text,
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rooms viewable by signed-in"
  ON public.rooms FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage rooms"
  ON public.rooms FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Room managers update rooms"
  ON public.rooms FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'room_manager'));

CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER TABLE public.rooms REPLICA IDENTITY FULL;

INSERT INTO public.rooms (name, kind, status) VALUES
  ('Riverview Room', 'room', 'ready'),
  ('Loch View Room', 'room', 'booked'),
  ('Garden Room', 'room', 'needs_cleaning'),
  ('Heather Cottage', 'cottage', 'checked_in'),
  ('Glen Cottage', 'cottage', 'maintenance');