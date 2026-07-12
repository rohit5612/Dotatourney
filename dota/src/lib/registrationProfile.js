import { isValidPhoneNumber, PHONE_NUMBER_ERROR } from "./phoneNumber.js";

/** Fields required before main-roster registration or substitute pool signup. */
export function validateRegistrationProfile(form) {
  if (!String(form.displayName ?? "").trim()) {
    return "Display name is required.";
  }
  if (form.mmr === "" || form.mmr == null) {
    return "MMR is required.";
  }
  const mmr = Number(form.mmr);
  if (!Number.isFinite(mmr) || mmr < 0 || mmr > 20000) {
    return "Enter a valid MMR between 0 and 20,000.";
  }
  if (!String(form.phoneNumber ?? "").trim()) {
    return "Phone number is required.";
  }
  if (!isValidPhoneNumber(form.phoneNumber)) {
    return PHONE_NUMBER_ERROR;
  }
  if (!String(form.location ?? "").trim()) {
    return "Location is required.";
  }
  if (!Array.isArray(form.preferredRoles) || form.preferredRoles.length === 0) {
    return "Select at least one preferred role.";
  }
  return null;
}

/** PATCH /player/me payload — text fields as strings; phone digits only. */
export function buildRegistrationProfilePatch(form) {
  return {
    displayName: String(form.displayName ?? "").trim(),
    mmr: String(form.mmr ?? "").trim(),
    preferredRoles: (form.preferredRoles || []).map((role) => String(role)),
    location: String(form.location ?? "").trim(),
    phoneNumber: String(form.phoneNumber ?? "").trim(),
  };
}

/** Substitute-only fields stay optional. */
export function buildSubstituteSignupPayload(form) {
  return {
    availability: String(form.availability ?? ""),
    notes: String(form.notes ?? ""),
  };
}

export function registrationProfileFormComplete(form) {
  return validateRegistrationProfile(form) === null;
}
