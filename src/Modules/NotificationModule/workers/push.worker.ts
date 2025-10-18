import { Injectable, Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import * as admin from 'firebase-admin';
import { NotificationService } from '../notification.service';
import { NotificationStatus } from '../../../Common/Types/notification.types';
import { ChannelService } from '../services/channel.service';

@Processor('push-queue')
export class PushWorker {
  private readonly logger = new Logger(PushWorker.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly channelService: ChannelService,
  ) {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(require(process.env.FIREBASE_CONFIG || './firebase-key.json')),
      });
    }
  }

  @Process()
  async sendPush(job: Job) {
    const { notificationId, userId, message, title, metadata } = job.data;

    try {
      // Update status to processing
      await this.notificationService.updateNotificationStatus(notificationId, NotificationStatus.PROCESSING);

      // Get device tokens
      const deviceTokens = await this.channelService.getDeviceTokens(userId);
      if (!deviceTokens.length) {
        throw new Error(`No device tokens found for user ${userId}`);
      }

      // Get template if available
      const template = await this.channelService.getNotificationTemplate('PUSH', 'PUSH');
      let finalTitle = title;
      let finalMessage = message;

      if (template) {
        const rendered = await this.channelService.renderTemplate(template, {
          title,
          message,
          ...metadata,
        });
        finalTitle = rendered.title;
        finalMessage = rendered.message;
      }

      // Send to all device tokens
      const promises = deviceTokens.map(token =>
        admin.messaging().send({
          notification: {
            title: finalTitle,
            body: finalMessage
          },
          data: metadata || {},
          token,
        })
      );

      const responses = await Promise.all(promises);

      // Update status to sent
      await this.notificationService.updateNotificationStatus(notificationId, NotificationStatus.SENT);

      this.logger.log(`Push sent for ${userId} to ${deviceTokens.length} devices:`, responses);
      return { success: true };
    } catch (error) {
      this.logger.error(`Push failed for notification ${notificationId}:`, error);

      // Update status to failed
      await this.notificationService.updateNotificationStatus(notificationId, NotificationStatus.FAILED, error.message);

      throw error;
    }
  }
}