import { HOVERBOARD, UPGRADE_PRICES } from '@/config/tuning';

/** Cosmetic only — no pay-to-win stats (SPEC 10.4). Coins only, no real money. */

export interface CharacterDef {
  id: string;
  name: string;
  price: number; // 0 = starter
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  shoes: string;
  accessory: 'none' | 'cap' | 'ponytail' | 'headband' | 'glasses' | 'bun' | 'turban' | 'helmet';
}

export const CHARACTERS: CharacterDef[] = [
  { id: 'aarav', name: 'Aarav', price: 0, skin: '#c68b59', hair: '#1f1a17', shirt: '#f26b1d', pants: '#1e3a8a', shoes: '#f8fafc', accessory: 'cap' },
  { id: 'meera', name: 'Meera', price: 0, skin: '#b97a4f', hair: '#2a1d16', shirt: '#7c3aed', pants: '#0f766e', shoes: '#fde047', accessory: 'ponytail' },
  { id: 'leo', name: 'Leo', price: 0, skin: '#f1c7a5', hair: '#b45309', shirt: '#16a34a', pants: '#334155', shoes: '#ef4444', accessory: 'headband' },
  { id: 'zoe', name: 'Zoe', price: 0, skin: '#8d5a3b', hair: '#111827', shirt: '#0ea5e9', pants: '#be185d', shoes: '#f8fafc', accessory: 'bun' },
  { id: 'kabir', name: 'Kabir', price: 2000, skin: '#c08457', hair: '#111827', shirt: '#dc2626', pants: '#111827', shoes: '#22c55e', accessory: 'turban' },
  { id: 'isha', name: 'Isha', price: 4000, skin: '#d4a07a', hair: '#3f2a1d', shirt: '#facc15', pants: '#4338ca', shoes: '#ec4899', accessory: 'glasses' },
  { id: 'sam', name: 'Sam', price: 7000, skin: '#e8b98f', hair: '#78350f', shirt: '#14b8a6', pants: '#7c2d12', shoes: '#f97316', accessory: 'helmet' },
  { id: 'nia', name: 'Nia', price: 12000, skin: '#6b4226', hair: '#0b0b0b', shirt: '#e11d48', pants: '#f8fafc', shoes: '#a855f7', accessory: 'ponytail' },
];

export interface CosmeticDef {
  id: string;
  name: string;
  price: number;
  color: string;
}

export const SHOES: CosmeticDef[] = [
  { id: 'trail-none', name: 'No trail', price: 0, color: 'transparent' },
  { id: 'trail-sky', name: 'Sky trail', price: 500, color: '#38bdf8' },
  { id: 'trail-fire', name: 'Fire trail', price: 1000, color: '#f97316' },
  { id: 'trail-rainbow', name: 'Magic trail', price: 2000, color: '#d946ef' },
];

export const BOARDS: CosmeticDef[] = [
  { id: 'board-classic', name: 'Classic board', price: 0, color: '#f26b1d' },
  { id: 'board-ocean', name: 'Ocean board', price: 1500, color: '#0ea5e9' },
  { id: 'board-lime', name: 'Lime board', price: 3000, color: '#84cc16' },
  { id: 'board-galaxy', name: 'Galaxy board', price: 6000, color: '#6d28d9' },
];

export const HOVERBOARD_PRICE = HOVERBOARD.price;
export const upgradePrice = (level: number) => (level >= 5 ? Infinity : UPGRADE_PRICES[level]);

export const STARTER_OWNED = [...CHARACTERS.filter((c) => c.price === 0).map((c) => c.id), 'trail-none', 'board-classic'];

export function characterById(id: string): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}
