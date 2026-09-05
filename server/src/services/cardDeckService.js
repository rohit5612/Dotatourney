import { findAccountBySlug, findAccountById } from "./playerAccountRepository.js";
import { buildPublicDisplayCardManifest } from "./cardManifestService.js";
import { listSeasonCardSnapshotsForAccount } from "./cardSnapshotService.js";

export async function buildPlayerCardDeck(accountRow) {
  const account = accountRow?.id ? accountRow : await findAccountById(accountRow);
  if (!account) return null;

  const activeCard = await buildPublicDisplayCardManifest(account);
  const collection = await listSeasonCardSnapshotsForAccount(account.id);

  return {
    activeCard,
    collection,
  };
}

export async function buildPublicCardDeck(slug) {
  const account = await findAccountBySlug(slug);
  if (!account) return null;
  return buildPlayerCardDeck(account);
}
