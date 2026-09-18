import { StyleSheet, Text, View } from 'react-native';
import { fontSize, fontWeight, spacing, theme } from '../theme.js';

export interface BillLine {
  label: string;
  value: string;
  /** Discount lines blue mein dikhti hain (screens [7][8]) */
  highlight?: boolean;
}

export interface BillSummaryProps {
  lines: BillLine[];
  totalLabel?: string;
  totalValue: string;
  /** "Incl. all taxes & fees" */
  totalCaption?: string;
}

/**
 * Bill breakdown (screens [7][8][10][14]).
 *
 * Yeh sirf DISPLAY karta hai, calculate nahi. Saara bill math
 * `computeBill()` (@nearbux/core) mein hai aur server par authoritative hai —
 * warna client aur receipt alag-alag totals dikha sakte hain.
 */
export function BillSummary({
  lines,
  totalLabel = 'Total',
  totalValue,
  totalCaption,
}: BillSummaryProps) {
  return (
    <View style={styles.container}>
      {lines.map((line) => (
        <View key={line.label} style={styles.row}>
          <Text style={[styles.label, line.highlight && styles.highlight]}>{line.label}</Text>
          <Text style={[styles.value, line.highlight && styles.highlight]}>{line.value}</Text>
        </View>
      ))}

      <View style={styles.divider} />

      <View style={styles.totalRow}>
        <View style={styles.totalLabelWrap}>
          <Text style={styles.totalLabel}>{totalLabel}</Text>
          {totalCaption && <Text style={styles.totalCaption}>{totalCaption}</Text>}
        </View>
        <Text style={styles.totalValue}>{totalValue}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: fontSize.base, color: theme.textSecondary },
  value: { fontSize: fontSize.base, color: theme.textPrimary, fontWeight: fontWeight.medium },
  highlight: { color: theme.primary, fontWeight: fontWeight.medium },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: spacing.xs },
  totalRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  totalLabelWrap: { gap: 2 },
  totalLabel: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: theme.textPrimary },
  totalCaption: { fontSize: fontSize.xs, color: theme.textSecondary },
  totalValue: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, color: theme.textPrimary },
});
