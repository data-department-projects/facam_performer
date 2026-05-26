
-- Create a public view for department_objectives that hides bonus for non-admins
CREATE OR REPLACE VIEW public.department_objectives_public
WITH (security_invoker = on)
AS
SELECT 
  id, department_id, title, description, category, status,
  achievement_pct, kpi_unit, deadline, year,
  s1_achievement_pct, s1_comment, s1_reviewed_at,
  final_achievement_pct, final_comment, final_reviewed_at,
  validated_at, validated_by, created_by, created_at, updated_at,
  CASE 
    WHEN public.has_role(auth.uid(), 'admin') THEN bonus
    ELSE NULL
  END AS bonus
FROM public.department_objectives;

-- Grant access
GRANT SELECT ON public.department_objectives_public TO authenticated;
