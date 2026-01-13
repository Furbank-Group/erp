import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import type { UserWithRole, UserRole } from '@/lib/supabase/types';
import { getPermissions, type Permissions } from '@/lib/rbac/permissions';

interface AuthContextType {
  user: User | null;
  appUser: UserWithRole | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  permissions: Permissions;
  role: UserRole | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<UserWithRole | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch app user data (with role) from our users table
  const fetchAppUser = async (userId: string) => {
    try {
      // First get the user
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      // If user doesn't exist in public.users, try to create it
      if (userError && (userError as any).code === 'PGRST116') {
        // User record doesn't exist - try to sync it
        console.warn('User record not found in public.users, attempting to sync...');
        
        // Try to call the self-registration function first (simpler, user-specific)
        const { error: createError } = await supabase.rpc('create_my_user_record');
        
        if (!createError) {
          // Successfully created, retry fetching
          const { data: retryUserData, error: retryError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

          if (!retryError && retryUserData) {
            // Fetch role
            let roleData = null;
            if ((retryUserData as any).role_id) {
              const { data: role } = await supabase
                .from('roles')
                .select('*')
                .eq('id', (retryUserData as any).role_id)
                .single();
              roleData = role;
            }

            const userWithRole = {
              ...(retryUserData as any),
              roles: roleData ?? undefined,
            } as UserWithRole;
            
            setAppUser(userWithRole);
            return;
          }
        }

        // If self-registration failed, try the sync function
        const { error: syncError } = await supabase.rpc('sync_missing_user_records');
        
        if (syncError) {
          // If both functions fail, log but don't crash
          console.error('Failed to create/sync user record:', syncError);
          return;
        }

        // If sync succeeded, retry fetching
        const { data: retryUserData, error: retryError } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (retryError || !retryUserData) {
          console.error('Failed to fetch user after sync:', retryError);
          return;
        }

        // Use the synced user data
        const userWithRole = {
          ...(retryUserData as any),
          roles: null, // Will be fetched below
        } as UserWithRole;
        
        // Fetch role separately
        if ((retryUserData as any).role_id) {
          const { data: role } = await supabase
            .from('roles')
            .select('*')
            .eq('id', (retryUserData as any).role_id)
            .single();
          userWithRole.roles = role ?? undefined;
        }
        
        setAppUser(userWithRole);
        return;
      }

      if (userError) throw userError;
      if (!userData) return;

      // Then get the role separately to avoid relationship ambiguity
      let roleData = null;
      if ((userData as any).role_id) {
        const { data: role } = await supabase
          .from('roles')
          .select('*')
          .eq('id', (userData as any).role_id)
          .single();
        roleData = role;
      }

      const userWithRole = {
        ...(userData as any),
        roles: roleData,
      } as UserWithRole;
      
      setAppUser(userWithRole);
    } catch (error) {
      console.error('Error fetching app user:', error);
      // Don't completely fail - user might still be authenticated in Supabase Auth
      // Just set appUser to null so the app can continue (though with limited functionality)
      setAppUser(null);
      
      // In development, log more details
      if (import.meta.env.MODE === 'development') {
        const err = error as any;
        if (err?.code === 'PGRST116' || err?.message?.includes('No rows')) {
          console.warn('User record not found in users table. User may need to be created by an admin.');
        } else if (err?.status === 403 || err?.code === '42501') {
          console.warn('RLS policy blocking user access. Check RLS policies on users table.');
        }
      }
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchAppUser(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchAppUser(session.user.id);
      } else {
        setAppUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  // Deprecated: Public signup is disabled. User creation is now done via admin UI.
  // This function is kept for internal use only (e.g., userService.createUser)
  // @deprecated Use userService.createUser instead for admin user creation
  // Removed unused function to fix build errors

  const signOut = async () => {
    await supabase.auth.signOut();
    setAppUser(null);
  };

  // Get role name from appUser
  const roleName = appUser?.roles?.name ?? null;
  const role = roleName as UserRole | null;
  const permissions = getPermissions(roleName);
  
  // Debug logging - only log when appUser changes
  useEffect(() => {
    if (import.meta.env.MODE === 'development' && appUser) {
      console.log('AuthContext - Role calculation:', {
        roleName,
        role,
        permissions,
        appUserRoleId: appUser.role_id,
        appUserRoles: appUser.roles,
      });
    }
  }, [appUser, roleName, role]);

  const value: AuthContextType = useMemo(() => ({
    user,
    appUser,
    session,
    loading,
    signIn,
    signOut,
    permissions,
    role,
  }), [user, appUser, session, loading, permissions, role]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
