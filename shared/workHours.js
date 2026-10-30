// Add the saved decimal representations without rounding fractional work hours.
// Number remains the persistence/API type; BigInt is used only while summing.
export function addHours(...values) {
  const parts = values.map(value => {
    const number = Number(value ?? 0);
    if (!Number.isFinite(number)) throw new Error('Hours must be finite.');
    const [coefficient, exponent = '0'] = String(number).split('e');
    const [whole, fraction = ''] = coefficient.split('.');
    let units = BigInt(whole + fraction);
    let scale = fraction.length - Number(exponent);
    if (scale < 0) { units *= 10n ** BigInt(-scale); scale = 0; }
    return { units, scale };
  });
  const scale = Math.max(0, ...parts.map(part => part.scale));
  const units = parts.reduce((sum, part) => sum + part.units * 10n ** BigInt(scale - part.scale), 0n);
  return Number(`${units}e-${scale}`);
}
