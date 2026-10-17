import { describe, expect, it } from 'vitest';
import { ALL_CHUNKS, validateChunks } from './chunks';

describe('parça kütüphanesi', () => {
  it('şemaya uyar', () => { expect(validateChunks(ALL_CHUNKS)).toEqual([]); });
  it('koşu parçaları yeterli', () => { expect(ALL_CHUNKS.filter((c) => c.mechanic === 'kosu').length).toBeGreaterThanOrEqual(12); });
});
