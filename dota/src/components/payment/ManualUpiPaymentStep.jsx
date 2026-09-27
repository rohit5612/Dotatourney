import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { readPaymentScreenshotFile } from "../../utils/compressImageForUpload.js";

export function ManualUpiPaymentStep({ upi, onSubmit, busy = false, disabled = false }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [screenshot, setScreenshot] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!upi?.uri) {
      setQrDataUrl("");
      return;
    }
    QRCode.toDataURL(upi.uri, { margin: 2, width: 280 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [upi?.uri]);

  async function onChooseFile(event) {
    const file = event.target.files?.[0];
    setError("");
    if (!file) {
      setScreenshot("");
      return;
    }
    try {
      setScreenshot(await readPaymentScreenshotFile(file));
    } catch (err) {
      setError(err.message || "Could not read image.");
      setScreenshot("");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!screenshot) {
      setError("Payment screenshot is required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({ paymentScreenshot: screenshot, notes });
    } catch (err) {
      setError(err.message || "Could not submit payment proof.");
    } finally {
      setSubmitting(false);
    }
  }

  const locked = busy || submitting || disabled;

  return (
    <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
      <div className="rounded-md border border-border bg-background p-4 text-sm">
        <p className="font-medium text-foreground">Pay via UPI</p>
        <p className="mt-1 text-muted-foreground">
          Scan the QR or pay <strong className="text-foreground">₹{upi?.amountRupees}</strong> to{" "}
          <span className="font-mono text-primary">{upi?.vpa}</span>
        </p>
        {(upi?.tn || upi?.tr) && (
          <p className="mt-2 text-xs text-muted-foreground">
            In your UPI app, use note <span className="font-mono text-foreground">{upi.tn}</span>
            {upi.tr ? (
              <>
                {" "}
                and reference <span className="font-mono text-foreground">{upi.tr}</span>
              </>
            ) : null}{" "}
            so we can match your payment quickly.
          </p>
        )}
      </div>

      {qrDataUrl ? (
        <div className="flex flex-col items-start gap-2">
          <img src={qrDataUrl} alt="UPI payment QR code" className="h-64 w-64 max-w-full rounded-md border border-border bg-white p-2" />
        </div>
      ) : null}

      <label className="block text-sm">
        UPI transaction notes (optional)
        <input
          type="text"
          className="mt-1 w-full rounded-md border border-input bg-background p-2"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="UTR or extra reference from your bank app"
          disabled={locked}
        />
      </label>

      <div className="block text-sm font-medium">
        <span className="block">
          Payment screenshot <span className="text-destructive">*</span>
        </span>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input
            id="manual-upi-payment-screenshot"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={onChooseFile}
            disabled={locked}
          />
          <label htmlFor="manual-upi-payment-screenshot" className="btn btn-outline cursor-pointer">
            Choose file
          </label>
          <span className="text-xs text-muted-foreground">
            {screenshot ? "Image selected" : "Required — upload proof of payment"}
          </span>
        </div>
      </div>

      {screenshot ? (
        <img src={screenshot} alt="Payment screenshot preview" className="max-h-48 rounded-md border border-border object-contain" />
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <button type="submit" className="btn btn-primary" disabled={locked || !screenshot}>
        {submitting || busy ? "Submitting…" : "Submit payment proof"}
      </button>
    </form>
  );
}
