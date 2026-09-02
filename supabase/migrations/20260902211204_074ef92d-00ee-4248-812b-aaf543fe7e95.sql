DROP POLICY IF EXISTS "batches readable" ON public.batches;
CREATE POLICY "public batches readable by visitors" ON public.batches FOR SELECT TO anon USING (is_public = true);
CREATE POLICY "batches readable by members" ON public.batches FOR SELECT TO authenticated USING (is_public = true OR private.is_batch_member(auth.uid(), id));