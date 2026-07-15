-- schema.sql
-- Database Schema for Student-Admin Portal with Row Level Security (RLS)

-- Create a custom type for roles
CREATE TYPE user_role AS ENUM ('student', 'admin');

----------------------------------------------------
-- 1. PROFILES TABLE
----------------------------------------------------
-- Stores user profile data linked to Supabase Auth users
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role user_role DEFAULT 'student'::user_role NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by authenticated users" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id);

----------------------------------------------------
-- 2. ASSIGNMENTS TABLE
----------------------------------------------------
-- Stores assignments created by admins
CREATE TABLE public.assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  points INTEGER DEFAULT 100 NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Enable Row Level Security
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- Assignments Policies
CREATE POLICY "Assignments are viewable by all authenticated users" 
ON public.assignments 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Only admins can insert assignments" 
ON public.assignments 
FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'::user_role
  )
);

CREATE POLICY "Only admins can update assignments" 
ON public.assignments 
FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'::user_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'::user_role
  )
);

CREATE POLICY "Only admins can delete assignments" 
ON public.assignments 
FOR DELETE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'::user_role
  )
);

----------------------------------------------------
-- 3. SUBMISSIONS TABLE
----------------------------------------------------
-- Stores student submissions for assignments
CREATE TABLE public.submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  submission_text TEXT NOT NULL,
  attachment_url TEXT,
  grade INTEGER,
  feedback TEXT,
  graded_at TIMESTAMP WITH TIME ZONE,
  graded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT CHECK (status IN ('pending', 'graded')) DEFAULT 'pending' NOT NULL,
  CONSTRAINT unique_student_assignment UNIQUE (student_id, assignment_id)
);

-- Enable Row Level Security
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Submissions Policies
CREATE POLICY "Students can view their own submissions and admins can view all" 
ON public.submissions 
FOR SELECT 
TO authenticated 
USING (
  auth.uid() = student_id OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'::user_role
  )
);

CREATE POLICY "Students can create submissions" 
ON public.submissions 
FOR INSERT 
TO authenticated 
WITH CHECK (
  auth.uid() = student_id AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'student'::user_role
  )
);

CREATE POLICY "Students can update their own pending submissions" 
ON public.submissions 
FOR UPDATE 
TO authenticated 
USING (
  auth.uid() = student_id AND status = 'pending'
)
WITH CHECK (
  auth.uid() = student_id AND status = 'pending'
);

CREATE POLICY "Admins can update and grade submissions" 
ON public.submissions 
FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'::user_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'::user_role
  )
);

----------------------------------------------------
-- 4. AUTH TRIGGER FOR AUTOMATIC PROFILE CREATION
----------------------------------------------------
-- Automatically inserts a record into public.profiles when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Student'),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student'::user_role)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
