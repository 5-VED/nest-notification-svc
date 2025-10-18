export interface NotificationRepository {
  create(data: any): Promise<any>;
  updateStatus(id: string, status: string, errorMessage?: string): Promise<any>;
  findFailed(limit: number, maxRetries: number): Promise<any[]>;
  incrementRetry(id: string): Promise<void>;
}

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');
