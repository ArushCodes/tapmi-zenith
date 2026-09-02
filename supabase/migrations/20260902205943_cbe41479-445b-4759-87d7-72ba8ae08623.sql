CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _batch uuid;
BEGIN
  IF NEW.email IS NULL OR (
    lower(split_part(NEW.email, '@', 2)) <> 'learner.manipal.edu'
    AND lower(NEW.email) NOT IN ('moderator@test.com', 'member@test.com', 'madan@bhai.com')
  ) THEN
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
$$;