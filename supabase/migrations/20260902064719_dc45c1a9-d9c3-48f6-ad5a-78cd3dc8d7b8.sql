-- Allow platform admins to grow the hierarchy (new institutions, schools, programmes, batches)
GRANT INSERT, UPDATE ON public.institutions TO authenticated;
GRANT INSERT, UPDATE ON public.schools TO authenticated;
GRANT INSERT, UPDATE ON public.programmes TO authenticated;
GRANT INSERT ON public.batches TO authenticated;

DROP POLICY IF EXISTS "admins insert institutions" ON public.institutions;
CREATE POLICY "admins insert institutions" ON public.institutions
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admins update institutions" ON public.institutions;
CREATE POLICY "admins update institutions" ON public.institutions
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins insert schools" ON public.schools;
CREATE POLICY "admins insert schools" ON public.schools
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admins update schools" ON public.schools;
CREATE POLICY "admins update schools" ON public.schools
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins insert programmes" ON public.programmes;
CREATE POLICY "admins insert programmes" ON public.programmes
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admins update programmes" ON public.programmes;
CREATE POLICY "admins update programmes" ON public.programmes
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins insert batches" ON public.batches;
CREATE POLICY "admins insert batches" ON public.batches
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Creator of a batch becomes an approved admin member of it
CREATE OR REPLACE FUNCTION public.claim_new_batch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.batch_memberships (batch_id, user_id, role, status, decided_by, decided_at)
    VALUES (NEW.id, auth.uid(), 'admin', 'approved', auth.uid(), now())
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS batches_claim_creator ON public.batches;
CREATE TRIGGER batches_claim_creator
AFTER INSERT ON public.batches
FOR EACH ROW EXECUTE FUNCTION public.claim_new_batch();

REVOKE EXECUTE ON FUNCTION public.claim_new_batch() FROM anon, authenticated;

-- Seed the IPM-2 batch under MAHE -> TAPMI -> IPM
INSERT INTO public.batches (programme_id, name, slug, start_year, end_year, is_public)
SELECT p.id, 'IPM-2', 'tapmi-ipm-2025', 2025, 2030, true
FROM public.programmes p
JOIN public.schools s ON s.id = p.school_id
JOIN public.institutions i ON i.id = s.institution_id
WHERE i.slug = (SELECT slug FROM public.institutions ORDER BY created_at LIMIT 1)
  AND p.name = 'IPM'
ON CONFLICT (slug) DO NOTHING;