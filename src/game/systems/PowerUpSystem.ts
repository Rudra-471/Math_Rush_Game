import { HOVERBOARD, POWERUPS, type PowerUpType } from '@/config/tuning';
import { bus } from '@/events/bus';
import type { Runtime } from '../runtime';

export function powerUpDuration(rt: Runtime, type: PowerUpType): number {
  const lvl = rt.upgradeLevels[type] ?? 0;
  return POWERUPS[type].base + POWERUPS[type].perLevel * lvl;
}

export function activatePowerUp(rt: Runtime, type: PowerUpType) {
  const total = powerUpDuration(rt, type);
  const existing = rt.powerups.find((p) => p.type === type);
  if (existing) {
    existing.remaining = total;
    existing.total = total;
  } else {
    rt.powerups.push({ type, remaining: total, total });
  }
  if (type === 'shield') rt.shieldArmed = true;
  bus.emit('POWERUP', { type, on: true });
}

export function activateHoverboard(rt: Runtime): boolean {
  if (rt.hoverboardUsed || rt.hoverboard > 0) return false;
  rt.hoverboard = HOVERBOARD.duration;
  rt.hoverboardUsed = true;
  bus.emit('POWERUP', { type: 'hoverboard', on: true });
  return true;
}

export function powerUpUpdate(rt: Runtime, dt: number) {
  for (const p of rt.powerups) p.remaining -= dt;
  const expired = rt.powerups.filter((p) => p.remaining <= 0);
  if (expired.length) {
    rt.powerups = rt.powerups.filter((p) => p.remaining > 0);
    for (const p of expired) {
      if (p.type === 'shield') rt.shieldArmed = false;
      bus.emit('POWERUP', { type: p.type, on: false });
    }
  }
  if (rt.hoverboard > 0) {
    rt.hoverboard -= dt;
    if (rt.hoverboard <= 0) {
      rt.hoverboard = 0;
      bus.emit('POWERUP', { type: 'hoverboard', on: false });
    }
  }
}
