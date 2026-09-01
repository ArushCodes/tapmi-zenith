CREATE TYPE public.session_source AS ENUM ('registro','ics','custom');
CREATE TYPE public.attendance_status AS ENUM ('present','absent','late','excused');
CREATE TYPE public.mark_source AS ENUM ('self','rep');
CREATE TYPE public.review_status AS ENUM ('pending','approved','rejected');

CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  short_name text NOT NULL,
  faculty_name text,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, code)
);

CREATE TABLE public.class_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  source public.session_source NOT NULL DEFAULT 'custom',
  external_uid text,
  title text NOT NULL,
  course_code text,
  course_name text,
  short_name text,
  faculty_name text,
  section text,
  classroom text,
  session_number integer,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  is_holiday boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, external_uid)
);
CREATE INDEX class_sessions_batch_start_idx ON public.class_sessions (batch_id, start_at);

CREATE TABLE public.attendance_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.attendance_status NOT NULL,
  mark_source public.mark_source NOT NULL DEFAULT 'self',
  reason text,
  marked_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id, mark_source)
);
CREATE INDEX attendance_batch_user_idx ON public.attendance_marks (batch_id, user_id);

CREATE TABLE public.batch_sync_state (
  batch_id uuid PRIMARY KEY REFERENCES public.batches(id) ON DELETE CASCADE,
  last_run_at timestamptz,
  last_success_at timestamptz,
  lease_until timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0,
  paused boolean NOT NULL DEFAULT false,
  last_error text,
  last_count integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.batch_registro_credentials (
  batch_id uuid PRIMARY KEY REFERENCES public.batches(id) ON DELETE CASCADE,
  username text NOT NULL,
  password text NOT NULL,
  term_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

CREATE TABLE public.email_ingest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  message_key text,
  subject text,
  sender text,
  received_at timestamptz NOT NULL DEFAULT now(),
  body text,
  extracted jsonb,
  confidence numeric,
  status public.review_status NOT NULL DEFAULT 'pending',
  error text,
  deadline_id uuid REFERENCES public.deadlines(id) ON DELETE SET NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, message_key)
);

ALTER TABLE public.deadlines ADD COLUMN source text NOT NULL DEFAULT 'manual';

GRANT SELECT ON public.courses TO anon; GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated; GRANT ALL ON public.courses TO service_role;
GRANT SELECT ON public.class_sessions TO anon; GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_sessions TO authenticated; GRANT ALL ON public.class_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_marks TO authenticated; GRANT ALL ON public.attendance_marks TO service_role;
GRANT SELECT ON public.batch_sync_state TO authenticated; GRANT ALL ON public.batch_sync_state TO service_role;
GRANT ALL ON public.batch_registro_credentials TO service_role;
GRANT SELECT, UPDATE ON public.email_ingest TO authenticated; GRANT ALL ON public.email_ingest TO service_role;

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_registro_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_ingest ENABLE ROW LEVEL SECURITY;

CREATE POLICY "courses readable" ON public.courses FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "batch mods manage courses" ON public.courses FOR ALL TO authenticated
  USING (public.is_batch_mod(auth.uid(), batch_id)) WITH CHECK (public.is_batch_mod(auth.uid(), batch_id));

CREATE POLICY "class sessions readable" ON public.class_sessions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "batch mods manage sessions" ON public.class_sessions FOR ALL TO authenticated
  USING (public.is_batch_mod(auth.uid(), batch_id)) WITH CHECK (public.is_batch_mod(auth.uid(), batch_id));

CREATE POLICY "members view attendance" ON public.attendance_marks FOR SELECT TO authenticated
  USING (public.is_batch_member(auth.uid(), batch_id));
CREATE POLICY "members self mark" ON public.attendance_marks FOR INSERT TO authenticated
  WITH CHECK (
    public.is_batch_member(auth.uid(), batch_id)
    AND marked_by = auth.uid()
    AND ((mark_source = 'self' AND user_id = auth.uid())
         OR (mark_source = 'rep' AND public.is_batch_mod(auth.uid(), batch_id)))
  );
CREATE POLICY "members update own mark" ON public.attendance_marks FOR UPDATE TO authenticated
  USING ((mark_source = 'self' AND user_id = auth.uid()) OR public.is_batch_mod(auth.uid(), batch_id))
  WITH CHECK ((mark_source = 'self' AND user_id = auth.uid()) OR public.is_batch_mod(auth.uid(), batch_id));
CREATE POLICY "members delete own mark" ON public.attendance_marks FOR DELETE TO authenticated
  USING ((mark_source = 'self' AND user_id = auth.uid()) OR public.is_batch_mod(auth.uid(), batch_id));

CREATE POLICY "members view sync state" ON public.batch_sync_state FOR SELECT TO authenticated
  USING (public.is_batch_member(auth.uid(), batch_id));

CREATE POLICY "batch mods view email queue" ON public.email_ingest FOR SELECT TO authenticated
  USING (public.is_batch_mod(auth.uid(), batch_id));
CREATE POLICY "batch mods review email queue" ON public.email_ingest FOR UPDATE TO authenticated
  USING (public.is_batch_mod(auth.uid(), batch_id)) WITH CHECK (public.is_batch_mod(auth.uid(), batch_id));

CREATE TRIGGER class_sessions_set_updated_at BEFORE UPDATE ON public.class_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER attendance_marks_set_updated_at BEFORE UPDATE ON public.attendance_marks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.batch_sync_state (batch_id) SELECT id FROM public.batches;

INSERT INTO public.courses (batch_id, code, name, short_name, faculty_name)
SELECT b.id, c.code, c.name, c.short_name, c.faculty FROM public.batches b,
(VALUES
  ('HRM 1101','Foundations of Psychology','Psychology','Manoj'),
  ('MGT 1101','Introduction to Sociology','Sociology','Melvin'),
  ('OPS 1101','Basic Mathematics – I','Mathematics','Ritu'),
  ('OPS 1102','Basics of Statistics','Statistics','Sandhiya'),
  ('HRM 1102','English Language and Literature - I','English','Aparna'),
  ('ANT 1101','Working with Spreadsheets','Spreadsheets','Pratik'),
  ('ITS 1101','Introduction to AI','AI','Pallavi'),
  ('HRM 1103','Working in Groups and Team Building','Team Building','Arunima')
) AS c(code, name, short_name, faculty)
WHERE b.slug = 'tapmi-ipm-2026';