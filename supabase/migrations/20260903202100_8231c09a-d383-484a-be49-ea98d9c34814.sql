CREATE OR REPLACE FUNCTION public.protect_profile_immutable_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'private'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT private.has_role(auth.uid(), 'admin') THEN
    NEW.id := OLD.id;
    NEW.email := OLD.email;
    NEW.created_at := OLD.created_at;
    NEW.registration_no := OLD.registration_no;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TYPE public.component_kind AS ENUM ('endterm','midterm','quiz','project','presentation','assignment','participation','exam','other');

CREATE TABLE public.course_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  course_code text NOT NULL,
  course_name text NOT NULL,
  credits numeric NOT NULL DEFAULT 3,
  is_mlc boolean NOT NULL DEFAULT false,
  is_provisional boolean NOT NULL DEFAULT false,
  name text NOT NULL,
  weightage numeric NOT NULL DEFAULT 0,
  kind public.component_kind NOT NULL DEFAULT 'other',
  sequence integer NOT NULL DEFAULT 0,
  timing_note text,
  work_mode public.work_mode NOT NULL DEFAULT 'individual',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX course_components_batch_idx ON public.course_components (batch_id, course_code, sequence);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_components TO authenticated;
GRANT ALL ON public.course_components TO service_role;
ALTER TABLE public.course_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read course components" ON public.course_components
  FOR SELECT TO authenticated USING (private.is_batch_member(auth.uid(), batch_id));
CREATE POLICY "Mods manage course components" ON public.course_components
  FOR ALL TO authenticated USING (private.is_batch_mod(auth.uid(), batch_id))
  WITH CHECK (private.is_batch_mod(auth.uid(), batch_id));
CREATE TRIGGER course_components_set_updated_at BEFORE UPDATE ON public.course_components
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.component_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id uuid NOT NULL REFERENCES public.course_components(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (component_id, user_id)
);
CREATE INDEX component_marks_user_batch_idx ON public.component_marks (user_id, batch_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.component_marks TO authenticated;
GRANT ALL ON public.component_marks TO service_role;
ALTER TABLE public.component_marks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own component marks" ON public.component_marks
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND private.is_batch_member(auth.uid(), batch_id))
  WITH CHECK (user_id = auth.uid() AND private.is_batch_member(auth.uid(), batch_id));
CREATE TRIGGER component_marks_set_updated_at BEFORE UPDATE ON public.component_marks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.course_components (batch_id, course_code, course_name, credits, is_mlc, is_provisional, name, weightage, kind, sequence, timing_note, work_mode) VALUES
('ee4a435d-4003-4a22-940b-0ee0e676b6f5','OPS 1102','Basics of Statistics',3,false,false,'End-Term Examination',30,'endterm',5,'90 minutes, closed book','individual'),
('ee4a435d-4003-4a22-940b-0ee0e676b6f5','OPS 1102','Basics of Statistics',3,false,false,'Mid-Term Examination',20,'midterm',2,'60 minutes, closed book','individual'),
('ee4a435d-4003-4a22-940b-0ee0e676b6f5','OPS 1102','Basics of Statistics',3,false,false,'Class Participation',20,'participation',4,'Across all sessions','individual'),
('ee4a435d-4003-4a22-940b-0ee0e676b6f5','OPS 1102','Basics of Statistics',3,false,false,'Group Project',20,'project',3,'Presentations in sessions 23-24','group'),
('ee4a435d-4003-4a22-940b-0ee0e676b6f5','OPS 1102','Basics of Statistics',3,false,false,'Quiz',10,'quiz',1,'After session 10','individual'),

('ee4a435d-4003-4a22-940b-0ee0e676b6f5','MGT 1101','Introduction to Sociology',3,false,false,'End-Term Examination',40,'endterm',4,'120 minutes, closed book','individual'),
('ee4a435d-4003-4a22-940b-0ee0e676b6f5','MGT 1101','Introduction to Sociology',3,false,false,'Mid-Term Examination',20,'midterm',2,'60 minutes, closed book','individual'),
('ee4a435d-4003-4a22-940b-0ee0e676b6f5','MGT 1101','Introduction to Sociology',3,false,false,'Quiz',20,'quiz',1,'After session 10','individual'),
('ee4a435d-4003-4a22-940b-0ee0e676b6f5','MGT 1101','Introduction to Sociology',3,false,false,'Group Project',20,'project',3,'Report and presentation after session 17','group'),

('ee4a435d-4003-4a22-940b-0ee0e676b6f5','HRM 1101','Foundations of Psychology',3,false,false,'End-Term Examination',40,'endterm',6,'120 minutes, closed book','individual'),
('ee4a435d-4003-4a22-940b-0ee0e676b6f5','HRM 1101','Foundations of Psychology',3,false,false,'Mid-Term Examination',20,'midterm',3,'60 minutes, closed book','individual'),
('ee4a435d-4003-4a22-940b-0ee0e676b6f5','HRM 1101','Foundations of Psychology',3,false,false,'Group Project - Written Report',15,'project',4,'Sessions 22-23','group'),
('ee4a435d-4003-4a22-940b-0ee0e676b6f5','HRM 1101','Foundations of Psychology',3,false,false,'Group Project - Presentation',5,'presentation',5,'Sessions 22-23','group'),
('ee4a435d-4003-4a22-940b-0ee0e676b6f5','HRM 1101','Foundations of Psychology',3,false,false,'Quizzes (3)',10,'quiz',1,'After sessions 6, 12 and 18','individual'),
('ee4a435d-4003-4a22-940b-0ee0e676b6f5','HRM 1101','Foundations of Psychology',3,false,false,'Class Participation',10,'participation',2,'Sessions 2 to 21','individual'),

('ee4a435d-4003-4a22-940b-0ee0e676b6f5','HRM 1102','English Language and Literature - I',3,false,false,'End-Term Examination',40,'endterm',5,'120 minutes, closed book','individual'),
('ee4a435d-4003-4a22-940b-0ee0e676b6f5','HRM 1102','English Language and Literature - I',3,false,false,'Mid-Term Test',20,'midterm',3,'60 minutes, closed book','individual'),
('ee4a435d-4003-4a22-940b-0ee0e676b6f5','HRM 1102','English Language and Literature - I',3,false,false,'Presentation',20,'presentation',4,'Character or theme interpretation','individual'),
('ee4a435d-4003-4a22-940b-0ee0e676b6f5','HRM 1102','English Language and Literature - I',3,false,false,'Written Assignment',10,'assignment',2,'Class review in session 14','individual'),
('ee4a435d-4003-4a22-940b-0ee0e676b6f5','HRM 1102','English Language and Literature - I',3,false,false,'Quiz 1',5,'quiz',1,'After session 7','individual'),
('ee4a435d-4003-4a22-940b-0ee0e676b6f5','HRM 1102','English Language and Literature - I',3,false,false,'Quiz 2',5,'quiz',6,'After session 19','individual'),

('ee4a435d-4003-4a22-940b-0ee0e676b6f5','ITS 1101','Introduction to AI',2,false,false,'Individual Project',50,'project',4,'Presentations in sessions 14, 15 and 16','individual'),
('ee4a435d-4003-4a22-940b-0ee0e676b6f5','ITS 1101','Introduction to AI',2,false,false,'Mid-Term Examination',30,'midterm',3,'75 minutes, closed book','individual'),
('ee4a435d-4003-4a22-940b-0ee0e676b6f5','ITS 1101','Introduction to AI',2,false,false,'Quiz 1',10,'quiz',1,'After session 6','individual'),
('ee4a435d-4003-4a22-940b-0ee0e676b6f5','ITS 1101','Introduction to AI',2,false,false,'Quiz 2',10,'quiz',2,'After session 12','individual'),

('ee4a435d-4003-4a22-940b-0ee0e676b6f5','ANT 4003','Working with Spreadsheets / Excel Basics',2,false,false,'Online Exam',100,'exam',1,'Single comprehensive exam after session 8','individual'),

('ee4a435d-4003-4a22-940b-0ee0e676b6f5','HRM 1103','Working in Groups and Team Building',1,true,false,'Interactive Quiz',100,'quiz',1,'30 minutes, closed book. Satisfactory / Not Satisfactory only','individual'),

('ee4a435d-4003-4a22-940b-0ee0e676b6f5','OPS 1101','Basic Mathematics - I',3,false,true,'End-Term Examination',40,'endterm',4,'Provisional - awaiting official outline','individual'),
('ee4a435d-4003-4a22-940b-0ee0e676b6f5','OPS 1101','Basic Mathematics - I',3,false,true,'Mid-Term Examination',20,'midterm',2,'Provisional - awaiting official outline','individual'),
('ee4a435d-4003-4a22-940b-0ee0e676b6f5','OPS 1101','Basic Mathematics - I',3,false,true,'Quizzes',20,'quiz',1,'Provisional - awaiting official outline','individual'),
('ee4a435d-4003-4a22-940b-0ee0e676b6f5','OPS 1101','Basic Mathematics - I',3,false,true,'Class Participation',20,'participation',3,'Provisional - awaiting official outline','individual');