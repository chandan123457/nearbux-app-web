/**
 * Icon stubs.
 *
 * `lucide-react-native` aur `react-native-svg` untranspiled source ship
 * karte hain jo Node seedha nahi chala sakta. Yeh tests DOM ka STRUCTURE
 * check karte hain — kaunse elements kiske andar hain — icons ka shape nahi.
 * Unhe stub karna test se sirf shor hataata hai, coverage nahi.
 */
import { createElement } from 'react';

const Icon = () => createElement('span', { 'data-icon': true });

export const Star = Icon;
export const Heart = Icon;
export const Plus = Icon;
export const Minus = Icon;
export const MapPin = Icon;
export const Clock = Icon;
export const Truck = Icon;
export const ImageIcon = Icon;
export const Search = Icon;
export const X = Icon;
export const ChevronRight = Icon;
export const ChevronDown = Icon;

export default Icon;
