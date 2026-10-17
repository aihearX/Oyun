import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import MapScreen from '../src/app/index';
import { useStore } from '../src/store';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }), Redirect: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children }));

/** Duman testi: harita 40 düğümle çizilir; 1. bölüm açık, 2. kilitli; "Bölüm 1 ▶" oyuna yönlendirir. */
describe('Harita', () => {
  it('40 düğüm çizer ve ilk bölümü açar', async () => {
    useStore.setState({ hydrated: true });
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<MapScreen />); });
    const nodes = tree.root.findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('node-') && typeof n.type !== 'string');
    const ids = new Set(nodes.map((n) => n.props.testID));
    expect(ids.size).toBe(40);
    const node1 = tree.root.find((n) => n.props.testID === 'node-1' && n.props.onPress != null && typeof n.type !== 'string');
    const node2 = tree.root.find((n) => n.props.testID === 'node-2' && n.props.onPress != null && typeof n.type !== 'string');
    expect(node1.props.disabled).toBe(false);
    expect(node2.props.disabled).toBe(true);
    const play = tree.root.find((n) => n.props.testID === 'play-current' && n.props.onPress != null && typeof n.type !== 'string');
    await act(async () => { play.props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/oyun/[n]', params: { n: '1' } });
    const texts = JSON.stringify(tree.toJSON());
    expect(texts).toContain('Sesin Yolu');
    expect(texts).toContain('Dış Kulak');
  });
});
