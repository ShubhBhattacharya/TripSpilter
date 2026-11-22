/**
 * TripSplit Security & Authorization Guards
 * Enforces server-side authentication, trip membership, and role validation.
 * Prevents IDOR and privilege escalation.
 */

import { SupabaseClient, User } from '@supabase/supabase-js';

export interface AuthContext {
  user: User;
}

export interface TripAuthContext extends AuthContext {
  tripId: string;
  role: 'admin' | 'member';
  isAdmin: boolean;
}

export class UnauthorizedError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Access denied: Insufficient permissions') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Ensures user is authenticated via Supabase server-side session.
 */
export async function requireAuthenticatedUser(supabase: SupabaseClient): Promise<User> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new UnauthorizedError('Unauthorized: A valid session is required.');
  }

  return user;
}

/**
 * Validates that the user is an active member of the specified trip.
 * Returns the member's role and trip metadata.
 */
export async function requireTripMembership(
  supabase: SupabaseClient,
  tripId: string,
  userId: string
): Promise<TripAuthContext> {
  if (!tripId || !userId) {
    throw new ForbiddenError('Missing trip or user identifier.');
  }

  // 1. Check trip_members table
  const { data: member } = await supabase
    .from('trip_members')
    .select('role')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .maybeSingle();

  if (member) {
    const role = (member.role as 'admin' | 'member') || 'member';
    return {
      user: { id: userId } as User,
      tripId,
      role,
      isAdmin: role === 'admin',
    };
  }

  // 2. Fallback check: Is user the original trip creator?
  const { data: trip } = await supabase
    .from('trips')
    .select('created_by')
    .eq('id', tripId)
    .maybeSingle();

  if (trip && trip.created_by === userId) {
    return {
      user: { id: userId } as User,
      tripId,
      role: 'admin',
      isAdmin: true,
    };
  }

  throw new ForbiddenError('Access denied: You are not a registered member of this trip outing.');
}

/**
 * Validates that the user is an admin of the specified trip.
 */
export async function requireTripAdmin(
  supabase: SupabaseClient,
  tripId: string,
  userId: string
): Promise<TripAuthContext> {
  const context = await requireTripMembership(supabase, tripId, userId);
  if (!context.isAdmin) {
    throw new ForbiddenError('Access denied: Admin privileges required for this action.');
  }
  return context;
}

/**
 * Sanitizes redirect URLs to protect against Open Redirect vulnerabilities (CWE-601).
 * Allows only relative paths starting with a single '/' and rejects protocol-relative ('//')
 * or path traversal ('/\') constructs.
 */
export function sanitizeRedirectUrl(nextUrl: string | null | undefined, defaultPath = '/'): string {
  if (!nextUrl || typeof nextUrl !== 'string') {
    return defaultPath;
  }

  const trimmed = nextUrl.trim();

  // Must begin with a single slash and not followed by another slash or backslash
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return defaultPath;
  }

  // Reject URLs containing protocol prefixes or colon before the first slash
  if (/^[a-zA-Z0-9+.-]+:/.test(trimmed)) {
    return defaultPath;
  }

  // Reject control characters
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return defaultPath;
  }

  return trimmed;
}