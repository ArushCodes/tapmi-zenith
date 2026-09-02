ALTER TABLE public.deadlines
  ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS all_day BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT SELECT ON public.announcements TO anon;
GRANT ALL ON public.announcements TO service_role;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Announcements are readable" ON public.announcements;
CREATE POLICY "Announcements are readable" ON public.announcements
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Batch mods manage announcements" ON public.announcements;
CREATE POLICY "Batch mods manage announcements" ON public.announcements
  FOR ALL TO authenticated
  USING (public.is_batch_mod(auth.uid(), batch_id))
  WITH CHECK (public.is_batch_mod(auth.uid(), batch_id));

CREATE INDEX IF NOT EXISTS announcements_batch_created_idx
  ON public.announcements (batch_id, created_at DESC);

DROP TRIGGER IF EXISTS announcements_set_updated_at ON public.announcements;
CREATE TRIGGER announcements_set_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();