/** Hand-authored 40 m chunk patterns (SPEC 6.5). z is metres from the chunk start. */

export type PatternObject =
  | { type: 'low' | 'high'; lane: number; z: number }
  | { type: 'train'; lane: number; z: number; cars: number }
  | { type: 'rampTrain'; lane: number; z: number; cars: number }
  | { type: 'movingTrain'; lane: number; z: number; cars: number }
  | { type: 'coinLine'; lane: number; z: number; count: number; arc?: 'flat' | 'over' | 'roof' };

export interface Pattern {
  id: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  tags: string[];
  length: number;
  objects: PatternObject[];
}

const P = (id: string, difficulty: Pattern['difficulty'], tags: string[], objects: PatternObject[]): Pattern => ({
  id, difficulty, tags, length: 40, objects,
});

export const PATTERNS: Pattern[] = [
  P('calm_coins', 1, ['calm'], [{ type: 'coinLine', lane: 1, z: 6, count: 10 }]),
  P('calm_side_coins', 1, ['calm'], [
    { type: 'coinLine', lane: 0, z: 6, count: 6 },
    { type: 'coinLine', lane: 2, z: 22, count: 6 },
  ]),
  P('low_single', 1, ['barrier'], [
    { type: 'low', lane: 1, z: 18 },
    { type: 'coinLine', lane: 1, z: 15, count: 6, arc: 'over' },
    { type: 'coinLine', lane: 0, z: 8, count: 6 },
  ]),
  P('high_single', 1, ['barrier'], [
    { type: 'high', lane: 0, z: 14 },
    { type: 'low', lane: 2, z: 26 },
    { type: 'coinLine', lane: 1, z: 6, count: 10 },
  ]),
  P('barrier_row_jump', 2, ['barrier'], [
    { type: 'low', lane: 0, z: 20 },
    { type: 'low', lane: 1, z: 20 },
    { type: 'low', lane: 2, z: 20 },
    { type: 'coinLine', lane: 1, z: 17, count: 6, arc: 'over' },
  ]),
  P('barrier_row_slide', 2, ['barrier'], [
    { type: 'high', lane: 0, z: 20 },
    { type: 'high', lane: 1, z: 20 },
    { type: 'high', lane: 2, z: 20 },
    { type: 'coinLine', lane: 1, z: 8, count: 8 },
  ]),
  P('train_left', 2, ['trains'], [
    { type: 'train', lane: 0, z: 6, cars: 3 },
    { type: 'coinLine', lane: 1, z: 6, count: 10 },
  ]),
  P('train_right_low', 2, ['trains'], [
    { type: 'train', lane: 2, z: 8, cars: 2 },
    { type: 'low', lane: 1, z: 22 },
    { type: 'coinLine', lane: 0, z: 10, count: 8 },
  ]),
  P('train_pair', 3, ['trains'], [
    { type: 'train', lane: 0, z: 6, cars: 3 },
    { type: 'train', lane: 2, z: 6, cars: 3 },
    { type: 'coinLine', lane: 1, z: 6, count: 12 },
    { type: 'low', lane: 1, z: 28 },
  ]),
  P('ramp_mid', 3, ['trains', 'ramp'], [
    { type: 'rampTrain', lane: 1, z: 5, cars: 3 },
    { type: 'train', lane: 0, z: 9, cars: 3 },
    { type: 'coinLine', lane: 1, z: 12, count: 10, arc: 'roof' },
  ]),
  P('zigzag', 3, ['trains'], [
    { type: 'train', lane: 0, z: 5, cars: 1 },
    { type: 'train', lane: 2, z: 19, cars: 1 },
    { type: 'low', lane: 1, z: 31 },
    { type: 'coinLine', lane: 1, z: 5, count: 8 },
  ]),
  P('mixed_rows', 3, ['barrier', 'trains'], [
    { type: 'low', lane: 0, z: 9 },
    { type: 'high', lane: 1, z: 9 },
    { type: 'low', lane: 2, z: 9 },
    { type: 'train', lane: 1, z: 20, cars: 2 },
    { type: 'coinLine', lane: 0, z: 18, count: 6 },
  ]),
  P('moving_right', 4, ['trains', 'moving'], [
    { type: 'movingTrain', lane: 2, z: 14, cars: 2 },
    { type: 'coinLine', lane: 0, z: 6, count: 10 },
    { type: 'high', lane: 1, z: 24 },
  ]),
  P('moving_center', 4, ['trains', 'moving'], [
    { type: 'movingTrain', lane: 1, z: 12, cars: 2 },
    { type: 'coinLine', lane: 0, z: 8, count: 6 },
    { type: 'coinLine', lane: 2, z: 20, count: 6 },
  ]),
  P('double_ramp', 4, ['trains', 'ramp'], [
    { type: 'rampTrain', lane: 0, z: 4, cars: 3 },
    { type: 'train', lane: 1, z: 7, cars: 3 },
    { type: 'high', lane: 2, z: 20 },
    { type: 'coinLine', lane: 0, z: 11, count: 10, arc: 'roof' },
  ]),
  P('gauntlet', 5, ['trains', 'barrier', 'moving'], [
    { type: 'train', lane: 0, z: 4, cars: 4 },
    { type: 'low', lane: 1, z: 12 },
    { type: 'high', lane: 1, z: 24 },
    { type: 'movingTrain', lane: 2, z: 16, cars: 2 },
    { type: 'coinLine', lane: 1, z: 6, count: 10 },
  ]),
];

/** Minimum distance (m) at which obstacle families appear (SPEC 9.2). */
export const INTRO_AT: Record<string, number> = { trains: 100, moving: 400, ramp: 100 };

/** Track footprint of an object (start..end), used by the spawner and the fairness validator. */
export function footprint(o: PatternObject, carLen: number, rampLen: number, depth: number): [number, number] {
  switch (o.type) {
    case 'low':
    case 'high':
      return [o.z, o.z + depth];
    case 'train':
    case 'movingTrain':
      return [o.z, o.z + o.cars * carLen];
    case 'rampTrain':
      return [o.z, o.z + rampLen + o.cars * carLen];
    case 'coinLine':
      return [o.z, o.z];
  }
}
