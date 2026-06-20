const CASHFREE_SDK_URL = "https://sdk.cashfree.com/js/v3/cashfree.js";

let scriptPromise = null;

/** Load Cashfree checkout SDK once (deduped in-flight). */
export function loadCashfreeScript() {
  if (typeof window !== "undefined" && window.Cashfree) {
    return Promise.resolve(window.Cashfree);
  }
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${CASHFREE_SDK_URL}"]`);
    if (existing) {
      if (window.Cashfree) {
        resolve(window.Cashfree);
        return;
      }
      existing.addEventListener("load", () => resolve(window.Cashfree));
      existing.addEventListener("error", () => {
        scriptPromise = null;
        reject(new Error("Failed to load Cashfree"));
      });
      return;
    }

    const script = document.createElement("script");
    script.src = CASHFREE_SDK_URL;
    script.async = true;
    script.onload = () => resolve(window.Cashfree);
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Failed to load Cashfree"));
    };
    document.body.appendChild(script);
  });

  return scriptPromise;
}

/** Open Cashfree hosted checkout (inline in mountEl, or modal fallback). */
export async function openCashfreeCheckout({ paymentSessionId, mode = "sandbox", mountEl = null }) {
  const Cashfree = await loadCashfreeScript();
  const cashfree = Cashfree({ mode: mode === "production" ? "production" : "sandbox" });

  const appearance = {
    width: "100%",
    height: "720px",
  };

  if (mountEl) {
    return cashfree.checkout({
      paymentSessionId,
      redirectTarget: mountEl,
      appearance,
    });
  }

  return cashfree.checkout({
    paymentSessionId,
    redirectTarget: "_modal",
    appearance: {
      width: "560px",
      height: "720px",
    },
  });
}
