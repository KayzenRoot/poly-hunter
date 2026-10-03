export function createFixedClock(instant: Date | number): () => Date {
  const epochMilliseconds =
    typeof instant === "number" ? instant : instant.getTime();

  if (!Number.isFinite(epochMilliseconds)) {
    throw new RangeError("A fixed clock requires a valid instant.");
  }

  return () => new Date(epochMilliseconds);
}
