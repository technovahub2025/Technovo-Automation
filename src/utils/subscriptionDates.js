export const toDateInput = (value) => {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const subscriptionEndDate = (start, cycle) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return '';
  const date = new Date(`${start}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return '';
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + (cycle === 'yearly' ? 12 : 1));
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return toDateInput(date);
};
