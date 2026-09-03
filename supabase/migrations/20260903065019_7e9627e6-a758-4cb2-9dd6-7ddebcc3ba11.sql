ALTER TABLE public.deadlines ADD COLUMN IF NOT EXISTS working_group text;

DELETE FROM public.attendance_marks WHERE batch_id = '26bc89c5-2c94-4c24-beef-ec0a047cfd43';

WITH targets(short_name, misses) AS (
  VALUES ('Marketing', 0), ('Accounting', 1), ('Ops Research', 2),
         ('Communication', 3), ('Data Viz', 4), ('Behavioural Econ', 5)
),
ranked AS (
  SELECT cs.id, cs.batch_id, cs.short_name,
         row_number() OVER (PARTITION BY cs.short_name ORDER BY cs.start_at) AS rn
  FROM public.class_sessions cs
  WHERE cs.batch_id = '26bc89c5-2c94-4c24-beef-ec0a047cfd43'
    AND cs.is_holiday = false
    AND cs.end_at < now()
),
people AS (
  SELECT user_id FROM public.batch_memberships
  WHERE batch_id = '26bc89c5-2c94-4c24-beef-ec0a047cfd43'
)
INSERT INTO public.attendance_marks (session_id, batch_id, user_id, status, mark_source, marked_by)
SELECT r.id, r.batch_id, p.user_id, 'absent'::attendance_status, 'self'::mark_source, p.user_id
FROM ranked r
JOIN targets t ON t.short_name = r.short_name
CROSS JOIN people p
WHERE r.rn <= t.misses
ON CONFLICT (session_id, user_id, mark_source) DO NOTHING;