import { DEVEX_MIN, DEVEX_NEW_RATE, DEVEX_OLD_RATE } from "./constants";

export type DevexPayoutResult = {
  usd: number;
  eligible: boolean;
  shortfallRobux: number;
  appliedRate: number;
  totalRobux: number;
};

export type DevexRequirementResult = {
  robuxNeeded: number;
  eligibleAtTarget: boolean;
  shortfallRobux: number;
  appliedRate: number;
};

export type DevexAdvancedResult = {
  oldUsd: number;
  newUsd: number;
  totalUsd: number;
  totalRobux: number;
  eligible: boolean;
  shortfallRobux: number;
};

function normalizeNumber(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

export function calculateDevexPayout(robux: number, rate: number = DEVEX_NEW_RATE): DevexPayoutResult {
  const totalRobux = normalizeNumber(robux);
  const usd = totalRobux * rate;
  const eligible = totalRobux >= DEVEX_MIN;
  const shortfallRobux = eligible ? 0 : Math.max(0, DEVEX_MIN - totalRobux);

  return {
    usd,
    eligible,
    shortfallRobux,
    appliedRate: rate,
    totalRobux
  };
}

export function calculateDevexRequirement(usd: number, rate: number = DEVEX_NEW_RATE): DevexRequirementResult {
  const targetUsd = normalizeNumber(usd);
  const robuxNeeded = rate > 0 ? targetUsd / rate : 0;
  const eligibleAtTarget = robuxNeeded >= DEVEX_MIN;
  const shortfallRobux = eligibleAtTarget ? 0 : Math.max(0, DEVEX_MIN - robuxNeeded);

  return {
    robuxNeeded,
    eligibleAtTarget,
    shortfallRobux,
    appliedRate: rate
  };
}

export function calculateAdvancedDevex(oldRobux: number, newRobux: number): DevexAdvancedResult {
  const normalizedOld = normalizeNumber(oldRobux);
  const normalizedNew = normalizeNumber(newRobux);
  const oldUsd = normalizedOld * DEVEX_OLD_RATE;
  const newUsd = normalizedNew * DEVEX_NEW_RATE;
  const totalRobux = normalizedOld + normalizedNew;
  const totalUsd = oldUsd + newUsd;
  const eligible = totalRobux >= DEVEX_MIN;
  const shortfallRobux = eligible ? 0 : Math.max(0, DEVEX_MIN - totalRobux);

  return {
    oldUsd,
    newUsd,
    totalUsd,
    totalRobux,
    eligible,
    shortfallRobux
  };
}
