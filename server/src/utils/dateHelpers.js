// Date utility functions immune to timezone shifts (all operate on 'YYYY-MM-DD' strings).

export const addDays = (dateStr, days) => {
  const parts = dateStr.split('-');
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const addMonths = (dateStr, months) => {
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const targetDate = new Date(year, month + months, 1);
  const lastDayOfTarget = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
  const clampedDay = Math.min(day, lastDayOfTarget);
  targetDate.setDate(clampedDay);

  const targetYear = targetDate.getFullYear();
  const targetMonthStr = String(targetDate.getMonth() + 1).padStart(2, '0');
  const targetDayStr = String(targetDate.getDate()).padStart(2, '0');

  return `${targetYear}-${targetMonthStr}-${targetDayStr}`;
};

export const getLastDayOfCurrentMonth = () => {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-indexed
  const lastDay = new Date(y, m + 1, 0); // Day 0 of next month is the last day of current month
  const year = lastDay.getFullYear();
  const month = String(lastDay.getMonth() + 1).padStart(2, '0');
  const day = String(lastDay.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
