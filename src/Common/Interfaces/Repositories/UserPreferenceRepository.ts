export interface UserPreferenceRepository {
  getPreferences(
    userId: string,
  ): Promise<Array<{ userId: string; channel: string; isEnabled: boolean }>>;
  upsertPreference(
    userId: string,
    channel: string,
    isEnabled: boolean,
  ): Promise<{ userId: string; channel: string; isEnabled: boolean }>;
}

export const USER_PREFERENCE_REPOSITORY = Symbol('USER_PREFERENCE_REPOSITORY');
