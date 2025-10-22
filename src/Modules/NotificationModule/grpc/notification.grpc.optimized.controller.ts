import { Controller } from '@nestjs/common';
import { GrpcMethod, GrpcStreamMethod } from '@nestjs/microservices';
import { Observable, Subject } from 'rxjs';
import { NotificationService } from '../notification.service';

@Controller()
export class NotificationGrpcOptimizedController {
  constructor(private readonly notificationService: NotificationService) {}

  // Stream processing for maximum throughput
  @GrpcStreamMethod('NotificationService', 'SendNotificationStream')
  sendNotificationStream(data$: Observable<any>): Observable<any> {
    const subject = new Subject();

    data$.subscribe({
      next: async (notification) => {
        try {
          // Process without waiting for database write
          const result = await this.notificationService.sendNotification({
            userId: notification.userId,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            channel: notification.channel,
            priority: notification.priority,
            metadata: notification.metadata,
          });

          subject.next({
            success: true,
            notificationId: result.id,
            requestId: notification.requestId, // For correlation
          });
        } catch (error) {
          subject.next({
            success: false,
            error: error.message,
            requestId: notification.requestId,
          });
        }
      },
      complete: () => subject.complete(),
    });

    return subject.asObservable();
  }

  // Batch processing for maximum efficiency
  @GrpcMethod('NotificationService', 'SendBulkNotificationsOptimized')
  async sendBulkNotificationsOptimized(data: any): Promise<any> {
    const startTime = Date.now();

    // Process in parallel batches
    const batchSize = 100;
    const batches: any[] = [];

    for (let i = 0; i < data.notifications.length; i += batchSize) {
      const batch = data.notifications.slice(i, i + batchSize);
      batches.push(this.processBatch(batch));
    }

    const results = await Promise.allSettled(batches);
    const processingTime = Date.now() - startTime;

    return {
      success: true,
      totalProcessed: data.notifications.length,
      processingTimeMs: processingTime,
      throughputPerSecond: Math.round(
        (data.notifications.length / processingTime) * 1000,
      ),
    };
  }

  private async processBatch(notifications: any[]) {
    // Process batch in parallel
    return Promise.allSettled(
      notifications.map((notification) =>
        this.notificationService.sendNotification({
          userId: notification.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          channel: notification.channel,
          priority: notification.priority,
          metadata: notification.metadata,
        }),
      ),
    );
  }
}
