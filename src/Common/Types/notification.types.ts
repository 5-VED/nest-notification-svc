export enum NotificationType {
  WELCOME = 'WELCOME',
  PASSWORD_RESET = 'PASSWORD_RESET',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  ORDER_CONFIRMATION = 'ORDER_CONFIRMATION',
  ORDER_SHIPPED = 'ORDER_SHIPPED',
  ORDER_DELIVERED = 'ORDER_DELIVERED',
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  PUSH = 'PUSH',
  SMS = 'SMS',
}

export enum NotificationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum NotificationStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export interface NotificationEntity {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  channel: NotificationChannel;
  priority: NotificationPriority;
  metadata?: Record<string, unknown> | null;
  scheduledAt?: Date | null;
  status: NotificationStatus;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date | null;
  failedAt?: Date | null;
  errorMessage?: string | null;
}

export interface UserPreferenceEntity {
  userId: string;
  channel: NotificationChannel;
  isEnabled: boolean;
}

export interface DeviceTokenEntity {
  userId: string;
  token: string;
  platform: string;
  isActive: boolean;
}

export interface NotificationTemplateEntity {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  message: string;
  htmlContent?: string | null;
  isActive: boolean;
}

export interface SendNotificationData {
  userId: string;
  type: NotificationType | string;
  title: string;
  message: string;
  channel?: NotificationChannel | string;
  priority?: NotificationPriority | string;
  metadata?: Record<string, unknown>;
  scheduledAt?: Date;
}
