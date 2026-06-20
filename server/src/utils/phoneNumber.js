import { z } from "zod";

export const PHONE_NUMBER_REGEX = /^\d{10}$/;

export const PHONE_NUMBER_ERROR =
  "Phone number must be exactly 10 digits with no spaces or special characters.";

export function isValidPhoneNumber(value) {
  return PHONE_NUMBER_REGEX.test(String(value || "").trim());
}

export const phoneNumberSchema = z
  .string()
  .trim()
  .refine(isValidPhoneNumber, { message: PHONE_NUMBER_ERROR });

export const optionalPhoneNumberSchema = z
  .string()
  .trim()
  .optional()
  .refine((val) => val === undefined || val === "" || isValidPhoneNumber(val), {
    message: PHONE_NUMBER_ERROR,
  });
