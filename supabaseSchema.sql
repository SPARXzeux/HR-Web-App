-- Execute this in your Supabase SQL Editor to establish the key-value sync table:

CREATE TABLE IF NOT EXISTS delcargo_store (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Turn off Row Level Security (RLS) for the store table for easier local prototyping,
-- or add a simple policy permitting all authenticated/anon read/writes.
ALTER TABLE delcargo_store DISABLE ROW LEVEL SECURITY;
