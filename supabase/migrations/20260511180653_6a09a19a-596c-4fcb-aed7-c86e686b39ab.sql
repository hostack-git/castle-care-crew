
-- Weekly Rota Builder schema

CREATE TYPE rota_status AS ENUM ('draft','published');
CREATE TYPE rota_room_status AS ENUM ('to_clean','check_in','staying','free','maintenance');
CREATE TYPE rota_team_assignment AS ENUM ('housekeeping','cottages','breakfast','maintenance','off','special','onboarding','deep_cleaning','departure','arrive');
CREATE TYPE template_kind AS ENUM ('room_clean','cottage_clean','breakfast','checkin','maintenance','deep_clean','onboarding');

CREATE TABLE public.weekly_rotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL UNIQUE,
  status rota_status NOT NULL DEFAULT 'draft',
  created_by UUID,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rota_room_cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_id UUID NOT NULL REFERENCES public.weekly_rotas(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  status rota_room_status NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rota_id, room_id, day)
);

CREATE TABLE public.rota_team_cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_id UUID NOT NULL REFERENCES public.weekly_rotas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  day DATE NOT NULL,
  assignment rota_team_assignment NOT NULL,
  note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rota_id, user_id, day)
);

CREATE TABLE public.rota_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_id UUID NOT NULL REFERENCES public.weekly_rotas(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  responsible_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rota_id, day)
);

CREATE TABLE public.task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind template_kind NOT NULL UNIQUE,
  items TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Track generated tasks for idempotency
ALTER TABLE public.tasks ADD COLUMN rota_id UUID REFERENCES public.weekly_rotas(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD COLUMN rota_scope_key TEXT;
CREATE UNIQUE INDEX tasks_rota_scope_unique ON public.tasks(rota_id, rota_scope_key) WHERE rota_id IS NOT NULL;

-- RLS
ALTER TABLE public.weekly_rotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rota_room_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rota_team_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rota_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rotas viewable by signed-in" ON public.weekly_rotas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage rotas" ON public.weekly_rotas FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Room cells viewable" ON public.rota_room_cells FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage room cells" ON public.rota_room_cells FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Team cells viewable" ON public.rota_team_cells FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage team cells" ON public.rota_team_cells FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Checkins viewable" ON public.rota_checkins FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage checkins" ON public.rota_checkins FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Templates viewable" ON public.task_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage templates" ON public.task_templates FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Seed templates
INSERT INTO public.task_templates (kind, items) VALUES
('room_clean', ARRAY['Beds & linen','Bathroom','Towels','Bins','Amenities','Floor','Final check']),
('cottage_clean', ARRAY['Beds & linen','Bathroom','Kitchen','Fireplace','Bins','Heating','Floors','Towels','Final check']),
('breakfast', ARRAY['Set tables','Prepare hot drinks station','Lay out cereals, fruit, yoghurts, pastries','Take guest orders for cooked items','Clear and reset dining room']),
('checkin', ARRAY['Verify room is ready','Place welcome note & amenities','Check heating/lights','Greet guest at arrival','Hand over keys & guidebook']),
('maintenance', ARRAY['Check requested job and gather tools','Take before photo if relevant','Complete the repair safely','Take after photo and log notes','Return tools to workshop']),
('deep_clean', ARRAY['Move furniture and vacuum behind','Wash windows inside and out','Descale bathroom fixtures','Clean inside wardrobes & drawers','Steam clean carpets/rugs','Polish all surfaces','Final inspection']),
('onboarding', ARRAY['Welcome tour of the house','Introduce team & key contacts','Walk through daily routines','Review safety & emergency info','Hand over uniform & keys']);
