export function useCurrency() {
  function formatNaira(amount) {
    if (!amount && amount !== 0) return "—";
    const num = parseFloat(amount);
    if (isNaN(num)) return "—";
    return `₦${num.toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
  }

  function parseNaira(formatted) {
    return parseFloat(formatted.replace(/[₦,]/g, ""));
  }

  return { formatNaira, parseNaira };
}
