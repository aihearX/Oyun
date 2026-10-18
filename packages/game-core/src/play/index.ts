/** Oynanış motoru (Phaser'sız çekirdek + görsel seam'ler). */
export * as consts from './consts';
export { buildWorld, near, type World, type WEnt } from './world';
export { initState, step, cloneState, NO_INPUT, type SimInput, type SimState, type SimEvent, type HeroS } from './sim';
export { Planner, simulatePlan, type Action } from './planner';
export * from './visuals';
