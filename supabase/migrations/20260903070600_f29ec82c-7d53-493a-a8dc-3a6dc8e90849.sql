ALTER TABLE public.class_sessions
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'batch';

ALTER TABLE public.class_sessions
  DROP CONSTRAINT IF EXISTS class_sessions_visibility_check;
ALTER TABLE public.class_sessions
  ADD CONSTRAINT class_sessions_visibility_check CHECK (visibility IN ('batch','private'));

DROP POLICY IF EXISTS "class sessions readable by batch members" ON public.class_sessions;
CREATE POLICY "class sessions readable by batch members"
  ON public.class_sessions FOR SELECT TO authenticated
  USING (
    private.is_batch_member(auth.uid(), batch_id)
    AND (visibility = 'batch' OR created_by = auth.uid())
  );

DROP POLICY IF EXISTS "members insert own private sessions" ON public.class_sessions;
CREATE POLICY "members insert own private sessions"
  ON public.class_sessions FOR INSERT TO authenticated
  WITH CHECK (
    private.is_batch_member(auth.uid(), batch_id)
    AND created_by = auth.uid()
    AND visibility = 'private'
    AND source = 'custom'
  );

DROP POLICY IF EXISTS "members update own private sessions" ON public.class_sessions;
CREATE POLICY "members update own private sessions"
  ON public.class_sessions FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND visibility = 'private')
  WITH CHECK (created_by = auth.uid() AND visibility = 'private');

DROP POLICY IF EXISTS "members delete own private sessions" ON public.class_sessions;
CREATE POLICY "members delete own private sessions"
  ON public.class_sessions FOR DELETE TO authenticated
  USING (created_by = auth.uid() AND visibility = 'private');