CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.batches(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'feedback',
  message text NOT NULL,
  page text,
  status text NOT NULL DEFAULT 'open',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.feedback TO authenticated;
GRANT UPDATE, DELETE ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users send feedback" ON public.feedback
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "users view own feedback" ON public.feedback
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update feedback" ON public.feedback
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete feedback" ON public.feedback
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER feedback_set_updated_at BEFORE UPDATE ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sign-up assigns the chosen batch automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _batch uuid;
BEGIN
  IF NEW.email IS NULL OR lower(split_part(NEW.email, '@', 2)) <> 'learner.manipal.edu' THEN
    RAISE EXCEPTION 'Sign-ups are restricted to @learner.manipal.edu email addresses';
  END IF;

  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student')
  ON CONFLICT (user_id, role) DO NOTHING;

  BEGIN
    _batch := (NEW.raw_user_meta_data ->> 'batch_id')::uuid;
  EXCEPTION WHEN others THEN
    _batch := NULL;
  END;

  IF _batch IS NOT NULL AND EXISTS (SELECT 1 FROM public.batches b WHERE b.id = _batch) THEN
    INSERT INTO public.batch_memberships (batch_id, user_id, role, status, decided_at)
    VALUES (_batch, NEW.id, 'student', 'approved', now())
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Membership creation is moderator-driven only
DROP POLICY IF EXISTS "users request membership" ON public.batch_memberships;
CREATE POLICY "mods add members" ON public.batch_memberships
  FOR INSERT TO authenticated
  WITH CHECK (public.is_batch_mod(auth.uid(), batch_id));