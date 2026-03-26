export const formatWon = (value: number) =>
  new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0
  }).format(value);

export const formatNumber = (value: number, maximumFractionDigits = 1) =>
  new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits
  }).format(value);

export const formatDate = (value: string | null) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(value));
};
