import { z } from "zod";

export const ORG_ROSTER_TIERS = ["founder", "admin", "mod", "caster"];
export const SPONSOR_TIERS = ["co", "major", "partner", "supporter"];

const socialsSchema = z
  .object({
    instagram: z.string().optional(),
    discord: z.string().optional(),
    steam: z.string().optional(),
    facebook: z.string().optional(),
    linkedin: z.string().optional(),
    youtube: z.string().optional(),
    website: z.string().optional(),
  })
  .optional();

export const orgRosterMemberSchema = z.object({
  id: z.string().min(1).max(120),
  gamerTag: z.string().min(1).max(120),
  realName: z.string().min(1).max(160),
  role: z.string().max(160).optional(),
  avatarUrl: z.string().min(1).max(2048),
  tier: z.enum(ORG_ROSTER_TIERS),
  order: z.number().int().min(0).max(999).optional(),
});

export const orgRosterSchema = z.object({
  section: z
    .object({
      eyebrow: z.string().max(120).optional(),
      title: z.string().max(160).optional(),
    })
    .optional(),
  members: z.array(orgRosterMemberSchema).max(64),
});

export const sponsorSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  tagline: z.string().max(200).optional(),
  tier: z.enum(SPONSOR_TIERS),
  tierRank: z.number().finite().optional(),
  order: z.number().int().min(0).max(999).optional(),
  logoUrl: z.string().min(1).max(2048),
  socials: socialsSchema,
});

export const sponsorsConfigSchema = z.object({
  section: z
    .object({
      eyebrow: z.string().max(120).optional(),
      title: z.string().max(160).optional(),
      subtitle: z.string().max(400).optional(),
    })
    .optional(),
  sponsors: z.array(sponsorSchema).max(48),
});

export const archiveEmbedSchema = z.object({
  id: z.string().min(1).max(120),
  label: z.string().min(1).max(160),
  youtubeUrl: z.string().min(1).max(2048),
});

export const archiveEmbedsSchema = z.array(archiveEmbedSchema).max(12);

export const seasonContentPatchSchema = z.object({
  sponsorsConfig: sponsorsConfigSchema.optional(),
  archiveEmbeds: archiveEmbedsSchema.optional(),
});

export function normalizeOrgRoster(payload) {
  const parsed = orgRosterSchema.parse(payload);
  const members = [...parsed.members].sort((a, b) => {
    const tierDiff =
      ORG_ROSTER_TIERS.indexOf(b.tier) - ORG_ROSTER_TIERS.indexOf(a.tier);
    if (tierDiff !== 0) return tierDiff;
    return (a.order ?? 999) - (b.order ?? 999);
  });
  return { section: parsed.section || {}, members };
}

export function normalizeSponsorsConfig(payload) {
  const parsed = sponsorsConfigSchema.parse(payload);
  return { section: parsed.section || {}, sponsors: parsed.sponsors || [] };
}

export function normalizeArchiveEmbeds(payload) {
  return archiveEmbedsSchema.parse(payload);
}
