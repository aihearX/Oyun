import type { MechanicId } from '@odi/shared';
import type { Mechanic } from './types';
import { kosu } from './kosu';
import { yuzme } from './yuzme';
import { trambolin } from './trambolin';
import { makine } from './makine';
import { impuls } from './impuls';
import { ruya } from './ruya';
import { boss } from './boss';
export * from './types';

const REGISTRY = new Map<MechanicId, Mechanic>([['kosu', kosu], ['yuzme', yuzme], ['trambolin', trambolin], ['makine', makine], ['impuls', impuls], ['ruya', ruya], ['boss', boss]]);
export function registerMechanic(m: Mechanic) { REGISTRY.set(m.id, m); }
export function getMechanic(id: MechanicId): Mechanic | undefined { return REGISTRY.get(id); }
export function registeredMechanics(): MechanicId[] { return [...REGISTRY.keys()]; }
