export type ScrapedCode = {
  code: string;
  status: "active" | "check";
  rewardsText?: string;
  levelRequirement?: number | null;
  isNew?: boolean;
  provider?: "robloxden" | "beebom" | "progameguides" | "destructoid";
  providerPriority?: number;
};

export type ScrapedExpiredCode = string | { code: string; provider?: ScrapedCode["provider"] };

export type ScrapeResult = {
  codes: ScrapedCode[];
  expiredCodes: ScrapedExpiredCode[];
};
