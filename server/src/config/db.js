import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables FIRST
dotenv.config();

// Validate environment variables
if (!process.env.SUPABASE_URL) {
  throw new Error("SUPABASE_URL environment variable is not set");
}
if (!process.env.SUPABASE_ANON_KEY) {
  throw new Error("SUPABASE_ANON_KEY environment variable is not set");
}

console.log("🔧 Initializing Supabase client...");

// Create Supabase client singleton
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Create a new instance for per-request auth state
export function createSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
}