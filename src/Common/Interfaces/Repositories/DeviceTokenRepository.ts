export interface DeviceTokenRepository {
  getActiveTokens(userId: string): Promise<string[]>;
  upsertToken(userId: string, token: string, platform: string): Promise<{ userId: string; token: string; platform: string; isActive: boolean }>;
  deactivateToken(userId: string, token: string): Promise<void>;
}

export const DEVICE_TOKEN_REPOSITORY = Symbol('DEVICE_TOKEN_REPOSITORY');
