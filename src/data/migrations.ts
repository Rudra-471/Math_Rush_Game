import type { Profile } from './db';

/** Every saved profile carries a schema version; old data is upgraded on load. */
export const CURRENT_SCHEMA = 1;

export function migrateProfile(p: Profile): Profile {
  let out = { ...p };
  if (!out.schema || out.schema < 1) {
    out = {
      ...out,
      focusTopics: out.focusTopics ?? [],
      dailyLimitMin: out.dailyLimitMin ?? 0,
      dailyStreak: out.dailyStreak ?? { lastDate: '', count: 0 },
      schema: 1,
    };
  }
  return out;
}
