import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel, NotificationPriority, NotificationStatus, NotificationType, SendNotificationData } from '../../Common/Types/notification.types';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { ChannelService } from './services/channel.service';

export interface KafkaEvent {
  topic: string;
  partition: number;
  offset: string;
  timestamp: string;
  data: any;
}

export type NotificationData = SendNotificationData;

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly channelService: ChannelService,
    @InjectQueue('email-queue') private emailQueue: Queue,
    @InjectQueue('push-queue') private pushQueue: Queue,
    @InjectQueue('sms-queue') private smsQueue: Queue,
  ) {}

  async processEvent(event: KafkaEvent) {
    try {
      this.logger.log(`Processing event from ${event.topic}`, event.data);

      // Route events based on topic
      switch (event.topic) {
        case 'user.events':
          await this.handleUserEvent(event.data);
          break;
        case 'auth.events':
          await this.handleAuthEvent(event.data);
          break;
        case 'order.events':
          await this.handleOrderEvent(event.data);
          break;
        case 'payment.events':
          await this.handlePaymentEvent(event.data);
          break;
        default:
          this.logger.warn(`Unknown topic: ${event.topic}`);
      }
    } catch (error) {
      this.logger.error(`Error processing event from ${event.topic}:`, error);
      throw error;
    }
  }

  async sendNotification(notificationData: NotificationData) {
    try {
      // Create notification record
      const notification = await this.prisma.notification.create({
        data: {
          userId: notificationData.userId,
          title: notificationData.title,
          message: notificationData.message,
          type: (notificationData.type as NotificationType) as any,
          channel: ((notificationData.channel || NotificationChannel.EMAIL) as NotificationChannel) as any,
          priority: ((notificationData.priority || NotificationPriority.NORMAL) as NotificationPriority) as any,
          metadata: notificationData.metadata,
          scheduledAt: notificationData.scheduledAt,
        },
      });

      // Get user preferences
      const userPreferences = await this.getUserPreferences(notificationData.userId);
      
      // Determine channels to send to
      const channels = this.determineChannels(notificationData, userPreferences);

      // Queue jobs for each channel
      const jobs: Promise<any>[] = [];
      for (const channel of channels) {
        const jobData = {
          notificationId: notification.id,
          userId: notificationData.userId,
          title: notificationData.title,
          message: notificationData.message,
          metadata: notificationData.metadata,
        };

        switch (channel) {
          case NotificationChannel.EMAIL:
            jobs.push(this.emailQueue.add('send-email', jobData, {
              priority: this.getPriority(notificationData.priority),
              delay: notificationData.scheduledAt ? 
                new Date(notificationData.scheduledAt).getTime() - Date.now() : 0,
            }));
            break;
          case NotificationChannel.PUSH:
            jobs.push(this.pushQueue.add('send-push', jobData, {
              priority: this.getPriority(notificationData.priority),
              delay: notificationData.scheduledAt ? 
                new Date(notificationData.scheduledAt).getTime() - Date.now() : 0,
            }));
            break;
          case NotificationChannel.SMS:
            jobs.push(this.smsQueue.add('send-sms', jobData, {
              priority: this.getPriority(notificationData.priority),
              delay: notificationData.scheduledAt ? 
                new Date(notificationData.scheduledAt).getTime() - Date.now() : 0,
            }));
            break;
        }
      }

      await Promise.all(jobs);
      this.logger.log(`Queued notification ${notification.id} for ${channels.length} channels`);

      return notification;
    } catch (error) {
      this.logger.error('Error sending notification:', error);
      throw error;
    }
  }

  private async handleUserEvent(data: any) {
    switch (data.eventType) {
      case 'USER_REGISTERED':
        await this.sendNotification({
          userId: data.userId,
          type: 'WELCOME',
          title: 'Welcome!',
          message: `Welcome to our platform, ${data.userName}!`,
          channel: 'EMAIL',
        });
        break;
      case 'USER_UPDATED':
        // Handle user update events
        break;
    }
  }

  private async handleAuthEvent(data: any) {
    switch (data.eventType) {
      case 'PASSWORD_RESET_REQUESTED':
        await this.sendNotification({
          userId: data.userId,
          type: 'PASSWORD_RESET',
          title: 'Password Reset',
          message: 'Click the link to reset your password',
          channel: 'EMAIL',
          priority: 'HIGH',
        });
        break;
      case 'EMAIL_VERIFICATION_REQUESTED':
        await this.sendNotification({
          userId: data.userId,
          type: 'EMAIL_VERIFICATION',
          title: 'Verify Your Email',
          message: 'Please verify your email address',
          channel: 'EMAIL',
        });
        break;
    }
  }

  private async handleOrderEvent(data: any) {
    switch (data.eventType) {
      case 'ORDER_CREATED':
        await this.sendNotification({
          userId: data.userId,
          type: 'ORDER_CONFIRMATION',
          title: 'Order Confirmed',
          message: `Your order #${data.orderId} has been confirmed`,
          channel: 'EMAIL',
          metadata: { orderId: data.orderId },
        });
        break;
      case 'ORDER_SHIPPED':
        await this.sendNotification({
          userId: data.userId,
          type: 'ORDER_SHIPPED',
          title: 'Order Shipped',
          message: `Your order #${data.orderId} has been shipped`,
          channel: 'PUSH',
          metadata: { orderId: data.orderId, trackingNumber: data.trackingNumber },
        });
        break;
      case 'ORDER_DELIVERED':
        await this.sendNotification({
          userId: data.userId,
          type: 'ORDER_DELIVERED',
          title: 'Order Delivered',
          message: `Your order #${data.orderId} has been delivered`,
          channel: 'PUSH',
          metadata: { orderId: data.orderId },
        });
        break;
    }
  }

  private async handlePaymentEvent(data: any) {
    switch (data.eventType) {
      case 'PAYMENT_SUCCESS':
        await this.sendNotification({
          userId: data.userId,
          type: 'PAYMENT_SUCCESS',
          title: 'Payment Successful',
          message: `Payment of $${data.amount} was successful`,
          channel: 'EMAIL',
          metadata: { amount: data.amount, transactionId: data.transactionId },
        });
        break;
      case 'PAYMENT_FAILED':
        await this.sendNotification({
          userId: data.userId,
          type: 'PAYMENT_FAILED',
          title: 'Payment Failed',
          message: `Payment of $${data.amount} failed. Please try again.`,
          channel: 'EMAIL',
          priority: 'HIGH',
          metadata: { amount: data.amount, reason: data.reason },
        });
        break;
    }
  }

  private async getUserPreferences(userId: string) {
    return this.prisma.userPreference.findMany({
      where: { userId },
    });
  }

  private determineChannels(notificationData: NotificationData, userPreferences: any[]) {
    const enabledChannels = userPreferences
      .filter(pref => pref.enabled)
      .map(pref => pref.channel);

    if (notificationData.channel) {
      return [notificationData.channel];
    }

    // Default channels based on notification type
    const defaultChannels: Record<string, NotificationChannel[]> = {
      [NotificationType.WELCOME]: [NotificationChannel.EMAIL],
      [NotificationType.ORDER_CONFIRMATION]: [NotificationChannel.EMAIL, NotificationChannel.PUSH],
      [NotificationType.ORDER_SHIPPED]: [NotificationChannel.PUSH, NotificationChannel.SMS],
      [NotificationType.ORDER_DELIVERED]: [NotificationChannel.PUSH],
      [NotificationType.PAYMENT_SUCCESS]: [NotificationChannel.EMAIL],
      [NotificationType.PAYMENT_FAILED]: [NotificationChannel.EMAIL, NotificationChannel.PUSH],
      [NotificationType.PASSWORD_RESET]: [NotificationChannel.EMAIL],
      [NotificationType.EMAIL_VERIFICATION]: [NotificationChannel.EMAIL],
    };

    const typeChannels = defaultChannels[notificationData.type as string] || [NotificationChannel.EMAIL];
    return typeChannels.filter(channel => 
      enabledChannels.length === 0 || enabledChannels.includes(channel)
    );
  }

  private getPriority(priority?: string): number {
    const priorityMap: Record<string, number> = {
      [NotificationPriority.LOW]: 1,
      [NotificationPriority.NORMAL]: 5,
      [NotificationPriority.HIGH]: 10,
      [NotificationPriority.URGENT]: 20,
    };
    return priorityMap[(priority as NotificationPriority) || NotificationPriority.NORMAL] || 5;
  }

  async updateNotificationStatus(notificationId: string, status: string, errorMessage?: string) {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === NotificationStatus.SENT) {
      updateData.sentAt = new Date();
    } else if (status === NotificationStatus.FAILED) {
      updateData.failedAt = new Date();
      updateData.errorMessage = errorMessage;
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: updateData,
    });
  }

  async retryFailedNotifications() {
    const failedNotifications = await this.prisma.notification.findMany({
      where: {
        status: 'FAILED',
        retryCount: { lt: 3 },
      },
      take: 100,
    });

    for (const notification of failedNotifications) {
      await this.sendNotification({
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        channel: notification.channel,
        priority: notification.priority,
        metadata: notification.metadata,
      });

      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { retryCount: notification.retryCount + 1 },
      });
    }
  }
}
