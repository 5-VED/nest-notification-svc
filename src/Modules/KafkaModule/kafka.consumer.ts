import { Injectable, Logger } from '@nestjs/common';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { NotificationService } from '../NotificationModule/notification.service';

@Injectable()
export class KafkaConsumer {
  private readonly logger = new Logger(KafkaConsumer.name);
  private consumer: Consumer;

  constructor(private readonly notificationService: NotificationService) {
    const kafka = new Kafka({
      clientId: 'notification-service',
      brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    this.consumer = kafka.consumer({
      groupId: 'notification-group',
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      maxBytesPerPartition: 1048576 * 4, // 4MB for better throughput
      allowAutoTopicCreation: false,
      // Performance optimizations
      maxWaitTimeInMs: 100, // Reduce latency
      minBytes: 1,
      maxBytes: 1048576, // 1MB
    });
  }

  async onModuleInit() {
    await this.connect();
    await this.subscribe();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect() {
    try {
      await this.consumer.connect();
      this.logger.log('Connected to Kafka');
    } catch (error) {
      this.logger.error('Failed to connect to Kafka:', error);
      throw error;
    }
  }

  private async subscribe() {
    const topics = [
      'user.events',
      'auth.events',
      'order.events',
      'payment.events',
      'notification.bulk', // Add bulk notification topic
    ];

    for (const topic of topics) {
      await this.consumer.subscribe({
        topic,
        fromBeginning: false,
      });
    }

    await this.consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        await this.handleMessage(payload);
      },
    });

    this.logger.log(`Subscribed to topics: ${topics.join(', ')}`);
  }

  private async handleMessage(payload: EachMessagePayload) {
    try {
      const { topic, partition, message } = payload;
      const messageValue = message.value?.toString();

      if (!messageValue) {
        this.logger.warn(`Empty message received from ${topic}`);
        return;
      }

      const eventData = JSON.parse(messageValue);

      // Handle bulk notifications differently
      if (topic === 'notification.bulk' && eventData.bulkNotifications) {
        await this.handleBulkNotifications(eventData);
      } else {
        // Single event processing
        this.logger.log(`Received event from ${topic}:`, eventData);
        await this.notificationService.processEvent({
          topic,
          partition,
          offset: message.offset,
          timestamp: message.timestamp,
          data: eventData,
        });
      }
    } catch (error) {
      this.logger.error(
        `Error processing message from ${payload.topic}:`,
        error,
      );
      // Implement dead letter queue or retry logic here
    }
  }

  private async handleBulkNotifications(eventData: any) {
    const { bulkNotifications, batchId } = eventData;
    const startTime = Date.now();

    this.logger.log(
      `Processing bulk notifications batch ${batchId}: ${bulkNotifications.length} notifications`,
    );

    try {
      // Process in parallel batches for maximum throughput
      const batchSize = 100;
      const batches: Promise<any>[] = [];

      for (let i = 0; i < bulkNotifications.length; i += batchSize) {
        const batch = bulkNotifications.slice(i, i + batchSize);
        batches.push(this.processNotificationBatch(batch));
      }

      const results = await Promise.allSettled(batches);
      const processingTime = Date.now() - startTime;

      const successCount =
        results.filter((r) => r.status === 'fulfilled').length * batchSize;
      const throughput = Math.round(
        (bulkNotifications.length / processingTime) * 1000,
      );

      this.logger.log(
        `Bulk processing completed: ${successCount}/${bulkNotifications.length} notifications in ${processingTime}ms (${throughput}/sec)`,
      );
    } catch (error) {
      this.logger.error(`Bulk processing failed for batch ${batchId}:`, error);
    }
  }

  private async processNotificationBatch(notifications: any[]) {
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
          scheduledAt: notification.scheduledAt
            ? new Date(notification.scheduledAt)
            : undefined,
        }),
      ),
    );
  }

  private async disconnect() {
    try {
      await this.consumer.disconnect();
      this.logger.log('Disconnected from Kafka');
    } catch (error) {
      this.logger.error('Error disconnecting from Kafka:', error);
    }
  }
}
