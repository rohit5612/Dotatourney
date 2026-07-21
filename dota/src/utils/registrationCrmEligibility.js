/** Whether a registration belongs in the main Registration CRM list / sheet export. */
export function isRegistrationCrmEligible(registration) {
  if (!registration || registration.substituteFlag) return false;
  if (registration.registrationStatus === "approved") return true;
  if (registration.registrationStatus === "replaced") return true;
  if (registration.paymentStatus === "paid") return true;
  const stage = registration.registrationFlowStage || "submitted";
  return stage !== "awaiting_otp" && stage !== "awaiting_payment";
}
