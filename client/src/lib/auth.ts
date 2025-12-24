import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabase: SupabaseClient | null = null;
let supabaseInitialized = false;
let configPromise: Promise<{ supabaseUrl: string; supabaseAnonKey: string }> | null = null;

async function fetchConfig(): Promise<{ supabaseUrl: string; supabaseAnonKey: string }> {
  if (!configPromise) {
    configPromise = fetch("/api/config")
      .then((res) => res.json())
      .catch(() => ({ supabaseUrl: "", supabaseAnonKey: "" }));
  }
  return configPromise;
}

async function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (!supabaseInitialized) {
    supabaseInitialized = true;
    const config = await fetchConfig();
    if (config.supabaseUrl && config.supabaseAnonKey) {
      supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
    } else {
      console.warn("Supabase not configured from server");
    }
  }
  return supabase;
}

export async function isSupabaseConfigured(): Promise<boolean> {
  const client = await getSupabaseClient();
  return client !== null;
}

export async function signIn(email: string, password: string) {
  const client = await getSupabaseClient();
  if (!client) {
    throw new Error("Authentication service not configured");
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
  const client = await getSupabaseClient();
  if (!client) {
    throw new Error("Authentication service not configured");
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
  const client = await getSupabaseClient();
  if (!client) {
    return;
  }
  
  const { error } = await client.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}

export async function getCurrentUser() {
  const client = await getSupabaseClient();
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
  const client = await getSupabaseClient();
  if (!client) {
    return null;
  }
  
  const { data, error } = await client.auth.getSession();
  if (error) {
    return null;
  }
  return data.session;
}

export async function resetPassword(email: string) {
  const client = await getSupabaseClient();
  if (!client) {
    throw new Error("Authentication service not configured");
  }
  
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function updatePassword(newPassword: string) {
  const client = await getSupabaseClient();
  if (!client) {
    throw new Error("Authentication service not configured");
  }
  
  const { error } = await client.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw new Error(error.message);
  }
}
