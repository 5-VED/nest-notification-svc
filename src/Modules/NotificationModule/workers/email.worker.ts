import { Injectable, Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import * as nodemailer from 'nodemailer';
import { NotificationService } from '../notification.service';
import { NotificationStatus } from '../../../Common/Types/notification.types';
import { ChannelService } from '../services/channel.service';

@Processor('email-queue')
export class EmailWorker {
  private readonly logger = new Logger(EmailWorker.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly channelService: ChannelService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      pool: true,
      maxConnections: 10,
      maxMessages: 100,
    });
  }

  @Process()
  async sendEmail(job: Job) {
    const { notificationId, userId, title, message, metadata } = job.data;

    try {
      // Update status to processing
      await this.notificationService.updateNotificationStatus(
        notificationId,
        NotificationStatus.PROCESSING,
      );

      // Get user email
      const email = await this.channelService.getUserEmail(userId);
      if (!email) {
        throw new Error(`No email found for user ${userId}`);
      }

      // Get template if available
      const template = await this.channelService.getNotificationTemplate(
        'EMAIL',
        'EMAIL',
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
        finalMessage = rendered.htmlContent || rendered.message;
      }

      // Send email
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@notification.com',
        to: email,
        subject: finalTitle,
        html: finalMessage,
      });

      // Update status to sent
      await this.notificationService.updateNotificationStatus(
        notificationId,
        NotificationStatus.SENT,
      );

      this.logger.log(
        `Email sent to ${email} for notification ${notificationId}`,
      );
      return { success: true };
    } catch (error) {
      this.logger.error(
        `Email failed for notification ${notificationId}:`,
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
