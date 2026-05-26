CREATE OR REPLACE FUNCTION public.log_security_violation(_violation_type text, _target_table text DEFAULT NULL::text, _target_action text DEFAULT NULL::text, _details jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _user_email text;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN RETURN; END IF;

  SELECT email INTO _user_email FROM profiles WHERE user_id = _user_id LIMIT 1;

  INSERT INTO security_violations (user_id, user_email, violation_type, target_table, target_action, details)
  VALUES (_user_id, _user_email, _violation_type, _target_table, _target_action, _details);
END;
$function$;