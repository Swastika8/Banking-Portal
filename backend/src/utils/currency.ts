export function formatCurrency(amount: number): string {
  // Formats a number as Indian Rupees with two decimal places.
  // Future enhancement: add locale-specific grouping (e.g., 1,23,456.78).
  return `INR ${amount.toFixed(2)}`;
}
