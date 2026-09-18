/** "Rahul Sharma" → "RS", "FreshMart" → "FR" (avatar/logo fallback) */
export function initials(name: string, max = 2): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return (parts[0] ?? '').slice(0, max).toUpperCase();
  return parts
    .slice(0, max)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase();
}

/** "10 min ago" / "2 hours ago" / "Yesterday, 4:15 PM" (screen [13]) */
export function relativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24 && isSameDay(date, now)) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  if (isYesterday(date, now)) return `Yesterday, ${formatTime(date)}`;
  return `${formatDate(date)}, ${formatTime(date)}`;
}

/** "2:10 PM" */
export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

/** "10 Sep" */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

/** "Today, 2:10 PM" / "10 Sep, 6:30 PM" (screen [11]) */
export function formatOrderTimestamp(date: Date, now: Date = new Date()): string {
  if (isSameDay(date, now)) return `Today, ${formatTime(date)}`;
  if (isYesterday(date, now)) return `Yesterday, ${formatTime(date)}`;
  return `${formatDate(date)}, ${formatTime(date)}`;
}

/** "Valid till Today, 11 PM" (screen [1]) */
export function formatValidTill(endsAt: Date, now: Date = new Date()): string {
  const time = formatTime(endsAt).replace(':00', '');
  if (isSameDay(endsAt, now)) return `Valid till Today, ${time}`;
  return `Valid till ${formatDate(endsAt)}, ${time}`;
}

/** "15-20 min" */
export function formatEta(min: number, max: number): string {
  return min === max ? `${min} min` : `${min}-${max} min`;
}

function isSameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

function isYesterday(a: Date, b: Date): boolean {
  const y = new Date(b.getTime() - 86_400_000);
  return dayKey(a) === dayKey(y);
}

function dayKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
}
