// Month parsing/windowing helpers for the education-expense endpoints.
// Kept in their own module (no side effects) so unit tests can import them
// without starting the server.

// Parse a "YYYY-MM" month parameter into numeric parts, or null if malformed.
export function parseMonthParam(monthParam) {
  if (!monthParam) return null;
  const match = /^(\d{4})-(\d{2})$/.exec(monthParam);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

// Half-open [start, end) range for a month in server-local time. Used for
// timestamps recorded by this server (e.g. receipt createdAt).
export function getMonthRange(year, month) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return { start, end };
}

// Half-open [start, end) range for a month in UTC. Used for calendar dates
// stored as UTC midnight (e.g. bank transaction dates); a local-time window
// would clip the first or last day of the month for anyone west of UTC.
export function getUtcMonthRange(year, month) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

// Parse a "YYYY" year parameter, or null if malformed. The range matches what
// the rent endpoints accept for a year, so an export cannot ask for a window
// no entry could ever fall in.
export function parseYearParam(yearParam) {
  if (!yearParam) return null;
  const match = /^(\d{4})$/.exec(yearParam);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  if (year < 2000 || year > 2100) return null;
  return year;
}

// Half-open [start, end) range for a whole year in server-local time.
export function getYearRange(year) {
  return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) };
}

// Half-open [start, end) range for a whole year in UTC.
export function getUtcYearRange(year) {
  return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year + 1, 0, 1)) };
}
