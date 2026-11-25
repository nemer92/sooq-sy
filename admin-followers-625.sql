CREATE TABLE IF NOT EXISTS public.admin_follower_display_counts (
  admin_id uuid PRIMARY KEY REFERENCES public.admins(user_id) ON DELETE CASCADE,
  display_count bigint NOT NULL DEFAULT 625 CHECK (display_count >= 0)
);

ALTER TABLE public.admin_follower_display_counts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_follower_display_counts FROM PUBLIC, anon, authenticated;

INSERT INTO public.admin_follower_display_counts (admin_id, display_count)
VALUES ('2040e537-6308-4484-8744-ebaddf4b1587', 625)
ON CONFLICT (admin_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_admin_follower_display_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_admin_id uuid;
  v_delta integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_admin_id := NEW.followed_id;
    v_delta := 1;
  ELSE
    v_admin_id := OLD.followed_id;
    v_delta := -1;
  END IF;

  UPDATE public.admin_follower_display_counts
  SET display_count = GREATEST(0, display_count + v_delta)
  WHERE admin_id = v_admin_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_admin_follower_display_count() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_admin_follower_display_count ON public.user_follows;
CREATE TRIGGER trg_sync_admin_follower_display_count
AFTER INSERT OR DELETE ON public.user_follows
FOR EACH ROW
EXECUTE FUNCTION public.sync_admin_follower_display_count();

CREATE OR REPLACE FUNCTION public.get_user_follow_counts(p_user_id uuid)
RETURNS TABLE(followers_count bigint, following_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    CASE
      WHEN EXISTS (
        SELECT 1 FROM public.admins a WHERE a.user_id = p_user_id
      )
      THEN COALESCE(
        (SELECT c.display_count
         FROM public.admin_follower_display_counts c
         WHERE c.admin_id = p_user_id),
        625
      )
      ELSE (
        SELECT count(*) FROM public.user_follows
        WHERE followed_id = p_user_id
      )
    END,
    (
      SELECT count(*) FROM public.user_follows
      WHERE follower_id = p_user_id
    );
$function$;

CREATE OR REPLACE FUNCTION public.get_public_followers(p_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  avatar_url text,
  followed_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    p.id,
    p.display_name,
    p.avatar_url,
    f.created_at
  FROM public.user_follows f
  JOIN public.profiles p ON p.id = f.follower_id
  WHERE f.followed_id = p_user_id
    AND (
      NOT EXISTS (
        SELECT 1 FROM public.admins a WHERE a.user_id = p_user_id
      )
      OR auth.uid() = p_user_id
    )
  ORDER BY f.created_at DESC;
$function$;
