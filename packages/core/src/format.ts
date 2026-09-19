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

/**
 * Date/time formatting jaan-boojh kar Intl ke month naam aur AM/PM par
 * depend NAHI karta.
 *
 * `Intl.DateTimeFormat` ka output platform ke ICU version par depend karta
 * hai. Node aur browsers September ko "Sept" dete hain, jabki Hermes
 * (Android) "Sep" de sakta hai, aur AM/PM ka case bhi locale-wise badalta
 * hai. Jo strings teeno platforms par ek jaisi dikhni chahiye, unke liye
 * yeh silent inconsistency hai.
 *
 * Isliye parts Intl se nikaalte hain (jo timezone sahi handle karta hai) aur
 * labels khud lagate hain.
 */
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

const IST = 'Asia/Kolkata';

/** Date ko IST ke calendar parts mein todta hai */
function istParts(date: Date): { day: number; month: number; year: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    day: get('day'),
    month: get('month'),
    year: get('year'),
    // hour12:false 24 ke liye "24" de sakta hai midnight par
    hour: get('hour') % 24,
    minute: get('minute'),
  };
}

/** "2:10 PM" */
export function formatTime(date: Date): string {
  const { hour, minute } = istParts(date);
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}

/** "10 Sep" */
export function formatDate(date: Date): string {
  const { day, month } = istParts(date);
  return `${String(day).padStart(2, '0')} ${MONTHS[month - 1]}`;
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
