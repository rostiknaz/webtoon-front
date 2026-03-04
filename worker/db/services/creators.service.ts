/**
 * Creator Service
 *
 * Database operations for creator registration and profiles.
 * Follows the standalone function pattern (db as first param).
 */

import { eq, inArray, sql } from 'drizzle-orm';
import { users } from '../../../db/schema';
import type { DB } from '../index';

// ==================== Interfaces ====================

export interface CreatorProfile {
  id: string;
  email: string;
  name: string | null;
  displayName: string | null;
  bio: string | null;
  image: string | null;
  role: string;
  isFoundingCreator: boolean;
  payoutMethod: string | null;
  payoutEmail: string | null;
  createdAt: number; // Unix timestamp
}

export interface RegisterCreatorData {
  displayName: string;
  bio?: string;
  payoutMethod: string;
  payoutEmail: string;
}

// ==================== Query Functions ====================

/**
 * Get creator profile by user ID
 * Returns null if user is not a creator
 */
export async function getCreatorProfile(db: DB, userId: string): Promise<CreatorProfile | null> {
  const result = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      displayName: users.displayName,
      bio: users.bio,
      image: users.image,
      role: users.role,
      isFoundingCreator: users.isFoundingCreator,
      payoutMethod: users.payoutMethod,
      payoutEmail: users.payoutEmail,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!result[0] || result[0].role === 'consumer') return null;

  return {
    ...result[0],
    createdAt: Math.floor(result[0].createdAt.getTime() / 1000),
  };
}

/**
 * Count users with creator role (for founding creator threshold)
 */
export async function getCreatorCount(db: DB): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(inArray(users.role, ['creator', 'admin']));
  return Number(result[0]?.count ?? 0);
}

/**
 * Register a consumer as a creator
 *
 * Atomically:
 * 1. Counts existing creators to determine founding status
 * 2. Updates user role to 'creator' with all creator fields
 *
 * Race condition safe: D1 single-writer serializes writes
 */
export async function registerAsCreator(
  db: DB,
  userId: string,
  data: RegisterCreatorData
): Promise<{ isFoundingCreator: boolean }> {
  const creatorCount = await getCreatorCount(db);
  const isFounding = creatorCount < 100;
  const now = new Date();

  await db
    .update(users)
    .set({
      role: 'creator',
      displayName: data.displayName,
      bio: data.bio || null,
      payoutMethod: data.payoutMethod,
      payoutEmail: data.payoutEmail,
      isFoundingCreator: isFounding,
      tosAcceptedAt: now,
      updatedAt: now,
    })
    .where(eq(users.id, userId));

  return { isFoundingCreator: isFounding };
}

/**
 * Get public creator profile (excludes sensitive fields)
 */
export async function getPublicCreatorProfile(
  db: DB,
  creatorId: string
): Promise<Pick<CreatorProfile, 'id' | 'displayName' | 'bio' | 'image' | 'isFoundingCreator'> | null> {
  const result = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      bio: users.bio,
      image: users.image,
      role: users.role,
      isFoundingCreator: users.isFoundingCreator,
    })
    .from(users)
    .where(eq(users.id, creatorId))
    .limit(1);

  if (!result[0] || result[0].role === 'consumer') return null;

  return {
    id: result[0].id,
    displayName: result[0].displayName,
    bio: result[0].bio,
    image: result[0].image,
    isFoundingCreator: result[0].isFoundingCreator,
  };
}
