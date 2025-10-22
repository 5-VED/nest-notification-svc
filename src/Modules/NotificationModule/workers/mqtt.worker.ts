import { Injectable, Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import * as mqtt from 'mqtt';
import { NotificationService } from '../notification.service';
import { NotificationStatus } from '../../../Common/Types/notification.types';
import { ChannelService } from '../services/channel.service';

@Processor('sms-queue')
export class MqttWorker {
  private readonly logger = new Logger(MqttWorker.name);
  private client: mqtt.MqttClient;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly channelService: ChannelService,
  ) {
    this.client = mqtt.connect(
      process.env.MQTT_BROKER || 'mqtt://localhost:1883',
      {
        clientId: 'notification-service',
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 30 * 1000,
      },
    );

    this.client.on('connect', () => this.logger.log('MQTT connected'));
    this.client.on('error', (err) => this.logger.error('MQTT error:', err));
    this.client.on('reconnect', () => this.logger.log('MQTT reconnecting...'));
  }

  @Process()
  async sendSMS(job: Job) {
    const { notificationId, userId, message, title, metadata } = job.data;

    try {
      // Update status to processing
      await this.notificationService.updateNotificationStatus(
        notificationId,
        NotificationStatus.PROCESSING,
      );

      // Get user phone
      const phone = await this.channelService.getUserPhone(userId);
      if (!phone) {
        throw new Error(`No phone found for user ${userId}`);
      }

      // Get template if available
      const template = await this.channelService.getNotificationTemplate(
        'SMS',
        'SMS',
      );
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

      const payload = JSON.stringify({
        phone,
        message: finalMessage,
        title: finalTitle,
        timestamp: Date.now(),
        notificationId,
      });

      return new Promise((resolve, reject) => {
        this.client.publish(`sms/${phone}`, payload, { qos: 1 }, (err) => {
          if (err) {
            this.logger.error(`SMS failed for ${phone}:`, err);
            reject(err);
          } else {
            this.logger.log(`SMS queued for ${phone}`);
            resolve({ success: true });
          }
        });
      }).then(async () => {
        // Update status to sent
        await this.notificationService.updateNotificationStatus(
          notificationId,
          NotificationStatus.SENT,
        );
        return { success: true };
      });
    } catch (error) {
      this.logger.error(
        `SMS failed for notification ${notificationId}:`,
        error,
      );

      // Update status to failed
      await this.notificationService.updateNotificationStatus(
        notificationId,
        NotificationStatus.FAILED,
        error.message,
      );

      throw error;
    }
  }
}
