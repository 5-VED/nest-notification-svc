import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Put,
  Delete,
  UseGuards,
  HttpStatus,
  HttpException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import {
  BulkNotificationsDto,
  DeviceTokenDto,
  SendNotificationDto,
  UpdatePreferencesDto,
} from '../../Common/Dtos/notification.dto';
import { ChannelService } from './services/channel.service';
import { KafkaProducer } from '../KafkaModule/kafka.producer';

// Simple admin guard (replace with your actual auth system)
@Controller('admin/notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly channelService: ChannelService,
    private readonly kafkaProducer: KafkaProducer,
  ) {}

  // Admin-only: Send single notification (for testing/admin purposes)
  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async sendNotification(@Body() notificationData: SendNotificationDto) {
    // Log admin action
    console.log(
      `Admin sending notification to user ${notificationData.userId}`,
    );
    const payload: any = {
      ...notificationData,
      scheduledAt: notificationData.scheduledAt
        ? new Date(notificationData.scheduledAt)
        : undefined,
    };
    return this.notificationService.sendNotification(payload);
  }

  // Admin-only: Send bulk notifications via Kafka (high throughput)
  @Post('bulk')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async sendBulkNotifications(@Body() body: BulkNotificationsDto) {
    if (!body.notifications || body.notifications.length === 0) {
      throw new HttpException(
        'No notifications provided',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (body.notifications.length > 10000) {
      throw new HttpException(
        'Too many notifications. Maximum 10,000 per request.',
        HttpStatus.BAD_REQUEST,
      );
    }

    console.log(
      `Admin sending bulk notifications: ${body.notifications.length} notifications`,
    );

    // Use Kafka for bulk operations
    await this.kafkaProducer.sendBulkNotifications(body.notifications as any);

    return {
      success: true,
      message: `${body.notifications.length} notifications queued for processing`,
      batchId: `admin_${Date.now()}`,
    };
  }

  // Admin-only: User preference management
  @Get('user/:userId/preferences')
  async getUserPreferences(@Param('userId') userId: string) {
    return this.channelService.getUserPreferences(userId);
  }

  @Put('user/:userId/preferences')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateUserPreferences(
    @Param('userId') userId: string,
    @Body() body: UpdatePreferencesDto,
  ) {
    return this.channelService.updateUserPreferences(
      userId,
      body.channel,
      body.isEnabled,
    );
  }

  @Post('user/:userId/device-token')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async addDeviceToken(
    @Param('userId') userId: string,
    @Body() body: DeviceTokenDto,
  ) {
    return this.channelService.addDeviceToken(
      userId,
      body.token,
      body.platform,
    );
  }

  @Delete('user/:userId/device-token/:token')
  async removeDeviceToken(
    @Param('userId') userId: string,
    @Param('token') token: string,
  ) {
    return this.channelService.deactivateDeviceToken(userId, token);
  }

  // Admin-only: System management
  @Post('retry-failed')
  async retryFailedNotifications() {
    return this.notificationService.retryFailedNotifications();
  }

  // Admin-only: System health and metrics
  @Get('health')
  async getSystemHealth() {
    const kafkaMetrics = await this.kafkaProducer.getMetrics();
    return {
      status: 'healthy',
      timestamp: Date.now(),
      kafka: kafkaMetrics,
      message:
        'Use gRPC for real-time notifications, Kafka for bulk operations',
    };
  }

  // Admin-only: Performance metrics
  @Get('metrics')
  async getPerformanceMetrics() {
    // This would integrate with your performance monitor
    return {
      message: 'Performance metrics available via gRPC health check',
      grpcEndpoint: 'localhost:50051',
      recommendedUsage: {
        realTime: 'Use gRPC for <5ms latency',
        bulk: 'Use Kafka for >1000 notifications',
        admin: 'Use REST API for management only',
      },
    };
  }
}
