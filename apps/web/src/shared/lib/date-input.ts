'use client';

export function getTodayDateInputValue(date = new Date()): string {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

export function getTodayMonthInputValue(date = new Date()): string {
  return getTodayDateInputValue(date).slice(0, 7);
}
