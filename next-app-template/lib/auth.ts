import { createClient } from './supabase/server';
import { Profile } from './types/database';

/**
 * Check if the current user has admin role
 * @returns Promise<boolean> - true if user is admin, false otherwise
 */
export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return false;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return profile?.role === 'admin';
}

/**
 * Get the current user's profile including role
 * @returns Promise<Profile | null>
 */
export async function getCurrentUserProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return profile;
}

/**
 * Require admin role or throw/redirect
 * Use this in server components or API routes
 * @throws Error if user is not admin
 */
export async function requireAdmin(): Promise<Profile> {
  const profile = await getCurrentUserProfile();
  
  if (!profile) {
    throw new Error('Unauthorized: No session found');
  }

  if (profile.role !== 'admin') {
    throw new Error('Forbidden: Admin access required');
  }

  return profile;
}
