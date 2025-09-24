export type ScrapedCode = {
  code: string;
  status: "active" | "check";
  rewardsText?: string;
  levelRequirement?: number | null;
  isNew?: boolean;
  provider?: "robloxden" | "beebom";
};

export type ScrapeResult = {
  codes: ScrapedCode[];
  expiredCodes: string[];
};
