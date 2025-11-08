/*
          # Initial Schema Setup
          This script sets up the initial database schema for the chat application. It includes tables for user profiles and messages, security policies (RLS), and a trigger to automatically create user profiles upon sign-up.

          ## Query Description: This operation is structural and foundational for the application. It creates new tables and enables Row Level Security to ensure users can only access their own data. There is no risk to existing data as it only creates new structures.
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Low"
          - Requires-Backup: false
          - Reversible: true
          
          ## Structure Details:
          - Tables Created: `profiles`, `messages`
          - Triggers Created: `on_auth_user_created` on `auth.users`
          - Functions Created: `public.handle_new_user()`
          
          ## Security Implications:
          - RLS Status: Enabled on `profiles` and `messages`.
          - Policy Changes: Yes, new policies are created to restrict data access.
          - Auth Requirements: Policies are based on `auth.uid()`.
          
          ## Performance Impact:
          - Indexes: Primary key indexes are automatically created. Foreign key indexes are added for `sender_id` and `receiver_id` on the `messages` table.
          - Triggers: A trigger is added to `auth.users`, which runs once per user creation.
          - Estimated Impact: Minimal performance impact, standard for a new application setup.
          */

-- 1. PROFILES TABLE
-- Stores public user data.
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT
  USING ( true );

CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT
  WITH CHECK ( auth.uid() = id );

CREATE POLICY "Users can update their own profile."
  ON public.profiles FOR UPDATE
  USING ( auth.uid() = id );

-- 2. MESSAGES TABLE
-- Stores chat messages.
CREATE TABLE public.messages (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Add indexes for faster lookups on conversations
CREATE INDEX messages_sender_id_idx ON public.messages(sender_id);
CREATE INDEX messages_receiver_id_idx ON public.messages(receiver_id);


CREATE POLICY "Users can view messages they sent or received."
  ON public.messages FOR SELECT
  USING ( auth.uid() = sender_id OR auth.uid() = receiver_id );

CREATE POLICY "Users can insert their own messages."
  ON public.messages FOR INSERT
  WITH CHECK ( auth.uid() = sender_id );


-- 3. NEW USER TRIGGER
-- This trigger automatically creates a profile entry when a new user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
