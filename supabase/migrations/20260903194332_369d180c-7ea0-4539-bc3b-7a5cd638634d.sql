DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_type') THEN
    CREATE TYPE public.leave_type AS ENUM ('personal','institutional');
  END IF;
END $$;

ALTER TABLE public.attendance_marks
  ADD COLUMN IF NOT EXISTS leave_type public.leave_type NOT NULL DEFAULT 'personal';