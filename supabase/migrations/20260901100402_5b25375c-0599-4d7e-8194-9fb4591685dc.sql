ALTER TYPE public.deadline_type ADD VALUE IF NOT EXISTS 'guest_lecture';
ALTER TYPE public.deadline_type ADD VALUE IF NOT EXISTS 'other';

ALTER TABLE public.deadlines
  ADD COLUMN IF NOT EXISTS is_major boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';

DO $$ BEGIN
  ALTER TABLE public.deadlines
    ADD CONSTRAINT deadlines_status_check CHECK (status IN ('pending','approved','rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

UPDATE public.deadlines SET status = 'approved' WHERE status IS NULL;
UPDATE public.deadlines SET is_major = true WHERE type IN ('midterm','endterm');

CREATE INDEX IF NOT EXISTS deadlines_status_due_idx ON public.deadlines (status, due_at);

DROP POLICY IF EXISTS "Deadlines are viewable by everyone" ON public.deadlines;

CREATE POLICY "Approved deadlines are viewable by everyone"
  ON public.deadlines FOR SELECT TO anon, authenticated
  USING (status = 'approved');

CREATE POLICY "Users can view their own submissions"
  ON public.deadlines FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Moderators can view all deadlines"
  ON public.deadlines FOR SELECT TO authenticated
  USING (public.is_moderator(auth.uid()));

CREATE POLICY "Users can submit pending deadlines"
  ON public.deadlines FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND status = 'pending');