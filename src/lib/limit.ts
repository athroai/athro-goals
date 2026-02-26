import type { User } from "@prisma/client";

const TIER_LIMITS: Record<string, number> = {
  FREE: 1,
  EXPLORER: 5,
  PRO: 25,
  ADVISER: 100,
};

export function getPathwayLimit(tier: string): number {
  return TIER_LIMITS[tier] ?? 1;
}

export function checkPathwayLimit(user: User): {
  limitReached: boolean;
  pathwaysUsed: number;
  pathwayLimit: number;
} {
  const limit = getPathwayLimit(user.subscriptionTier);
  const now = new Date();
  let used = user.pathwaysUsedThisMonth;

  if (!user.pathwaysResetDate || now > user.pathwaysResetDate) {
    used = 0;
  }

  return {
    limitReached: used >= limit,
    pathwaysUsed: used,
    pathwayLimit: limit,
  };
}
