/**
 * Moderation Service
 *
 * NSFW detection via Workers AI, confidence-based routing,
 * moderation log auditing, and admin queue management.
 */

import { eq, desc } from 'drizzle-orm';
import { clips, moderationLogs, users } from '../../../db/schema';
import type { DB } from '../index';
import { updateClipStatus, getClipById } from './clips.service';

// Confidence thresholds (Decision 9)
const SAFE_THRESHOLD = 0.85;
const REJECT_THRESHOLD = 0.5;

// NSFW-indicative labels from ResNet-50 classification
const NSFW_LABELS = new Set([
  'bikini', 'brassiere', 'miniskirt', 'swimming_trunks',
  'maillot', 'lingerie',
]);

export interface ModerationLogInput {
  clipId: string;
  moderatorId: string | null; // null = AI
  action: string; // approve, reject, flag
  reason: string;
  confidence: number | null;
  aiModel: string | null;
}

/**
 * Insert a moderation log entry
 */
export async function createModerationLog(db: DB, input: ModerationLogInput) {
  const id = crypto.randomUUID();
  await db.insert(moderationLogs).values({
    id,
    clipId: input.clipId,
    moderatorId: input.moderatorId,
    action: input.action,
    reason: input.reason,
    confidence: input.confidence,
    aiModel: input.aiModel,
    createdAt: new Date(),
  });
  return id;
}

/**
 * Run Workers AI NSFW classification on an image URL.
 * Returns confidence scores or null if AI is unavailable.
 */
export async function scanWithAI(
  ai: Ai,
  imageUrl: string,
): Promise<{ safe: number; nsfw: number } | null> {
  try {
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) return null;

    const imageBuffer = await imageResponse.arrayBuffer();
    const results = await ai.run('@cf/microsoft/resnet-50', {
      image: [...new Uint8Array(imageBuffer)],
    });

    // Map ResNet-50 general labels to safe/nsfw confidence
    let nsfwScore = 0;
    if (Array.isArray(results)) {
      for (const item of results as Array<{ label: string; score: number }>) {
        if (NSFW_LABELS.has(item.label)) {
          nsfwScore = Math.max(nsfwScore, item.score);
        }
      }
    }

    return { safe: 1 - nsfwScore, nsfw: nsfwScore };
  } catch {
    // AI unavailable — return null to trigger manual review (AC 4)
    return null;
  }
}

/**
 * Determine clip status based on AI confidence scores and creator's content rating.
 */
function determineClipStatus(
  scores: { safe: number; nsfw: number } | null,
  creatorNsfwRating: string,
): { status: 'published' | 'rejected' | 'review'; action: string; reason: string } {
  // AI unavailable → manual review (AC 4)
  if (!scores) {
    return {
      status: 'review',
      action: 'flag',
      reason: 'AI scan unavailable — queued for manual review',
    };
  }

  // Content rating mismatch (AC 5): creator said safe but AI detects NSFW
  if (creatorNsfwRating === 'safe' && scores.nsfw > REJECT_THRESHOLD) {
    return {
      status: 'review',
      action: 'flag',
      reason: `Content rating mismatch: creator marked safe but NSFW confidence ${(scores.nsfw * 100).toFixed(0)}%`,
    };
  }

  // Apply confidence thresholds
  if (scores.safe > SAFE_THRESHOLD) {
    return {
      status: 'published',
      action: 'approve',
      reason: `Auto-approved: safe confidence ${(scores.safe * 100).toFixed(0)}%`,
    };
  }

  if (scores.safe < REJECT_THRESHOLD) {
    return {
      status: 'rejected',
      action: 'reject',
      reason: `Auto-rejected: safe confidence ${(scores.safe * 100).toFixed(0)}% below threshold`,
    };
  }

  return {
    status: 'review',
    action: 'flag',
    reason: `Queued for review: safe confidence ${(scores.safe * 100).toFixed(0)}% in uncertain range`,
  };
}

interface ModeratableClip {
  id: string;
  status: string;
  videoUrl: string | null;
  nsfwRating: string;
}

/**
 * Orchestrate full moderation for a clip:
 * 1. Run NSFW scan (if thumbnail available)
 * 2. Apply confidence thresholds
 * 3. Update clip status + create moderation log
 *
 * Accepts a pre-fetched clip to avoid redundant DB lookups.
 */
export async function processClipModeration(
  db: DB,
  ai: Ai | null,
  clip: ModeratableClip,
): Promise<{ status: string; reason: string }> {
  if (clip.status !== 'processing') throw new Error(`Clip is not in processing state: ${clip.status}`);

  let scores: { safe: number; nsfw: number } | null = null;
  if (ai && clip.videoUrl) {
    scores = await scanWithAI(ai, clip.videoUrl);
  }

  const result = determineClipStatus(scores, clip.nsfwRating);

  await updateClipStatus(
    db,
    clip.id,
    result.status,
    result.status === 'published' ? new Date() : undefined,
  );

  await createModerationLog(db, {
    clipId: clip.id,
    moderatorId: null,
    action: result.action,
    reason: result.reason,
    confidence: scores?.safe ?? null,
    aiModel: scores ? '@cf/microsoft/resnet-50' : null,
  });

  return { status: result.status, reason: result.reason };
}

/**
 * Get clips in review queue for admin moderation
 */
export async function getModerationQueue(db: DB) {
  const results = await db
    .select({
      clipId: clips.id,
      title: clips.title,
      creatorId: clips.creatorId,
      creatorName: users.displayName,
      nsfwRating: clips.nsfwRating,
      thumbnailUrl: clips.thumbnailUrl,
      createdAt: clips.createdAt,
      logReason: moderationLogs.reason,
      logConfidence: moderationLogs.confidence,
    })
    .from(clips)
    .leftJoin(users, eq(clips.creatorId, users.id))
    .leftJoin(moderationLogs, eq(clips.id, moderationLogs.clipId))
    .where(eq(clips.status, 'review'))
    .orderBy(desc(clips.createdAt))
    .limit(50);

  return results.map((row) => ({
    _id: row.clipId,
    title: row.title,
    creatorId: row.creatorId,
    creatorName: row.creatorName || 'Unknown',
    nsfwRating: row.nsfwRating,
    thumbnailUrl: row.thumbnailUrl,
    createdAt: row.createdAt?.toISOString() ?? null,
    moderationReason: row.logReason,
    moderationConfidence: row.logConfidence,
  }));
}

/**
 * Admin action: approve or reject a clip in review
 */
export async function adminModerateClip(
  db: DB,
  clipId: string,
  adminId: string,
  action: 'approve' | 'reject',
  reason?: string,
): Promise<void> {
  const clip = await getClipById(db, clipId);
  if (!clip) throw new Error(`Clip not found: ${clipId}`);
  if (clip.status !== 'review') throw new Error(`Clip is not in review state: ${clip.status}`);

  const newStatus = action === 'approve' ? 'published' : 'rejected';
  const logReason = reason || (action === 'approve' ? 'Admin approved' : 'Admin rejected');

  await updateClipStatus(
    db,
    clipId,
    newStatus,
    newStatus === 'published' ? new Date() : undefined,
  );

  await createModerationLog(db, {
    clipId,
    moderatorId: adminId,
    action,
    reason: logReason,
    confidence: null,
    aiModel: null,
  });
}
