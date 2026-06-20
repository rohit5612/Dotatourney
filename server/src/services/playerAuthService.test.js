import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCheckoutLineItems,
  computeCheckoutTotals,
} from "./paymentService.js";
import { DEFAULT_CARD_TIERS } from "./commerceConfigRepository.js";

const sampleCommerce = {
  registrationFeeRupees: 300,
  minCashRupees: 100,
  cardTiers: DEFAULT_CARD_TIERS,
};

test("buildCheckoutLineItems uses single bundle line per tier", () => {
  const items = buildCheckoutLineItems(sampleCommerce, "player");
  assert.equal(items.length, 1);
  assert.equal(items[0].key, "bundle_player");
  assert.equal(items[0].amount, 540);
  assert.equal(items[0].label, "Basic Card Bundle");
});

test("buildCheckoutLineItems gold bundle total", () => {
  const items = buildCheckoutLineItems(sampleCommerce, "gold");
  assert.equal(items.length, 1);
  assert.equal(items[0].amount, 540);
});

test("computeCheckoutTotals exposes maxCoinsApplicable", () => {
  const items = buildCheckoutLineItems(sampleCommerce, "default");
  const totals = computeCheckoutTotals(items, 50, 10, 100);
  assert.equal(totals.maxCoinsApplicable, 200);
  assert.equal(totals.coinDiscount, 10);
  assert.equal(totals.totalRupees, 290);
});

test("computeCheckoutTotals enforces min cash floor", () => {
  const items = buildCheckoutLineItems(sampleCommerce, "default");
  const totals = computeCheckoutTotals(items, 500, 500, 100);
  assert.equal(totals.totalRupees, 100);
});
