// Dashboard utility functions

// Helper to create UTC date from year, month, day
export const createUTCDate = (year: number, month: number, day: number) => {
  return new Date(Date.UTC(year, month, day));
};

// Get current UTC date at midnight
export const getCurrentUTCDate = () => {
  const now = new Date();
  return createUTCDate(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
};

// Parse date string in YYYY-MM-DD format as UTC
export const parseUTCDate = (dateString: string): Date | null => {
  if (!dateString) return null;
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return createUTCDate(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }
  return null;
};

export const getWeekRange = (date: Date) => {
  // Assume date is already in desired timezone (UTC)
  const d = new Date(date);
  const day = d.getUTCDay();
  // Calculate Monday (1st day of week): if Sunday (0), go back 6 days; otherwise go back (day-1) days
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));

  // For school schedule use weekdays only: calculate Friday (5th day)
  const friday = new Date(monday);
  friday.setUTCDate(monday.getUTCDate() + 4);

  return { monday, friday };
};

export const getEffectiveCurrentWeekStart = (schoolConfig?: { schoolReopenDate?: string }) => {
  // If school re-open date is set and is in the future, use it as reference
  if (schoolConfig?.schoolReopenDate) {
    const reopenDate = parseUTCDate(schoolConfig.schoolReopenDate);
    const today = getCurrentUTCDate();
    if (reopenDate && reopenDate > today) {
      // School hasn't reopened yet, return the week of re-open date
      return getWeekRange(reopenDate).monday;
    }
  }
  // Otherwise, use today's week
  return getWeekRange(getCurrentUTCDate()).monday;
};