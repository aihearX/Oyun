import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { colors, radius, space } from './theme';
import { reportNativeCrash } from '../hata';

type Variant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'bodyStrong' | 'small' | 'tiny' | 'mono';
const variants: Record<Variant, TextStyle> = {
  display: { fontSize: 40, fontWeight: '800', letterSpacing: -0.8 },
  h1: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '800' },
  h3: { fontSize: 17, fontWeight: '800' },
  body: { fontSize: 16, fontWeight: '500', lineHeight: 22 },
  bodyStrong: { fontSize: 16, fontWeight: '700' },
  small: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  tiny: { fontSize: 12, fontWeight: '700' },
  mono: { fontSize: 12, fontFamily: 'Menlo' },
};

export function AppText({ variant = 'body', muted, center, style, children, ...rest }: { variant?: Variant; muted?: boolean; center?: boolean; style?: StyleProp<TextStyle>; children?: React.ReactNode } & React.ComponentProps<typeof Text>) {
  return <Text {...rest} style={[{ color: muted ? colors.muted : colors.text }, variants[variant], center && { textAlign: 'center' }, style]}>{children}</Text>;
}

export function Button({ title, variant = 'primary', size = 'md', disabled, style, ...rest }: { title: string; variant?: 'primary' | 'ghost' | 'coral'; size?: 'sm' | 'md' | 'lg' } & PressableProps & { style?: StyleProp<ViewStyle> }) {
  const bg = variant === 'primary' ? colors.accent : variant === 'coral' ? colors.coral : colors.bg2;
  const fg = variant === 'ghost' ? colors.text : colors.white;
  const pad = size === 'sm' ? { paddingVertical: 10, paddingHorizontal: 16 } : size === 'lg' ? { paddingVertical: 17, paddingHorizontal: 28 } : { paddingVertical: 14, paddingHorizontal: 22 };
  return (
    <Pressable accessibilityRole="button" disabled={disabled} {...rest} style={({ pressed }) => [styles.btn, pad, { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }, variant === 'ghost' && { borderWidth: 1, borderColor: colors.line }, style]}>
      <Text style={{ color: fg, fontWeight: '800', fontSize: size === 'sm' ? 14 : size === 'lg' ? 18 : 17 }}>{title}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Pill({ children }: { children: React.ReactNode }) {
  return <View style={styles.pill}><Text style={{ fontWeight: '700', fontSize: 14, color: colors.text }}>{children}</Text></View>;
}

export function Loading({ text }: { text: string }) {
  return <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /><AppText variant="bodyStrong" style={{ marginTop: 12 }}>{text}</AppText></View>;
}

type EBProps = { children: React.ReactNode; title?: string; onReset?: () => void; /** çökme raporu gönder (YN-011; kişisel veri yok) */ report?: boolean };
type EBState = { error: Error | null; info: string };
/** Oyun motoru (DOM bileşeni) çökerse kırmızı ekran yerine okunabilir bir kart; "Tekrar dene" bileşeni yeniden kurar. */
export class ErrorBoundary extends React.Component<EBProps, EBState> {
  override state: EBState = { error: null, info: '' };
  static getDerivedStateFromError(error: Error): Partial<EBState> { return { error }; }
  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ info: info.componentStack ?? '' });
    if (this.props.report) reportNativeCrash(error, 'kabuk-sinir');
  }
  reset = () => { this.setState({ error: null, info: '' }); this.props.onReset?.(); };
  override render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;
    const text = `${this.props.title ?? 'Uygulama'}\n${error.name}: ${error.message}\n${(error.stack ?? '').split('\n').slice(0, 8).join('\n')}\n${info.split('\n').slice(0, 6).join('\n')}`;
    return (
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} style={{ backgroundColor: colors.bg }}>
        <AppText variant="h2">Bir şeyler ters gitti</AppText>
        <AppText variant="body" muted style={{ marginTop: 6 }}>Oyun bu cihazda hata verdi. Aşağıdaki metni bize gönderirsen hızlıca düzeltiriz.</AppText>
        <View style={[styles.card, { marginTop: space.lg }]}><AppText variant="mono">{text}</AppText></View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: space.lg }}>
          <Button title="Tekrar dene" onPress={this.reset} />
        </View>
      </ScrollView>
    );
  }
}

export const styles = StyleSheet.create({
  btn: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: space.lg },
  pill: { backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: 14, paddingBottom: 40 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
});
