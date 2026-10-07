/**
 * Public VIN display: everything but the last three characters is replaced
 * with bullets ("••••••••••••••478"). The masking happens on the server, so
 * the full VIN never reaches the page for viewers who aren't allowed to see
 * it -- there's nothing to find in view-source or dev tools.
 */
export function maskVin(vin: string | null | undefined): string | null {
  const v = (vin ?? "").trim();
  if (!v) return null;
  if (v.length <= 3) return "•".repeat(v.length);
  return "•".repeat(v.length - 3) + v.slice(-3);
}
