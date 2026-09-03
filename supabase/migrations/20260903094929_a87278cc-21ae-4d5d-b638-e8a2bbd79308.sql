CREATE TABLE public.batch_day_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  day date NOT NULL,
  color text NOT NULL DEFAULT '#22d3ee',
  label text,
  note text,
  is_off boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, day)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_day_marks TO authenticated;
GRANT ALL ON public.batch_day_marks TO service_role;

ALTER TABLE public.batch_day_marks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "day marks readable by batch members"
ON public.batch_day_marks FOR SELECT TO authenticated
USING (private.is_batch_member(auth.uid(), batch_id));

CREATE POLICY "batch mods manage day marks"
ON public.batch_day_marks FOR ALL TO authenticated
USING (private.is_batch_mod(auth.uid(), batch_id))
WITH CHECK (private.is_batch_mod(auth.uid(), batch_id));

CREATE TRIGGER batch_day_marks_set_updated_at
BEFORE UPDATE ON public.batch_day_marks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();