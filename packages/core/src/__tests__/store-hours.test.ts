import { describe, expect, it } from 'vitest';
import { formatClock, getOpenState } from '../store-hours.js';

const everyDay9to22 = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  opensAt: '09:00',
  closesAt: '22:00',
}));

/** IST wall-clock ko UTC Date mein badalta hai (IST = UTC+5:30) */
function ist(dateIso: string, hhmm: string): Date {
  const [h = '0', m = '0'] = hhmm.split(':');
  const base = new Date(`${dateIso}T00:00:00Z`);
  return new Date(base.getTime() + (Number(h) * 60 + Number(m) - 330) * 60_000);
}

describe('getOpenState', () => {
  it('business hours ke andar open hai', () => {
    expect(getOpenState(everyDay9to22, { now: ist('2026-09-18', '14:00') }).isOpen).toBe(true);
  });

  it('khulne se pehle band hai aur next opening batata hai', () => {
    const state = getOpenState(everyDay9to22, { now: ist('2026-09-18', '07:30') });
    expect(state.isOpen).toBe(false);
    expect(state.opensAtLabel).toBe('Opens 9 AM'); // screen [1] ka Metro Hardware
  });

  it('band hone ke baad kal ka opening dikhata hai', () => {
    const state = getOpenState(everyDay9to22, { now: ist('2026-09-18', '23:30') });
    expect(state.isOpen).toBe(false);
    expect(state.opensAtLabel).toBe('Opens 9 AM');
  });

  it('temporarily closed sab hours ko override karta hai', () => {
    const state = getOpenState(everyDay9to22, {
      now: ist('2026-09-18', '14:00'),
      isTemporarilyClosed: true,
    });
    expect(state.isOpen).toBe(false);
  });

  it('midnight ke paar jaane wale slots handle karta hai', () => {
    const lateNight = [{ dayOfWeek: 5, opensAt: '22:00', closesAt: '02:00' }];
    expect(getOpenState(lateNight, { now: ist('2026-09-18', '23:00') }).isOpen).toBe(true);
  });

  it('12-hour clock format', () => {
    expect(formatClock('09:00')).toBe('9 AM');
    expect(formatClock('13:30')).toBe('1:30 PM');
    expect(formatClock('00:00')).toBe('12 AM');
    expect(formatClock('12:00')).toBe('12 PM');
  });
});
