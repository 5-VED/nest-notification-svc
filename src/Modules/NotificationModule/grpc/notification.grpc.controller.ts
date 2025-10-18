import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod, GrpcStreamMethod } from '@nestjs/microservices';
import { Observable, Subject } from 'rxjs';
import { NotificationService } from '../notification.service';
import { ChannelService } from '../services/channel.service';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

export interface SendNotificationRequest {
  userId: string;
  type: string;
  title: string;
  message: string;
  channel?: string;
  priority?: string;
  scheduledAt?: string;
  metadata?: { [key: string]: string };
}

export interface SendNotificationResponse {
  success: boolean;
  notificationId: string;
  message: string;
}

export interface SendBulkNotificationsRequest {
  notifications: SendNotificationRequest[];
}

export interface SendBulkNotificationsResponse {
  success: boolean;
  notificationIds: string[];
  successCount: number;
  failureCount: number;
}

export interface GetNotificationStatusRequest {
  notificationId: string;
}

export interface GetNotificationStatusResponse {
  status: string;
  sentAt?: string;
  failedAt?: string;
  errorMessage?: string;
}

export interface UpdateUserPreferencesRequest {
  userId: string;
  channel: string;
  enabled: boolean;
}

export interface UpdateUserPreferencesResponse {
  success: boolean;
  message: string;
}

export interface HealthCheckRequest {
  service: string;
}

export interface HealthCheckResponse {
  status: number;
  timestamp: number;
  queueDepth: number;
  activeWorkers: number;
  throughputPerSecond: number;
}

@Controller()
export class NotificationGrpcController {
  private readonly logger = new Logger(NotificationGrpcController.name);
  private performanceMetrics = {
    totalProcessed: 0,
    startTime: Date.now(),
    lastReset: Date.now(),
  };

  constructor(
    private readonly notificationService: NotificationService,
    private readonly channelService: ChannelService,
    @InjectQueue('email-queue') private emailQueue: Queue,
    @InjectQueue('push-queue') private pushQueue: Queue,
    @InjectQueue('sms-queue') private smsQueue: Queue,
  ) {}

  @GrpcMethod('NotificationService', 'SendNotification')
  async sendNotification(data: SendNotificationRequest): Promise<SendNotificationResponse> {
    try {
      const notification = await this.notificationService.sendNotification({
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        channel: data.channel,
        priority: data.priority,
        metadata: data.metadata,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      });

      return {
        success: true,
        notificationId: notification.id,
        message: 'Notification queued successfully',
      };
    } catch (error) {
      return {
        success: false,
        notificationId: '',
        message: error.message || 'Failed to send notification',
      };
    }
  }

  @GrpcMethod('NotificationService', 'SendBulkNotifications')
  async sendBulkNotifications(data: SendBulkNotificationsRequest): Promise<SendBulkNotificationsResponse> {
    const results = await Promise.allSettled(
      data.notifications.map(notification => 
        this.notificationService.sendNotification({
          userId: notification.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          channel: notification.channel,
          priority: notification.priority,
          metadata: notification.metadata,
          scheduledAt: notification.scheduledAt ? new Date(notification.scheduledAt) : undefined,
        })
      )
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failureCount = results.filter(r => r.status === 'rejected').length;
    const notificationIds = results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<any>).value.id);

    return {
      success: failureCount === 0,
      notificationIds,
      successCount,
      failureCount,
    };
  }

  @GrpcMethod('NotificationService', 'GetNotificationStatus')
  async getNotificationStatus(data: GetNotificationStatusRequest): Promise<GetNotificationStatusResponse> {
    try {
      // This would need to be implemented in the notification service
      // For now, returning a placeholder
      return {
        status: 'PENDING',
        sentAt: '',
        failedAt: '',
        errorMessage: '',
      };
    } catch (error) {
      return {
        status: 'ERROR',
        errorMessage: error.message || 'Failed to get notification status',
      };
    }
  }

  @GrpcMethod('NotificationService', 'UpdateUserPreferences')
  async updateUserPreferences(data: UpdateUserPreferencesRequest): Promise<UpdateUserPreferencesResponse> {
    try {
      await this.channelService.updateUserPreferences(
        data.userId,
        data.channel,
        data.enabled
      );

      return {
        success: true,
        message: 'User preferences updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to update user preferences',
      };
    }
  }

  // High-performance streaming for real-time processing
  @GrpcStreamMethod('NotificationService', 'SendNotificationStream')
  sendNotificationStream(data$: Observable<SendNotificationRequest>): Observable<SendNotificationResponse> {
    const subject = new Subject<SendNotificationResponse>();
    let processedCount = 0;
    const startTime = Date.now();

    data$.subscribe({
      next: async (notification) => {
        try {
          // Process without waiting for database write (fire and forget)
          const result = await this.notificationService.sendNotification({
            userId: notification.userId,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            channel: notification.channel,
            priority: notification.priority,
            metadata: notification.metadata,
            scheduledAt: notification.scheduledAt ? new Date(notification.scheduledAt) : undefined,
          });
          
          processedCount++;
          this.performanceMetrics.totalProcessed++;

          subject.next({
            success: true,
            notificationId: result.id,
            message: 'Notification queued successfully',
          });
        } catch (error) {
          subject.next({
            success: false,
            notificationId: '',
            message: error.message || 'Failed to queue notification',
          });
        }
      },
      complete: () => {
        const processingTime = Date.now() - startTime;
        this.logger.log(`Stream processed ${processedCount} notifications in ${processingTime}ms`);
        subject.complete();
      },
      error: (error) => {
        this.logger.error('Stream error:', error);
        subject.error(error);
      },
    });

    return subject.asObservable();
  }

  // Optimized bulk processing with performance metrics
  @GrpcMethod('NotificationService', 'SendBulkNotificationsOptimized')
  async sendBulkNotificationsOptimized(data: SendBulkNotificationsRequest): Promise<SendBulkNotificationsResponse> {
    const startTime = Date.now();
    const batchSize = 50; // Process in smaller batches for better performance
    const results: any[] = [];
    
    try {
      // Process in parallel batches
      for (let i = 0; i < data.notifications.length; i += batchSize) {
        const batch = data.notifications.slice(i, i + batchSize);
        const batchPromises = batch.map(notification => 
          this.notificationService.sendNotification({
            userId: notification.userId,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            channel: notification.channel,
            priority: notification.priority,
            metadata: notification.metadata,
            scheduledAt: notification.scheduledAt ? new Date(notification.scheduledAt) : undefined,
          }).catch(error => ({ error: error.message, notification }))
        );
        
        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults);
      }

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      const notificationIds = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<any>).value.id);

      const processingTime = Date.now() - startTime;
      const throughput = Math.round((data.notifications.length / processingTime) * 1000);

      this.logger.log(`Bulk processing: ${data.notifications.length} notifications in ${processingTime}ms (${throughput}/sec)`);

      return {
        success: failureCount === 0,
        notificationIds,
        successCount,
        failureCount,
      };
    } catch (error) {
      this.logger.error('Bulk processing error:', error);
      return {
        success: false,
        notificationIds: [],
        successCount: 0,
        failureCount: data.notifications.length,
      };
    }
  }

  // Health check with performance metrics
  @GrpcMethod('NotificationService', 'HealthCheck')
  async healthCheck(data: HealthCheckRequest): Promise<HealthCheckResponse> {
    try {
      // Get queue metrics
      const emailWaiting = await this.emailQueue.getWaiting();
      const pushWaiting = await this.pushQueue.getWaiting();
      const smsWaiting = await this.smsQueue.getWaiting();
      const totalQueueDepth = emailWaiting.length + pushWaiting.length + smsWaiting.length;

      // Get active workers
      const emailActive = await this.emailQueue.getActive();
      const pushActive = await this.pushQueue.getActive();
      const smsActive = await this.smsQueue.getActive();
      const totalActiveWorkers = emailActive.length + pushActive.length + smsActive.length;

      // Calculate throughput
      const now = Date.now();
      const timeSinceReset = now - this.performanceMetrics.lastReset;
      const throughput = timeSinceReset > 0 
        ? (this.performanceMetrics.totalProcessed / timeSinceReset) * 1000 
        : 0;

      // Reset metrics every minute
      if (timeSinceReset > 60000) {
        this.performanceMetrics.totalProcessed = 0;
        this.performanceMetrics.lastReset = now;
      }

      return {
        status: 1, // SERVING
        timestamp: now,
        queueDepth: totalQueueDepth,
        activeWorkers: totalActiveWorkers,
        throughputPerSecond: Math.round(throughput),
      };
    } catch (error) {
      this.logger.error('Health check error:', error);
      return {
        status: 2, // NOT_SERVING
        timestamp: Date.now(),
        queueDepth: 0,
        activeWorkers: 0,
        throughputPerSecond: 0,
      };
    }
  }
}
