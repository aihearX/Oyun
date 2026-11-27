/* 1.3.0 anlık bildirim köprüsü (src/bildirim.ts): izin eşlemesi, anahtar (hata yutulur), dokunma verisi, kanal */
const mockGetPerm = jest.fn();
const mockReqPerm = jest.fn();
const mockToken = jest.fn();
const mockChannel = jest.fn(async (_id: string, _c: unknown) => null);
const mockHandler = jest.fn();
const mockLastResp = jest.fn(async () => null);
let mockRespListener: ((r: unknown) => void) | null = null;
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: () => mockGetPerm(),
  requestPermissionsAsync: (o: unknown) => mockReqPerm(o),
  getExpoPushTokenAsync: (o: unknown) => mockToken(o),
  setNotificationChannelAsync: (id: string, c: unknown) => mockChannel(id, c),
  setNotificationHandler: (h: unknown) => mockHandler(h),
  getLastNotificationResponseAsync: () => mockLastResp(),
  addNotificationResponseReceivedListener: (f: (r: unknown) => void) => { mockRespListener = f; return { remove: () => { mockRespListener = null; } }; },
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  IosAuthorizationStatus: { NOT_DETERMINED: 0, DENIED: 1, AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
  AndroidImportance: { HIGH: 5 },
}));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { eas: { projectId: 'proje-kimligi' } } } } }));

import { dokunusVerisi, installNotifications, pushAnahtari, pushIzin, pushIzinIste } from '../src/bildirim';

const yanit = (data: unknown, id = 'n1') => ({ actionIdentifier: 'expo.modules.notifications.actions.DEFAULT', notification: { request: { identifier: id, content: { data } } } });

describe('anlık bildirim köprüsü', () => {
  it('izin: verildi / reddedildi (iOS yeniden sorulamaz) / sorulmadı; geçici (provisional) verildi sayılır', async () => {
    mockGetPerm.mockResolvedValueOnce({ granted: true, status: 'granted', canAskAgain: true });
    expect(await pushIzin()).toBe('granted');
    mockGetPerm.mockResolvedValueOnce({ granted: false, status: 'denied', canAskAgain: false, ios: { status: 1 } });
    expect(await pushIzin()).toBe('denied');
    mockGetPerm.mockResolvedValueOnce({ granted: false, status: 'undetermined', canAskAgain: true, ios: { status: 0 } });
    expect(await pushIzin()).toBe('undetermined');
    mockGetPerm.mockResolvedValueOnce({ granted: false, status: 'undetermined', canAskAgain: true, ios: { status: 3 } });
    expect(await pushIzin()).toBe('granted');
    mockGetPerm.mockRejectedValueOnce(new Error('modül yok'));
    expect(await pushIzin()).toBe('denied');
    mockReqPerm.mockResolvedValueOnce({ granted: true, status: 'granted', canAskAgain: true });
    expect(await pushIzinIste()).toBe('granted');
    expect(mockReqPerm).toHaveBeenCalledWith({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
  });

  it('anahtar: EAS proje kimliğiyle; izin yoksa ya da alınamazsa (Android Firebase yok) null, hata dışarı çıkmaz', async () => {
    mockGetPerm.mockResolvedValue({ granted: true, status: 'granted', canAskAgain: true });
    mockToken.mockResolvedValueOnce({ type: 'expo', data: 'ExponentPushToken[abcdefgh12]' });
    expect(await pushAnahtari()).toEqual({ token: 'ExponentPushToken[abcdefgh12]', platform: 'ios' });
    expect(mockToken).toHaveBeenCalledWith({ projectId: 'proje-kimligi' });
    mockToken.mockRejectedValueOnce(new Error('Default FirebaseApp is not initialized'));
    expect(await pushAnahtari()).toBeNull();
    mockGetPerm.mockResolvedValue({ granted: false, status: 'denied', canAskAgain: false });
    expect(await pushAnahtari()).toBeNull();
  });

  it('dokunma: yalnız {kind, id} metinleri; oyun öndeyken bildirim gösterilmez; aynı bildirim iki kez verilmez', async () => {
    expect(dokunusVerisi({ kind: 'dm', id: 'p123' })).toEqual({ kind: 'dm', id: 'p123' });
    expect(dokunusVerisi({ kind: 'odul' })).toEqual({ kind: 'odul', id: '' });
    expect(dokunusVerisi({ kind: '<script>' })).toBeNull();
    expect(dokunusVerisi(null)).toBeNull();
    const got: unknown[] = [];
    mockLastResp.mockResolvedValueOnce(yanit({ kind: 'takim', id: 't1' }, 'soguk') as never);
    const stop = installNotifications((d) => got.push(d));
    await new Promise((r) => setTimeout(r, 0));
    const h = mockHandler.mock.calls[0]![0] as { handleNotification: () => Promise<Record<string, boolean>> };
    expect(await h.handleNotification()).toEqual({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false });
    mockRespListener!(yanit({ kind: 'dm', id: 'p9' }, 'n2'));
    mockRespListener!(yanit({ kind: 'dm', id: 'p9' }, 'n2'));
    mockRespListener!({ ...yanit({ kind: 'dm', id: 'p9' }, 'n3'), actionIdentifier: 'baska' });
    expect(got).toEqual([{ kind: 'takim', id: 't1' }, { kind: 'dm', id: 'p9' }]);
    stop();
    expect(mockRespListener).toBeNull();
  });
});
