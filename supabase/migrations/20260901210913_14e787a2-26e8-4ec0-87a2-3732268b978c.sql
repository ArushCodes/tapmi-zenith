CREATE TYPE public.membership_status AS ENUM ('pending','approved','rejected','removed');

CREATE TABLE public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, slug)
);
CREATE TABLE public.programmes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, slug)
);
CREATE TABLE public.batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id uuid NOT NULL REFERENCES public.programmes(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  start_year integer,
  end_year integer,
  is_public boolean NOT NULL DEFAULT true,
  attendance_threshold numeric NOT NULL DEFAULT 75,
  feed_token uuid NOT NULL DEFAULT gen_random_uuid(),
  registro_term_id text,
  ics_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, name)
);
CREATE TABLE public.batch_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section_id uuid REFERENCES public.sections(id) ON DELETE SET NULL,
  role public.app_role NOT NULL DEFAULT 'student',
  status public.membership_status NOT NULL DEFAULT 'pending',
  note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, user_id)
);

GRANT SELECT ON public.institutions TO anon; GRANT SELECT ON public.institutions TO authenticated; GRANT ALL ON public.institutions TO service_role;
GRANT SELECT ON public.schools TO anon; GRANT SELECT ON public.schools TO authenticated; GRANT ALL ON public.schools TO service_role;
GRANT SELECT ON public.programmes TO anon; GRANT SELECT ON public.programmes TO authenticated; GRANT ALL ON public.programmes TO service_role;
GRANT SELECT ON public.batches TO anon; GRANT SELECT, UPDATE ON public.batches TO authenticated; GRANT ALL ON public.batches TO service_role;
GRANT SELECT ON public.sections TO anon; GRANT SELECT, INSERT, UPDATE, DELETE ON public.sections TO authenticated; GRANT ALL ON public.sections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_memberships TO authenticated; GRANT ALL ON public.batch_memberships TO service_role;

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_memberships ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_batch_mod(_user_id uuid, _batch_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.batch_memberships m
    WHERE m.user_id = _user_id AND m.batch_id = _batch_id
      AND m.status = 'approved' AND m.role IN ('mod','admin')
  ) OR public.has_role(_user_id, 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_batch_member(_user_id uuid, _batch_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.batch_memberships m
    WHERE m.user_id = _user_id AND m.batch_id = _batch_id AND m.status = 'approved'
  ) OR public.has_role(_user_id, 'admin');
$$;

CREATE POLICY "institutions readable" ON public.institutions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "schools readable" ON public.schools FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "programmes readable" ON public.programmes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "batches readable" ON public.batches FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "batch mods update batch" ON public.batches FOR UPDATE TO authenticated
  USING (public.is_batch_mod(auth.uid(), id)) WITH CHECK (public.is_batch_mod(auth.uid(), id));

CREATE POLICY "sections readable" ON public.sections FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "batch mods manage sections" ON public.sections FOR ALL TO authenticated
  USING (public.is_batch_mod(auth.uid(), batch_id)) WITH CHECK (public.is_batch_mod(auth.uid(), batch_id));

CREATE POLICY "members view own membership" ON public.batch_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "batch mods view memberships" ON public.batch_memberships FOR SELECT TO authenticated
  USING (public.is_batch_mod(auth.uid(), batch_id));
CREATE POLICY "users request membership" ON public.batch_memberships FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending' AND role = 'student');
CREATE POLICY "batch mods manage memberships" ON public.batch_memberships FOR UPDATE TO authenticated
  USING (public.is_batch_mod(auth.uid(), batch_id)) WITH CHECK (public.is_batch_mod(auth.uid(), batch_id));
CREATE POLICY "batch mods remove memberships" ON public.batch_memberships FOR DELETE TO authenticated
  USING (public.is_batch_mod(auth.uid(), batch_id));

CREATE TRIGGER batches_set_updated_at BEFORE UPDATE ON public.batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed hierarchy
INSERT INTO public.institutions (name, slug) VALUES ('Manipal Academy of Higher Education', 'mahe');
INSERT INTO public.schools (institution_id, name, slug)
  SELECT id, 'T. A. Pai Management Institute', 'tapmi' FROM public.institutions WHERE slug = 'mahe';
INSERT INTO public.programmes (school_id, name, slug)
  SELECT id, 'Integrated Programme in Management', 'ipm' FROM public.schools WHERE slug = 'tapmi';
INSERT INTO public.batches (programme_id, name, slug, start_year, end_year)
  SELECT id, 'IPM 2026–2031', 'tapmi-ipm-2026', 2026, 2031 FROM public.programmes WHERE slug = 'ipm';

-- Scope deadlines to a batch
ALTER TABLE public.deadlines ADD COLUMN batch_id uuid REFERENCES public.batches(id) ON DELETE CASCADE;
UPDATE public.deadlines SET batch_id = (SELECT id FROM public.batches WHERE slug = 'tapmi-ipm-2026');
ALTER TABLE public.deadlines ALTER COLUMN batch_id SET NOT NULL;
CREATE INDEX deadlines_batch_idx ON public.deadlines (batch_id, due_at);

-- Existing global moderators become moderators of the seeded batch
INSERT INTO public.batch_memberships (batch_id, user_id, role, status, decided_at)
  SELECT b.id, ur.user_id, ur.role, 'approved', now()
  FROM public.user_roles ur, public.batches b
  WHERE b.slug = 'tapmi-ipm-2026' AND ur.role IN ('mod','admin')
  ON CONFLICT (batch_id, user_id) DO NOTHING;

-- Rewrite deadline policies to be batch-scoped
DROP POLICY "Moderators can delete deadlines" ON public.deadlines;
DROP POLICY "Moderators can insert deadlines" ON public.deadlines;
DROP POLICY "Moderators can update deadlines" ON public.deadlines;
DROP POLICY "Moderators can view all deadlines" ON public.deadlines;

CREATE POLICY "Batch mods delete deadlines" ON public.deadlines FOR DELETE TO authenticated
  USING (public.is_batch_mod(auth.uid(), batch_id));
CREATE POLICY "Batch mods insert deadlines" ON public.deadlines FOR INSERT TO authenticated
  WITH CHECK (public.is_batch_mod(auth.uid(), batch_id));
CREATE POLICY "Batch mods update deadlines" ON public.deadlines FOR UPDATE TO authenticated
  USING (public.is_batch_mod(auth.uid(), batch_id)) WITH CHECK (public.is_batch_mod(auth.uid(), batch_id));
CREATE POLICY "Batch mods view all deadlines" ON public.deadlines FOR SELECT TO authenticated
  USING (public.is_batch_mod(auth.uid(), batch_id));