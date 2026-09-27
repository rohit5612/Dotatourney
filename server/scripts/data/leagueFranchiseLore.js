import { FRANCHISE_COPY_PART1 } from "./leagueFranchiseLore.part1.js";
import { FRANCHISE_COPY_PART2 } from "./leagueFranchiseLore.part2.js";

/** @type {Record<string, { tagline: string, lore: string }>} */
export const FRANCHISE_COPY = {
  ...FRANCHISE_COPY_PART1,
  ...FRANCHISE_COPY_PART2,
};
