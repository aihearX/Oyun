/* 1.1.0 cihaz köprüleri: ses oturumu, mağaza bağlantısı, profil fotoğrafı, açılış başına bir kez bayrağı (src/cihaz.ts) */
const mockSetAudioMode = jest.fn(async (_m: Record<string, unknown>) => undefined);
jest.mock('expo-audio', () => ({ setAudioModeAsync: (m: Record<string, unknown>) => mockSetAudioMode(m) }));
const mockLaunchLibrary = jest.fn();
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: (o: unknown) => mockLaunchLibrary(o) }));
const mockOpenURL = jest.fn(async (_u: string) => true);
jest.mock('expo-linking', () => ({ openURL: (u: string) => mockOpenURL(u) }));

import { _resetLaunchFlags, configureAudioSession, onceThisLaunch, openUrl, pickPhoto } from '../src/cihaz';

describe('cihaz köprüleri', () => {
  it('ses oturumu: medya oynatımı, sessiz anahtarında da çalar, diğer uygulamalarla karışır, arka plan ve kayıt yok', async () => {
    expect(await configureAudioSession()).toBe(true);
    expect(mockSetAudioMode).toHaveBeenCalledWith({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'mixWithOthers', allowsRecording: false });
    mockSetAudioMode.mockRejectedValueOnce(new Error('yok'));
    expect(await configureAudioSession()).toBe(false); // hata yutulur
  });

  it('dış bağlantı: yalnız https', () => {
    openUrl('https://apps.apple.com/tr/app/id6836512265');
    openUrl('javascript:alert(1)');
    expect(mockOpenURL).toHaveBeenCalledTimes(1);
    expect(mockOpenURL).toHaveBeenCalledWith('https://apps.apple.com/tr/app/id6836512265');
  });

  it('profil fotoğrafı: kare kırpılmış JPEG data URL, vazgeçince null', async () => {
    mockLaunchLibrary.mockResolvedValueOnce({ canceled: false, assets: [{ base64: 'QUJD' }] });
    expect(await pickPhoto()).toBe('data:image/jpeg;base64,QUJD');
    expect(mockLaunchLibrary).toHaveBeenCalledWith(expect.objectContaining({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true }));
    mockLaunchLibrary.mockResolvedValueOnce({ canceled: true, assets: null });
    expect(await pickPhoto()).toBeNull();
    mockLaunchLibrary.mockRejectedValueOnce(new Error('izin'));
    expect(await pickPhoto()).toBeNull();
  });

  it('açılış başına bir kez: anahtar başına ilk çağrı true', async () => {
    _resetLaunchFlags();
    expect(await onceThisLaunch('guncelleme')).toBe(true);
    expect(await onceThisLaunch('guncelleme')).toBe(false);
    expect(await onceThisLaunch('ses-uyarisi')).toBe(true);
  });
});
