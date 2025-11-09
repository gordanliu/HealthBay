-- Minimal users table for HealthBay
-- No authentication, just a simple user table for chat history

CREATE TABLE IF NOT EXISTS public.users (
  id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
  created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT NOW(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- Create index for users
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users USING btree (created_at) TABLESPACE pg_default;

-- Insert a single default user (hardcoded UUID for consistency)
-- This UUID should match the DEFAULT_USER_ID in the backend
INSERT INTO public.users (id) 
VALUES ('00000000-0000-0000-0000-000000000000')
ON CONFLICT (id) DO NOTHING;

-- Update chats table to reference public.users instead of auth.users
-- First, drop the old foreign key constraint if it exists
ALTER TABLE public.chats 
DROP CONSTRAINT IF EXISTS chats_user_id_fkey1;

-- Add new foreign key constraint to public.users
ALTER TABLE public.chats 
ADD CONSTRAINT chats_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

