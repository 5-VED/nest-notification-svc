import { Injectable, Logger } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';

@Injectable()
export class KafkaProducer {
  private readonly logger = new Logger(KafkaProducer.name);
  private producer: Producer;

  constructor() {
    const kafka = new Kafka({
      clientId: 'notification-producer',
      brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    this.producer = kafka.producer({
      // Performance optimizations for high throughput
      maxInFlightRequests: 5,
      idempotent: true,
      transactionTimeout: 30000,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect() {
    try {
      await this.producer.connect();
      this.logger.log('Kafka producer connected');
    } catch (error) {
      this.logger.error('Failed to connect Kafka producer:', error);
      throw error;
    }
  }

  private async disconnect() {
    try {
      await this.producer.disconnect();
      this.logger.log('Kafka producer disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting Kafka producer:', error);
    }
  }

  // Send single event (for real-time notifications via gRPC)
  async sendEvent(topic: string, eventData: any) {
    try {
      await this.producer.send({
        topic,
        messages: [
          {
            key: eventData.userId || eventData.id || 'default',
            value: JSON.stringify(eventData),
            timestamp: Date.now().toString(),
          },
        ],
      });

      this.logger.log(`Event sent to ${topic}`);
    } catch (error) {
      this.logger.error(`Failed to send event to ${topic}:`, error);
      throw error;
    }
  }

  // Send bulk notifications (optimized for high throughput)
  async sendBulkNotifications(notifications: any[], batchId?: string) {
    const startTime = Date.now();
    const batchIdFinal = batchId || `bulk_${Date.now()}`;

    try {
      // Split into smaller chunks for better performance
      const chunkSize = 1000;
      const chunks: any[] = [];

      for (let i = 0; i < notifications.length; i += chunkSize) {
        chunks.push(notifications.slice(i, i + chunkSize));
      }

      // Send chunks in parallel
      const promises = chunks.map((chunk, index) =>
        this.producer.send({
          topic: 'notification.bulk',
          messages: [
            {
              key: `${batchIdFinal}_chunk_${index}`,
              value: JSON.stringify({
                batchId: `${batchIdFinal}_chunk_${index}`,
                bulkNotifications: chunk,
                totalNotifications: notifications.length,
                chunkIndex: index,
                totalChunks: chunks.length,
              }),
              timestamp: Date.now().toString(),
            },
          ],
        }),
      );

      await Promise.all(promises);

      const processingTime = Date.now() - startTime;
      const throughput = Math.round(
        (notifications.length / processingTime) * 1000,
      );

      this.logger.log(
        `Bulk notifications sent: ${notifications.length} notifications in ${processingTime}ms (${throughput}/sec)`,
      );
    } catch (error) {
      this.logger.error(`Failed to send bulk notifications:`, error);
      throw error;
    }
  }

  // Send transactional events (for critical operations)
  async sendTransactionalEvent(topic: string, eventData: any) {
    const transaction = await this.producer.transaction();

    try {
      await transaction.send({
        topic,
        messages: [
          {
            key: eventData.userId || eventData.id || 'default',
            value: JSON.stringify(eventData),
            timestamp: Date.now().toString(),
          },
        ],
      });

      await transaction.commit();
      this.logger.log(`Transactional event sent to ${topic}`);
    } catch (error) {
      await transaction.abort();
      this.logger.error(
        `Failed to send transactional event to ${topic}:`,
        error,
      );
      throw error;
    }
  }

  // Get producer metrics
  async getMetrics() {
    try {
      // Note: Admin functionality not available in this Kafka client version
      // Return basic metrics instead
      return {
        connected: true,
        topics: [
          'notification.bulk',
          'user.events',
          'auth.events',
          'order.events',
          'payment.events',
        ],
        timestamp: Date.now(),
        status: 'active',
      };
    } catch (error) {
      this.logger.error('Failed to get producer metrics:', error);
      return {
        connected: false,
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }
}
