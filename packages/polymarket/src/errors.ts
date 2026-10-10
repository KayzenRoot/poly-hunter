import {
  PolymarketProviderError,
  type ProviderErrorCode,
} from "@polyhunter/contracts";

/**
 * Normalizes anything thrown by the official SDK, a transport, or a response
 * into the single {@link PolymarketProviderError} that may cross the boundary.
 *
 * Classification is duck-typed on the error's own `name`/`status` shape rather
 * than `instanceof`, so the check works regardless of SDK chunking and can be
 * verified by unit tests with plain fakes. The original error object never
 * crosses the boundary — only the normalized code and a bounded message.
 */
export function normalizeProviderError(
  error: unknown,
): PolymarketProviderError {
  if (error instanceof PolymarketProviderError) {
    return error;
  }
  if (error instanceof RangeError) {
    return new PolymarketProviderError(
      "PROVIDER_MALFORMED",
      error.message.slice(0, 300),
      { category: "malformed" },
    );
  }
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name?: unknown }).name)
      : "";
  const shaped = error as {
    status?: unknown;
    statusCode?: unknown;
    message?: unknown;
  };
  const status =
    typeof shaped.status === "number"
      ? shaped.status
      : typeof shaped.statusCode === "number"
        ? shaped.statusCode
        : null;
  const rawMessage =
    typeof shaped.message === "string" && shaped.message.length > 0
      ? shaped.message
      : "provider request failed";
  // Bound the message so provider error text cannot become a domain contract.
  const message = rawMessage.slice(0, 300);

  let code: ProviderErrorCode = "PROVIDER_UNAVAILABLE";
  if (/UserInputError/i.test(name)) {
    code = "PROVIDER_BAD_REQUEST";
  } else if (/RateLimitError/i.test(name) || status === 429) {
    code = "PROVIDER_RATE_LIMITED";
  } else if (/TransportError/i.test(name)) {
    code = "PROVIDER_UNAVAILABLE";
  } else if (/TimeoutError/i.test(name)) {
    code = "PROVIDER_TIMEOUT";
  } else if (/UnexpectedResponseError/i.test(name)) {
    code = "PROVIDER_MALFORMED";
  } else if (/RequestRejectedError/i.test(name) && status !== null) {
    code =
      status === 400
        ? "PROVIDER_BAD_REQUEST"
        : status === 404
          ? "PROVIDER_NOT_FOUND"
          : status >= 500
            ? "PROVIDER_UNAVAILABLE"
            : "PROVIDER_REJECTED";
  } else if (status !== null) {
    code =
      status === 400
        ? "PROVIDER_BAD_REQUEST"
        : status === 404
          ? "PROVIDER_NOT_FOUND"
          : status === 429
            ? "PROVIDER_RATE_LIMITED"
            : status >= 500
              ? "PROVIDER_UNAVAILABLE"
              : "PROVIDER_REJECTED";
  }

  return new PolymarketProviderError(code, message, { status });
}

/** Wraps a promise so every rejection crosses the boundary normalized. */
export async function normalizeProviderCall<TValue>(
  operation: () => Promise<TValue>,
): Promise<TValue> {
  try {
    return await operation();
  } catch (error: unknown) {
    throw normalizeProviderError(error);
  }
}

/**
 * True when a response payload is unusable. Used to turn an OK-status response
 * with an unexpected body into `PROVIDER_MALFORMED` instead of letting shape
 * errors escape as generic TypeErrors.
 */
export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
