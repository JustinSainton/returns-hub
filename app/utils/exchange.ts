export function calculateExchangeDifference(
  returnValue: number,
  cartTotal: number
): { difference: number; customerOwes: boolean; remainingCredit: number } {
  const diff = cartTotal - returnValue;
  return {
    difference: Math.abs(diff),
    customerOwes: diff > 0,
    remainingCredit: diff < 0 ? Math.abs(diff) : 0,
  };
}

export function calculateStoreCreditValue(
  returnValue: number,
  bonusPercent: number
): { baseValue: number; bonusValue: number; totalValue: number } {
  const baseValue = returnValue;
  const bonusValue = returnValue * (bonusPercent / 100);
  const totalValue = baseValue + bonusValue;
  return { baseValue, bonusValue, totalValue };
}
