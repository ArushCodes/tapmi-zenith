
WITH b AS (SELECT id FROM public.batches WHERE slug = 'tapmi-ipm-2026'),
v(uid, title, sd, ed, holiday) AS (VALUES
  ('acad:induction','Induction Day','2026-07-25','2026-07-25',false),
  ('acad:induction-activity','Induction Activity','2026-07-27','2026-07-28',false),
  ('acad:t1-start','Trimester I — Classes Commence','2026-07-29','2026-07-29',false),
  ('acad:h-independence','Holiday — Independence Day','2026-08-15','2026-08-15',true),
  ('acad:h-janmashtami','Holiday — Krishna Janmashtami','2026-09-05','2026-09-05',true),
  ('acad:h-chaturthi','Holiday — Vinayaka Chaturthi','2026-09-14','2026-09-14',true),
  ('acad:h-gandhi','Holiday — Gandhi Jayanthi','2026-10-02','2026-10-02',true),
  ('acad:t1-end-classes','Trimester I — End of Classes','2026-10-10','2026-10-10',false),
  ('acad:t1-study','Study Holidays','2026-10-11','2026-10-14',true),
  ('acad:t1-exams','Trimester I — End Sem Exams','2026-10-15','2026-10-23',false),
  ('acad:h-dashami','Holiday — Vijaya Dashami','2026-10-20','2026-10-20',true),
  ('acad:t1-sem-end','Trimester I — Semester End','2026-10-23','2026-10-23',false),
  ('acad:t2-start','Trimester II — Classes Commence','2026-10-26','2026-10-26',false),
  ('acad:h-deepavali','Holiday — Deepavali','2026-11-09','2026-11-09',true),
  ('acad:diwali-break','Diwali Break','2026-11-10','2026-11-16',true),
  ('acad:christmas-break','Christmas Break','2026-12-20','2027-01-03',true),
  ('acad:t2-end-classes','Trimester II — End of Classes','2027-01-23','2027-01-23',false),
  ('acad:t2-study','Study Holidays','2027-01-24','2027-01-25',true),
  ('acad:h-republic','Holiday — Republic Day','2027-01-26','2027-01-26',true),
  ('acad:t2-exams','Trimester II — End Sem Exams','2027-01-27','2027-02-02',false),
  ('acad:t2-sem-end','Trimester II — Semester End','2027-02-02','2027-02-02',false),
  ('acad:t3-start','Trimester III — Classes Commence','2027-02-03','2027-02-03',false),
  ('acad:h-holi','Holiday — Holi','2027-03-22','2027-03-22',true),
  ('acad:h-goodfriday','Holiday — Good Friday','2027-03-26','2027-03-26',true),
  ('acad:t3-end-classes','Trimester III — End of Classes','2027-04-14','2027-04-14',false),
  ('acad:t3-study','Study Holidays','2027-04-15','2027-04-18',true),
  ('acad:t3-exams','Trimester III — End Sem Exams','2027-04-19','2027-04-24',false),
  ('acad:t3-sem-end','Trimester III — Semester End','2027-04-30','2027-04-30',false)
)
INSERT INTO public.class_sessions
  (batch_id, source, external_uid, title, start_at, end_at, is_holiday, notes)
SELECT b.id, 'custom', v.uid, v.title,
       (v.sd || ' 00:00:00+05:30')::timestamptz,
       (v.ed || ' 23:59:00+05:30')::timestamptz,
       v.holiday, 'academic-calendar'
FROM b, v
ON CONFLICT (batch_id, external_uid) DO UPDATE
  SET title = EXCLUDED.title,
      start_at = EXCLUDED.start_at,
      end_at = EXCLUDED.end_at,
      is_holiday = EXCLUDED.is_holiday,
      notes = EXCLUDED.notes;
