import type { ObjectiveId, ObjectiveSpec } from '@odi/shared';
export function objective(id: ObjectiveId, target?: number): ObjectiveSpec {
  switch (id) {
    case 'reach': return { id, label: 'Kapıya ulaş' };
    case 'collect-all': return { id, target, label: `Tüm jetonları topla (${target})` };
    case 'timed': return { id, target, label: `${target} saniyede bitir` };
    case 'escort': return { id, label: 'Fısıltıyı sağ salim kapıya götür' };
    case 'boss': return { id, label: 'Canavarı yen' };
    case 'secret': return { id, label: 'Altın kokleayı bul' };
    case 'no-damage': return { id, label: 'Hiç hasar alma' };
    case 'melody': return { id, target, label: `Notaları sırayla topla (${target})` };
  }
}
