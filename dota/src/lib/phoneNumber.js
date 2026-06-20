export const PHONE_NUMBER_REGEX = /^\d{10}$/;

export const PHONE_NUMBER_ERROR =
  "Phone number must be exactly 10 digits with no spaces or special characters.";

export function sanitizePhoneInput(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 10);
}

export function isValidPhoneNumber(value) {
  return PHONE_NUMBER_REGEX.test(String(value || "").trim());
}
