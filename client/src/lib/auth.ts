import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazily initialized Supabase client
let supabase: SupabaseClient | null = null;
let supabaseInitialized = false;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseInitialized) {
    supabaseInitialized = true;
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
  }
  return supabase;
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseClient() !== null;
}

export async function signIn(email: string, password: string) {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase is not configured. Using local authentication only.");
  }
  
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    user: data.user,
    session: data.session,
  };
}

export async function signUp(email: string, password: string, displayName: string) {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase is not configured. Cannot create account.");
  }
  
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        displayName,
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    user: data.user,
    session: data.session,
  };
}

export async function signOut() {
  const client = getSupabaseClient();
  if (!client) {
    return;
  }
  
  const { error } = await client.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}

export async function getCurrentUser() {
  const client = getSupabaseClient();
  if (!client) {
    return null;
  }
  
  const { data, error } = await client.auth.getUser();
  if (error) {
    return null;
  }
  return data.user;
}

export async function getCurrentSession() {
  const client = getSupabaseClient();
  if (!client) {
    return null;
  }
  
  const { data, error } = await client.auth.getSession();
  if (error) {
    return null;
  }
  return data.session;
}
