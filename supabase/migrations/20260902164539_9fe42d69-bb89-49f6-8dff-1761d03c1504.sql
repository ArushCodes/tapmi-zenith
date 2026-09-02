
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

ALTER FUNCTION public.has_role(uuid, app_role) SET SCHEMA private;
ALTER FUNCTION public.is_batch_member(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.is_batch_mod(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.is_moderator(uuid) SET SCHEMA private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role); $$;

CREATE OR REPLACE FUNCTION private.is_moderator(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('mod','admin')); $$;

CREATE OR REPLACE FUNCTION private.is_batch_member(_user_id uuid, _batch_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.batch_memberships m
    WHERE m.user_id = _user_id AND m.batch_id = _batch_id AND m.status = 'approved'
  ) OR private.has_role(_user_id, 'admin');
$$;

CREATE OR REPLACE FUNCTION private.is_batch_mod(_user_id uuid, _batch_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.batch_memberships m
    WHERE m.user_id = _user_id AND m.batch_id = _batch_id
      AND m.status = 'approved' AND m.role IN ('mod','admin')
  ) OR private.has_role(_user_id, 'admin');
$$;

CREATE OR REPLACE FUNCTION private.shares_batch(_viewer uuid, _target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.batch_memberships a
    JOIN public.batch_memberships b ON b.batch_id = a.batch_id
    WHERE a.user_id = _viewer AND a.status = 'approved'
      AND b.user_id = _target AND b.status = 'approved'
  );
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_moderator(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_batch_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_batch_mod(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.shares_batch(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_moderator(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_batch_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_batch_mod(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.shares_batch(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.claim_new_batch() FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.batch_feed_tokens (
  batch_id uuid PRIMARY KEY REFERENCES public.batches(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.batch_feed_tokens (batch_id, token)
SELECT id, feed_token FROM public.batches ON CONFLICT DO NOTHING;
REVOKE ALL ON public.batch_feed_tokens FROM anon, authenticated;
GRANT ALL ON public.batch_feed_tokens TO service_role;
ALTER TABLE public.batch_feed_tokens ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.batches DROP COLUMN IF EXISTS feed_token;

CREATE OR REPLACE FUNCTION public.claim_new_batch_feed_token()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.batch_feed_tokens (batch_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_new_batch_feed_token() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_batch_feed_token ON public.batches;
CREATE TRIGGER trg_batch_feed_token AFTER INSERT ON public.batches
FOR EACH ROW EXECUTE FUNCTION public.claim_new_batch_feed_token();

DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Profiles visible to self, batchmates and moderators"
ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR private.shares_batch(auth.uid(), id)
  OR private.is_moderator(auth.uid())
);
