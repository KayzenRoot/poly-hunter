import type { DecimalString } from "@polyhunter/contracts";

/**
 * Exact decimal-string handling for provider prices/sizes.
 *
 * The canonical representation is the decimal string itself; binary floating
 * point is never constructed as the authority for price/size state. Comparison
 * uses BigInt over a common scale, so two strings that differ only in
 * representation (`"0.10"` vs `"0.1"`) compare as equal values.
 */

const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;
const MAX_DECIMAL_LENGTH = 256;

/** True when `value` is a finite, exponent-free decimal string. */
export function isDecimalString(value: string): boolean {
  return value.length <= MAX_DECIMAL_LENGTH && DECIMAL_PATTERN.test(value);
}

/**
 * Canonicalizes a provider decimal string: rejects non-decimals and
 * exponent forms, strips insignificant leading zeros and trailing fractional
 * zeros, and normalizes `-0` to `0`.
 */
export function normalizeDecimal(value: string): DecimalString {
  if (typeof value !== "string" || !isDecimalString(value)) {
    throw new RangeError(`not a canonical decimal string: ${String(value)}`);
  }
  let text = value;
  let sign = "";
  if (text.startsWith("-")) {
    sign = "-";
    text = text.slice(1);
  }
  const parts = text.split(".");
  let whole = parts[0] ?? "0";
  let fraction = parts[1] ?? "";
  fraction = fraction.replace(/0+$/, "");
  whole = whole.replace(/^0+(?=\d)/, "");
  if (whole === "0" && fraction === "") {
    return "0" as DecimalString;
  }
  const normalized = `${sign}${whole}${fraction ? `.${fraction}` : ""}`;
  return normalized as DecimalString;
}

/** Normalizes a decimal value that must not be negative (prices/sizes). */
export function normalizeNonNegativeDecimal(value: string): DecimalString {
  const normalized = normalizeDecimal(value);
  if (normalized.startsWith("-")) {
    throw new RangeError("decimal value must be non-negative");
  }
  return normalized;
}

/** Normalizes a decimal value that must be strictly greater than zero. */
export function normalizePositiveDecimal(value: string): DecimalString {
  const normalized = normalizeNonNegativeDecimal(value);
  if (normalized === "0") {
    throw new RangeError("decimal value must be greater than zero");
  }
  return normalized;
}

/** Split into (sign, scaled bigint, scale) for exact comparison. */
function scaled(value: DecimalString): {
  negative: boolean;
  magnitude: bigint;
  scale: number;
} {
  const text = value.startsWith("-") ? value.slice(1) : value;
  const parts = text.split(".");
  const whole = parts[0] ?? "0";
  const fraction = parts[1] ?? "";
  return {
    negative: value.startsWith("-"),
    magnitude: BigInt(whole + fraction),
    scale: fraction.length,
  };
}

/** Exact three-way comparison of two canonical decimal strings. */
export function compareDecimal(a: DecimalString, b: DecimalString): -1 | 0 | 1 {
  const left = scaled(normalizeDecimal(a));
  const right = scaled(normalizeDecimal(b));
  const scale = Math.max(left.scale, right.scale);
  const leftValue = left.magnitude * 10n ** BigInt(scale - left.scale);
  const rightValue = right.magnitude * 10n ** BigInt(scale - right.scale);
  const leftSigned = left.negative ? -leftValue : leftValue;
  const rightSigned = right.negative ? -rightValue : rightValue;
  if (leftSigned < rightSigned) return -1;
  if (leftSigned > rightSigned) return 1;
  return 0;
}
