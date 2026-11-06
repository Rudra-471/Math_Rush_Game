import { WORLD } from '@/config/tuning';

export type FacadeKind = 'brick' | 'office' | 'concrete' | 'sandstone' | 'shop';

export interface Biome {
  name: string;
  fog: string;
  ground: string;
  platform: string;
  facades: FacadeKind[];
  tints: string[]; // per-instance building tints (multiplied with facade texture)
  roof: string;
  foliage: string;
  decor: 'tree' | 'dome' | 'pine' | 'neon';
  night: boolean;
  // physically based sky
  sunElevation: number; // degrees
  sunAzimuth: number;
  turbidity: number;
  rayleigh: number;
  exposure: number;
  sunColor: string;
  sunIntensity: number;
  hemiIntensity: number;
}

export const BIOMES: Biome[] = [
  {
    name: 'City Rail', fog: '#c7d6e2', ground: '#7d7a73', platform: '#b2aea6',
    facades: ['brick', 'office', 'concrete', 'shop'], tints: ['#ffffff', '#f2e6da', '#e3e9f0', '#efe4d2'], roof: '#4a4d52',
    foliage: '#3f6b2f', decor: 'tree', night: false,
    sunElevation: 38, sunAzimuth: 150, turbidity: 6, rayleigh: 1.6, exposure: 0.5, sunColor: '#fff4e2', sunIntensity: 3.2, hemiIntensity: 0.55,
  },
  {
    name: 'Heritage Line', fog: '#e9cfae', ground: '#8b7358', platform: '#d4b893',
    facades: ['sandstone', 'sandstone', 'brick', 'shop'], tints: ['#ffffff', '#ffe9cf', '#f7d9bd', '#fff3e0'], roof: '#9d4b35',
    foliage: '#566b2c', decor: 'dome', night: false,
    sunElevation: 16, sunAzimuth: 120, turbidity: 9, rayleigh: 2.6, exposure: 0.46, sunColor: '#ffd6a0', sunIntensity: 3.0, hemiIntensity: 0.5,
  },
  {
    name: 'Snow Pass', fog: '#e4ecf3', ground: '#e9eef3', platform: '#f4f6f8',
    facades: ['concrete', 'brick', 'concrete', 'office'], tints: ['#ffffff', '#e9eef5', '#dfe7f2', '#f4f4f4'], roof: '#f2f5f8',
    foliage: '#2e4a3a', decor: 'pine', night: false,
    sunElevation: 24, sunAzimuth: 200, turbidity: 3, rayleigh: 1.0, exposure: 0.4, sunColor: '#f2f6ff', sunIntensity: 2.6, hemiIntensity: 0.7,
  },
  {
    name: 'Neon Night', fog: '#1a1c33', ground: '#2b2a33', platform: '#3d3c46',
    facades: ['office', 'concrete', 'brick', 'office'], tints: ['#9aa3c7', '#8c86b0', '#a58f9c', '#7f8fb0'], roof: '#22232c',
    foliage: '#1f3326', decor: 'neon', night: true,
    sunElevation: -4, sunAzimuth: 180, turbidity: 2, rayleigh: 0.5, exposure: 0.9, sunColor: '#9fb3ff', sunIntensity: 0.7, hemiIntensity: 0.35,
  },
];

export function biomeIndexAt(distance: number): number {
  return Math.floor(Math.max(0, distance) / WORLD.biomeLength) % BIOMES.length;
}
