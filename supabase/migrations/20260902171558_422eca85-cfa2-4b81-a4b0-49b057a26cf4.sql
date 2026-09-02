
-- batches: respect the is_public flag
DROP POLICY IF EXISTS "batches readable" ON public.batches;
CREATE POLICY "batches readable" ON public.batches
FOR SELECT TO anon, authenticated
USING (is_public = true OR private.is_batch_member(auth.uid(), id));

-- announcements
DROP POLICY IF EXISTS "Announcements are readable" ON public.announcements;
CREATE POLICY "Announcements readable by batch members" ON public.announcements
FOR SELECT TO authenticated
USING (private.is_batch_member(auth.uid(), batch_id));
REVOKE SELECT ON public.announcements FROM anon;

-- class sessions
DROP POLICY IF EXISTS "class sessions readable" ON public.class_sessions;
CREATE POLICY "class sessions readable by batch members" ON public.class_sessions
FOR SELECT TO authenticated
USING (private.is_batch_member(auth.uid(), batch_id));
REVOKE SELECT ON public.class_sessions FROM anon;

-- courses
DROP POLICY IF EXISTS "courses readable" ON public.courses;
CREATE POLICY "courses readable by batch members" ON public.courses
FOR SELECT TO authenticated
USING (private.is_batch_member(auth.uid(), batch_id));
REVOKE SELECT ON public.courses FROM anon;

-- sections
DROP POLICY IF EXISTS "sections readable" ON public.sections;
CREATE POLICY "sections readable by batch members" ON public.sections
FOR SELECT TO authenticated
USING (private.is_batch_member(auth.uid(), batch_id));
REVOKE SELECT ON public.sections FROM anon;

-- deadlines
DROP POLICY IF EXISTS "Approved deadlines are viewable by everyone" ON public.deadlines;
CREATE POLICY "Approved deadlines viewable by batch members" ON public.deadlines
FOR SELECT TO authenticated
USING (status = 'approved' AND private.is_batch_member(auth.uid(), batch_id));
REVOKE SELECT ON public.deadlines FROM anon;
