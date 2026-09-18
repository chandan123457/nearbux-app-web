/**
 * "Open Now" / "Closed · Opens 9 AM" badge logic (screen [1]).
 *
 * Hours store ke local time (IST) mein "HH:mm" strings ki tarah save hote hain.
 * UTC timestamps use karna galat hoga — store 9 baje kholta hai, chahe
 * daylight/timezone kuch bhi ho.
 */
export interface StoreHourSlot {
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday
  opensAt: string; // "09:00"
  closesAt: string; // "22:00"
}

export interface OpenState {
  isOpen: boolean;
  /** Band hai to next opening: "Opens 9 AM" */
  opensAtLabel: string | null;
}

const IST_OFFSET_MINUTES = 330; // UTC+5:30

export function getOpenState(
  slots: StoreHourSlot[],
  opts: { now?: Date; isTemporarilyClosed?: boolean } = {},
): OpenState {
  if (opts.isTemporarilyClosed) {
    return { isOpen: false, opensAtLabel: null };
  }
  const now = opts.now ?? new Date();
  const { day, minutes } = istParts(now);

  const todaySlots = slots.filter((s) => s.dayOfWeek === day);
  for (const slot of todaySlots) {
    const open = toMinutes(slot.opensAt);
    const close = toMinutes(slot.closesAt);
    // Midnight ke paar chalne wale slots (22:00 → 02:00) bhi handle hote hain
    const spansMidnight = close <= open;
    const isOpen = spansMidnight
      ? minutes >= open || minutes < close
      : minutes >= open && minutes < close;
    if (isOpen) return { isOpen: true, opensAtLabel: null };
  }

  const next = findNextOpening(slots, day, minutes);
  return { isOpen: false, opensAtLabel: next ? `Opens ${formatClock(next)}` : null };
}

function findNextOpening(slots: StoreHourSlot[], day: number, minutes: number): string | null {
  // Aaj baaki bacha koi slot
  const laterToday = slots
    .filter((s) => s.dayOfWeek === day && toMinutes(s.opensAt) > minutes)
    .sort((a, b) => toMinutes(a.opensAt) - toMinutes(b.opensAt))[0];
  if (laterToday) return laterToday.opensAt;

  // Agle 7 din mein pehla slot
  for (let offset = 1; offset <= 7; offset++) {
    const d = (day + offset) % 7;
    const slot = slots
      .filter((s) => s.dayOfWeek === d)
      .sort((a, b) => toMinutes(a.opensAt) - toMinutes(b.opensAt))[0];
    if (slot) return slot.opensAt;
  }
  return null;
}

/** "09:00" → "9 AM", "13:30" → "1:30 PM" */
export function formatClock(hhmm: string): string {
  const [hStr = '0', mStr = '0'] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function toMinutes(hhmm: string): number {
  const [h = '0', m = '0'] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
}

function istParts(date: Date): { day: number; minutes: number } {
  const shifted = new Date(date.getTime() + IST_OFFSET_MINUTES * 60_000);
  return {
    day: shifted.getUTCDay(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}
