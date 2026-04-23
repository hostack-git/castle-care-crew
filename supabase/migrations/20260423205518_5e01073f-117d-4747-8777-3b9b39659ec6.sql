
-- =========================
-- ENUMS
-- =========================
CREATE TYPE public.app_role AS ENUM ('admin', 'volunteer');
CREATE TYPE public.task_type AS ENUM ('housekeeping', 'breakfast', 'dinner', 'cottages', 'maintenance', 'laundry', 'special');
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed', 'skipped');
CREATE TYPE public.app_language AS ENUM ('en', 'pt', 'es', 'de');

-- =========================
-- UPDATED_AT helper
-- =========================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =========================
-- PROFILES
-- =========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  nationality TEXT,
  language public.app_language NOT NULL DEFAULT 'en',
  phone TEXT,
  email TEXT,
  passport_number TEXT,
  passport_url TEXT,
  avatar_url TEXT,
  bio TEXT,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- USER ROLES (separate table — security best practice)
-- =========================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin');
$$;

-- =========================
-- AUTO-CREATE profile + role on signup
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'volunteer');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- TASKS
-- =========================
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type public.task_type NOT NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  status public.task_status NOT NULL DEFAULT 'pending',
  location TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tasks_assigned ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_date ON public.tasks(scheduled_date);
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- TASK CHECKLIST ITEMS
-- =========================
CREATE TABLE public.task_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT false,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_checklist_task ON public.task_checklist_items(task_id);

-- =========================
-- ANNOUNCEMENTS
-- =========================
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_ann_updated_at BEFORE UPDATE ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- GUIDEBOOK
-- =========================
CREATE TABLE public.guidebook_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  language public.app_language NOT NULL DEFAULT 'en',
  order_index INT NOT NULL DEFAULT 0,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.guidebook_sections ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_guidebook_lang ON public.guidebook_sections(language);
CREATE TRIGGER trg_guide_updated_at BEFORE UPDATE ON public.guidebook_sections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- ADVENTURES (social feed)
-- =========================
CREATE TABLE public.adventures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.adventures ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_adv_created ON public.adventures(created_at DESC);

CREATE TABLE public.adventure_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adventure_id UUID NOT NULL REFERENCES public.adventures(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(adventure_id, user_id)
);
ALTER TABLE public.adventure_likes ENABLE ROW LEVEL SECURITY;

-- =========================
-- OBSERVATIONS (admin-only feedback)
-- =========================
CREATE TABLE public.observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.observations ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_obs_volunteer ON public.observations(volunteer_id);

-- =========================
-- CHAT MESSAGES (per-user history)
-- =========================
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_chat_user ON public.chat_messages(user_id, created_at);

-- =========================
-- RLS POLICIES
-- =========================

-- profiles: everyone signed in can view, owners can update, admins can update all
CREATE POLICY "Profiles viewable by signed-in users"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins update any profile"
  ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Owners insert own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- user_roles: users see own; admins see all and manage
CREATE POLICY "Users see own roles"
  ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins see all roles"
  ON public.user_roles FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- tasks: all signed-in can view, admins manage, volunteers update own status
CREATE POLICY "Tasks viewable by signed-in users"
  ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert tasks"
  ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update tasks"
  ON public.tasks FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Assignees update own task status"
  ON public.tasks FOR UPDATE TO authenticated USING (auth.uid() = assigned_to);
CREATE POLICY "Admins delete tasks"
  ON public.tasks FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- checklist items: viewable by all signed-in; assignee or admin update
CREATE POLICY "Checklist viewable by signed-in"
  ON public.task_checklist_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage checklist"
  ON public.task_checklist_items FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Assignees update checklist"
  ON public.task_checklist_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.assigned_to = auth.uid()));

-- announcements: all view, admins manage
CREATE POLICY "Ann viewable by signed-in"
  ON public.announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage ann"
  ON public.announcements FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- guidebook: all view, admins manage
CREATE POLICY "Guidebook viewable by signed-in"
  ON public.guidebook_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage guidebook"
  ON public.guidebook_sections FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- adventures: all view, all signed-in post, owner/admin delete
CREATE POLICY "Adv viewable by signed-in"
  ON public.adventures FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in post adventures"
  ON public.adventures FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners or admins delete adventures"
  ON public.adventures FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Owners update adventures"
  ON public.adventures FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- adventure likes
CREATE POLICY "Likes viewable by signed-in"
  ON public.adventure_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users like"
  ON public.adventure_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unlike own"
  ON public.adventure_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- observations: admins only
CREATE POLICY "Admins read observations"
  ON public.observations FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage observations"
  ON public.observations FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- chat: owner only
CREATE POLICY "Users read own chat"
  ON public.chat_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own chat"
  ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own chat"
  ON public.chat_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- STORAGE BUCKETS
-- =========================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('passports', 'passports', false),
  ('adventures', 'adventures', true),
  ('observations', 'observations', false),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- passports: owner reads own, admins read all, owner uploads to own folder
CREATE POLICY "Owners read own passport"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'passports' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Admins read all passports"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'passports' AND public.is_admin(auth.uid()));
CREATE POLICY "Owners upload own passport"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'passports' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners update own passport"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'passports' AND auth.uid()::text = (storage.foldername(name))[1]);

-- adventures: public read, signed-in upload to own folder
CREATE POLICY "Public read adventures bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'adventures');
CREATE POLICY "Signed-in upload adventures"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'adventures' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners delete own adventure media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'adventures' AND auth.uid()::text = (storage.foldername(name))[1]);

-- observations: admin only
CREATE POLICY "Admins read observations bucket"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'observations' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins upload observations"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'observations' AND public.is_admin(auth.uid()));

-- avatars: public read, owner upload to own folder
CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Owners upload own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners update own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =========================
-- SEED guidebook (English baseline from Torridon PDF)
-- =========================
INSERT INTO public.guidebook_sections (section, title, content, language, order_index, icon) VALUES
('welcome', 'Welcome to Torridonia', 'Welcome to one of the most beautiful corners of the Scottish Highlands! Torridon is more than a guesthouse — it is a living community combining hospitality, creativity and connection with nature. This guide will help your stay be smooth, pleasant and meaningful.', 'en', 1, 'Sparkles'),
('arrival', 'When you arrive', '- You will be settled into one of the rooms — feel free to decorate it.\n- Take a photo of your passport and send it to Felix.\n- Share emergency contact info with Felix.\n- Explore the property — it will keep you busy for a while ;)', 'en', 2, 'DoorOpen'),
('wifi', 'Wi-Fi & contacts', 'Wi-Fi network "Wifi Pass: torridon" — password: torridon.\nIn room 3: TP-Link_84E6 — password: 35037194.\n\nContact: Sarah & Felix Von Racknitz, Torridon House, Achnasheen IV22 2HA.', 'en', 3, 'Wifi'),
('house-rules', 'House rules', '- **Showers**: between 10:00 and 21:00.\n- **Quiet hours**: 22:00 to 08:00.\n- Close doors and turn off lights in shared spaces.\n- Use the staff entrance between 16:00 and 10:00.\n- Keep your room tidy; on departure place used linen in the staff basket.', 'en', 4, 'Home'),
('kitchen', 'Kitchen etiquette', 'The kitchen is the heart of the house. Label your personal food — unlabeled items are communal. Two volunteers cook dinner each day to encourage community. Recycle into the right bins (green for plastics/cans, metal for general waste, glass box and paper bag near the fridge).', 'en', 5, 'UtensilsCrossed'),
('housekeeping', 'Housekeeping checklist', '- Strip and remake beds with fresh linen\n- 1 large + 1 small towel per guest on the bed\n- Wipe all surfaces (green cloth)\n- Vacuum the room\n- Empty bins, replace bag\n- Bathroom: surfaces (green), glass (blue), toilet (pink)\n- Always restock the linen cupboards.', 'en', 6, 'BedDouble'),
('cottages', 'Cottages', 'Each cottage has its own particularities — read the specific notes. Bring: 1 scourer, toilet roll, firelighters/matches. Vacuum and mop are stored under the stairs (in Stables: first room). Always leave the shower dry and the glass clean.', 'en', 7, 'Trees'),
('laundry', 'Laundry', 'Big machine: full cup of detergent + full cup of fabric conditioner. Small machine 60E for towels and sheets. Tumble dryers ONLY for towels — empty filter when EFO appears. Stained items go on the staff shelf. Fold long sides in half — keep tags hidden.', 'en', 8, 'Shirt'),
('emergency', 'Emergencies', 'In case of emergency contact Felix or Sarah immediately. Nearest hospital: Raigmore Hospital, Inverness. Always share your location if going on a long walk.', 'en', 9, 'Siren');

-- Portuguese translations
INSERT INTO public.guidebook_sections (section, title, content, language, order_index, icon) VALUES
('welcome', 'Bem-vindo(a) à Torridonia', 'Bem-vindo a um dos cantos mais lindos das Terras Altas da Escócia! Torridon é mais do que uma guesthouse — é uma comunidade viva que combina hospitalidade, criatividade e conexão com a natureza.', 'pt', 1, 'Sparkles'),
('arrival', 'Quando você chegar', '- Você será acomodado num dos quartos — decore-o como quiser.\n- Tire foto do passaporte e envie ao Felix.\n- Passe contato de emergência ao Felix.\n- Conheça toda a propriedade.', 'pt', 2, 'DoorOpen'),
('wifi', 'Wi-Fi e contatos', 'Rede "Wifi Pass: torridon" — senha: torridon.\nNo quarto 3: TP-Link_84E6 — senha: 35037194.\n\nContato: Sarah & Felix Von Racknitz, Torridon House, Achnasheen IV22 2HA.', 'pt', 3, 'Wifi'),
('house-rules', 'Regras da casa', '- **Banhos**: entre 10h e 21h.\n- **Silêncio**: 22h às 8h.\n- Feche portas e apague luzes em áreas comuns.\n- Use a entrada da equipe entre 16h e 10h.', 'pt', 4, 'Home'),
('kitchen', 'Cozinha', 'Rotule sua comida pessoal — itens sem rótulo são comunitários. Dois voluntários cozinham por dia. Recicle nas caixas certas.', 'pt', 5, 'UtensilsCrossed'),
('housekeeping', 'Checklist de quartos', '- Trocar roupa de cama\n- 1 toalha grande + 1 pequena por hóspede\n- Limpar todas as superfícies\n- Aspirar\n- Esvaziar lixos\n- Banheiro: superfícies (verde), vidros (azul), sanita (rosa)', 'pt', 6, 'BedDouble'),
('cottages', 'Cottages', 'Cada cottage tem particularidades. Leve: esponja, papel higiênico, fósforos. Aspirador e mop ficam sob a escada.', 'pt', 7, 'Trees'),
('laundry', 'Lavanderia', 'Máquina grande: copo cheio de detergente + amaciante. Pequena 60E para toalhas/lençóis. Secadora só para toalhas. Itens manchados vão na prateleira da equipe.', 'pt', 8, 'Shirt'),
('emergency', 'Emergências', 'Em emergência contate Felix ou Sarah. Hospital: Raigmore Hospital, Inverness.', 'pt', 9, 'Siren');

-- Sample announcements
INSERT INTO public.announcements (title, content, priority) VALUES
('Welcome to the new platform!', 'We are moving away from WhatsApp for task management. Check your dashboard daily — your weekly schedule lives here now.', 'high'),
('Community dinner Friday', 'Join us at 19:30 in the main kitchen. Bring a song to share.', 'normal');
