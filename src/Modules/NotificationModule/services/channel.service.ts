import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TemplateRenderer } from './template.renderer';
import { NotificationChannel } from '../../../Common/Types/notification.types';

@Injectable()
export class ChannelService {
  private readonly logger = new Logger(ChannelService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly templateRenderer: TemplateRenderer,
  ) {}

  async getUserEmail(userId: string): Promise<string | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      return user?.email || null;
    } catch (error) {
      this.logger.error(`Error fetching email for user ${userId}:`, error);
      return null;
    }
  }

  async getUserPhone(userId: string): Promise<string | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { phone: true },
      });
      return user?.phone || null;
    } catch (error) {
      this.logger.error(`Error fetching phone for user ${userId}:`, error);
      return null;
    }
  }

  async getDeviceTokens(userId: string): Promise<string[]> {
    try {
      const tokens = await this.prisma.deviceToken.findMany({
        where: {
          userId,
          isActive: true,
        },
        select: { token: true },
      });
      return tokens.map((t) => t.token);
    } catch (error) {
      this.logger.error(
        `Error fetching device tokens for user ${userId}:`,
        error,
      );
      return [];
    }
  }

  async getUserPreferences(userId: string) {
    try {
      return await this.prisma.userPreference.findMany({
        where: { userId },
      });
    } catch (error) {
      this.logger.error(
        `Error fetching preferences for user ${userId}:`,
        error,
      );
      return [];
    }
  }

  async updateUserPreferences(
    userId: string,
    channel: string,
    enabled: boolean,
  ) {
    try {
      const preference = await this.prisma.userPreference.upsert({
        where: {
          userId_channel: {
            userId,
            channel: channel as any,
          },
        },
        update: {
          isEnabled: enabled,
        },
        create: {
          userId,
          channel: channel as any,
          isEnabled: enabled,
        },
      });

      return preference;
    } catch (error) {
      this.logger.error(
        `Error updating preferences for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  async addDeviceToken(userId: string, token: string, platform: string) {
    try {
      return await this.prisma.deviceToken.upsert({
        where: {
          userId_token: {
            userId,
            token,
          },
        },
        update: {
          isActive: true,
          platform: platform as any,
        },
        create: {
          userId,
          token,
          platform: platform as any,
          isActive: true,
        },
      });
    } catch (error) {
      this.logger.error(`Error adding device token for user ${userId}:`, error);
      throw error;
    }
  }

  async deactivateDeviceToken(userId: string, token: string) {
    try {
      return await this.prisma.deviceToken.updateMany({
        where: {
          userId,
          token,
        },
        data: {
          isActive: false,
        },
      });
    } catch (error) {
      this.logger.error(
        `Error deactivating device token for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  async getNotificationTemplate(type: string, channel: string) {
    try {
      const cacheKey = `${type}:${channel}`;
      const cached = this.templateRenderer.getCached(cacheKey);
      if (cached) return cached;

      const tpl = await this.prisma.notificationTemplate.findFirst({
        where: {
          type: type as any,
          channel: channel as any,
          isActive: true,
        },
      });
      if (tpl) this.templateRenderer.setCached(cacheKey, tpl);
      return tpl;
    } catch (error) {
      this.logger.error(
        `Error fetching template for ${type}/${channel}:`,
        error,
      );
      return null;
    }
  }

  async renderTemplate(
    template: any,
    variables: Record<string, any>,
  ): Promise<{ title: string; message: string; htmlContent?: string }> {
    return this.templateRenderer.render(template, variables);
  }
}
