CREATE TYPE public.app_role AS ENUM ('student', 'mod', 'admin');
CREATE TYPE public.deadline_type AS ENUM ('quiz', 'assignment', 'presentation', 'midterm', 'endterm');
CREATE TYPE public.work_mode AS ENUM ('individual', 'group');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_moderator(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('mod','admin'));
$$;

CREATE POLICY "Authenticated users can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  subject_code TEXT,
  type public.deadline_type NOT NULL DEFAULT 'assignment',
  due_at TIMESTAMPTZ NOT NULL,
  location TEXT,
  submission_link TEXT,
  work_mode public.work_mode NOT NULL DEFAULT 'individual',
  group_size INTEGER,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.deadlines TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deadlines TO authenticated;
GRANT ALL ON public.deadlines TO service_role;
ALTER TABLE public.deadlines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deadlines are viewable by everyone" ON public.deadlines FOR SELECT USING (true);
CREATE POLICY "Moderators can insert deadlines" ON public.deadlines FOR INSERT TO authenticated WITH CHECK (public.is_moderator(auth.uid()));
CREATE POLICY "Moderators can update deadlines" ON public.deadlines FOR UPDATE TO authenticated USING (public.is_moderator(auth.uid())) WITH CHECK (public.is_moderator(auth.uid()));
CREATE POLICY "Moderators can delete deadlines" ON public.deadlines FOR DELETE TO authenticated USING (public.is_moderator(auth.uid()));

CREATE INDEX deadlines_due_at_idx ON public.deadlines (due_at);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER deadlines_set_updated_at BEFORE UPDATE ON public.deadlines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.deadlines (title, subject, subject_code, type, due_at, location, submission_link, work_mode, group_size, notes) VALUES
('Quiz 04 — Sampling Distributions', 'Probability & Statistics', 'MTH-301', 'quiz', now() + interval '2 hours', 'Hall 2B', NULL, 'individual', NULL, 'Closed book. Calculator allowed.'),
('Lab 3: Process Scheduling', 'Operating Systems', 'CSE-214', 'assignment', now() + interval '2 days 4 hours', NULL, 'https://classroom.google.com/c/os-lab3', 'group', 4, 'Submit a single report per group.'),
('Midterm Examination', 'Data Structures', 'CSE-202', 'midterm', now() + interval '3 days 11 hours', 'Main Hall', NULL, 'individual', NULL, 'Bring student ID.'),
('Group Presentation — Market Structures', 'Business Economics', 'ECON-118', 'presentation', now() + interval '5 days 20 hours', 'Seminar Room 4', 'https://drive.tapmi.edu/econ118-decks', 'group', 5, '12 minutes per group + 3 min Q&A.'),
('Quiz 02 — Interpersonal Comms', 'Business Communication', 'COM-104', 'quiz', now() + interval '9 days', 'Hall 1A', NULL, 'individual', NULL, NULL),
('Endterm Examination', 'Database Management Systems', 'CSE-306', 'endterm', now() + interval '16 days', 'Main Hall', NULL, 'individual', NULL, 'Full syllabus.');