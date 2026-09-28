/**
 * An amount stored in a currency's minor unit, formatted for people with the
 * currency's symbol and the group's stored `decimals`. 5000 is '₹50.00' in INR
 * (2), '¥5,000' in JPY (0) and 'KWD 5.000' in KWD (3).
 */
const formatAmount = (
  minorUnits: number,
  currency: string,
  decimals: number
): string => {
  const value = minorUnits / 10 ** decimals;
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    // Intl rejects a malformed code; show the code rather than fail the push.
    return `${currency} ${value.toFixed(decimals)}`;
  }
};

export { formatAmount };
