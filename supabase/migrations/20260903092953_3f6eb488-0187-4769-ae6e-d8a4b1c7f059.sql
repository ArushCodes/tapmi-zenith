CREATE TABLE public.exam_marks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deadline_id uuid NOT NULL REFERENCES public.deadlines(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 100,
  weightage numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (deadline_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_marks TO authenticated;
GRANT ALL ON public.exam_marks TO service_role;

ALTER TABLE public.exam_marks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own marks"
ON public.exam_marks FOR SELECT TO authenticated
USING (user_id = auth.uid() AND private.is_batch_member(auth.uid(), batch_id));

CREATE POLICY "Users insert their own marks"
ON public.exam_marks FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND private.is_batch_member(auth.uid(), batch_id));

CREATE POLICY "Users update their own marks"
ON public.exam_marks FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND private.is_batch_member(auth.uid(), batch_id))
WITH CHECK (user_id = auth.uid() AND private.is_batch_member(auth.uid(), batch_id));

CREATE POLICY "Users delete their own marks"
ON public.exam_marks FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER exam_marks_set_updated_at
BEFORE UPDATE ON public.exam_marks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX exam_marks_user_batch_idx ON public.exam_marks (user_id, batch_id);