INSERT INTO public.profiles (id, email)
SELECT DISTINCT bm.user_id, u.email
FROM public.batch_memberships bm
JOIN auth.users u ON u.id = bm.user_id
LEFT JOIN public.profiles p ON p.id = bm.user_id
WHERE p.id IS NULL;

ALTER TABLE public.batch_memberships
  ADD CONSTRAINT batch_memberships_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;