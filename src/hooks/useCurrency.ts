import { useConfig } from '../context/ConfigContext';
import { formatCurrency as baseFormatCurrency } from '../lib/utils';

export function useCurrency() {
  const { currencySymbol } = useConfig();
  
  const formatCurrency = (amount: number) => {
    return baseFormatCurrency(amount, currencySymbol);
  };
  
  return { formatCurrency, currencySymbol };
}
