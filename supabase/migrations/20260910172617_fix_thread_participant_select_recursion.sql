-- Fix recursive thread membership checks that break Storage signed URLs.
-- The private helper reads membership as the table owner to avoid re-entering
-- the same SELECT policy. It accepts no caller-supplied user identity, returns
-- only a boolean, and checks the current authenticated user and exact thread.
CREATE OR REPLACE FUNCTION private.is_current_user_active_thread_participant(p_thread_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.thread_participants AS membership
    WHERE membership.thread_id = p_thread_id
      AND membership.profile_id = auth.uid()
      AND membership.is_active = true
  );
$function$;

ALTER FUNCTION private.is_current_user_active_thread_participant(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.is_current_user_active_thread_participant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_current_user_active_thread_participant(uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can view participants of their threads" ON public.thread_participants;
CREATE POLICY "Users can view participants of their threads"
ON public.thread_participants
FOR SELECT TO authenticated
USING (private.is_current_user_active_thread_participant(thread_id));
