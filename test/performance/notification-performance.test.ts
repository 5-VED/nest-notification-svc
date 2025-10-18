import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from '../../src/Modules/NotificationModule/notification.service';
import { KafkaProducer } from '../../src/Modules/KafkaModule/kafka.producer';
import { PerformanceMonitor } from '../../src/Modules/NotificationModule/monitoring/performance.monitor';

describe('Notification Performance Tests', () => {
  let notificationService: NotificationService;
  let kafkaProducer: KafkaProducer;
  let performanceMonitor: PerformanceMonitor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        KafkaProducer,
        PerformanceMonitor,
      ],
    }).compile();

    notificationService = module.get<NotificationService>(NotificationService);
    kafkaProducer = module.get<KafkaProducer>(KafkaProducer);
    performanceMonitor = module.get<PerformanceMonitor>(PerformanceMonitor);
  });

  describe('gRPC Performance Tests', () => {
    it('should handle 1000+ notifications per second via gRPC', async () => {
      const startTime = Date.now();
      const notificationCount = 1000;
      const notifications = generateTestNotifications(notificationCount);

      // Simulate gRPC calls
      const promises = notifications.map(notification => 
        notificationService.sendNotification(notification)
      );

      await Promise.all(promises);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      const throughput = Math.round((notificationCount / processingTime) * 1000);

      console.log(`gRPC Performance: ${notificationCount} notifications in ${processingTime}ms (${throughput}/sec)`);
      
      expect(throughput).toBeGreaterThan(1000);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should maintain <5ms latency for single gRPC calls', async () => {
      const notification = generateTestNotification();
      
      const startTime = process.hrtime.bigint();
      await notificationService.sendNotification(notification);
      const endTime = process.hrtime.bigint();
      
      const latency = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      
      console.log(`gRPC Latency: ${latency.toFixed(2)}ms`);
      expect(latency).toBeLessThan(5);
    });
  });

  describe('Kafka Performance Tests', () => {
    it('should handle 10,000+ notifications per second via Kafka', async () => {
      const startTime = Date.now();
      const notificationCount = 10000;
      const notifications = generateTestNotifications(notificationCount);

      // Simulate Kafka bulk processing
      await kafkaProducer.sendBulkNotifications(notifications);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      const throughput = Math.round((notificationCount / processingTime) * 1000);

      console.log(`Kafka Performance: ${notificationCount} notifications in ${processingTime}ms (${throughput}/sec)`);
      
      expect(throughput).toBeGreaterThan(10000);
      expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should maintain <50ms latency for Kafka bulk operations', async () => {
      const notifications = generateTestNotifications(1000);
      
      const startTime = process.hrtime.bigint();
      await kafkaProducer.sendBulkNotifications(notifications);
      const endTime = process.hrtime.bigint();
      
      const latency = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      
      console.log(`Kafka Bulk Latency: ${latency.toFixed(2)}ms`);
      expect(latency).toBeLessThan(50);
    });
  });

  describe('Hybrid Performance Tests', () => {
    it('should handle mixed workload efficiently', async () => {
      const startTime = Date.now();
      
      // Mix of gRPC (real-time) and Kafka (bulk) operations
      const grpcPromises = generateTestNotifications(500).map(notification => 
        notificationService.sendNotification(notification)
      );
      
      const kafkaPromise = kafkaProducer.sendBulkNotifications(
        generateTestNotifications(2000)
      );

      await Promise.all([...grpcPromises, kafkaPromise]);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      const totalNotifications = 500 + 2000;
      const throughput = Math.round((totalNotifications / processingTime) * 1000);

      console.log(`Hybrid Performance: ${totalNotifications} notifications in ${processingTime}ms (${throughput}/sec)`);
      
      expect(throughput).toBeGreaterThan(2000);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track performance metrics accurately', async () => {
      // Generate some load
      const notifications = generateTestNotifications(100);
      await Promise.all(notifications.map(n => notificationService.sendNotification(n)));

      // Wait for metrics collection
      await new Promise(resolve => setTimeout(resolve, 11000));

      const metrics = performanceMonitor.getCurrentMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics?.totalProcessed).toBeGreaterThan(0);
      expect(metrics?.throughputPerSecond).toBeGreaterThan(0);
      
      console.log('Performance Metrics:', metrics);
    });

    it('should detect unhealthy state', async () => {
      // Simulate high error rate
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordError();
      }
      
      const isHealthy = performanceMonitor.isHealthy();
      expect(isHealthy).toBe(false);
    });
  });

  // Helper functions
  function generateTestNotifications(count: number) {
    return Array.from({ length: count }, (_, i) => generateTestNotification(i));
  }

  function generateTestNotification(index: number = 0) {
    return {
      userId: `user_${index}`,
      type: 'TEST',
      title: `Test Notification ${index}`,
      message: `This is test notification number ${index}`,
      channel: 'EMAIL',
      priority: 'NORMAL',
      metadata: { testId: index },
    };
  }
});

// Load testing utilities
export class LoadTester {
  private results: Array<{ timestamp: number; latency: number; success: boolean }> = [];

  async runLoadTest(
    operation: () => Promise<any>,
    concurrency: number,
    duration: number
  ) {
    const startTime = Date.now();
    const endTime = startTime + duration;
    
    const workers = Array.from({ length: concurrency }, () => 
      this.runWorker(operation, endTime)
    );

    await Promise.all(workers);
    
    return this.calculateResults();
  }

  private async runWorker(operation: () => Promise<any>, endTime: number) {
    while (Date.now() < endTime) {
      const start = process.hrtime.bigint();
      try {
        await operation();
        const end = process.hrtime.bigint();
        const latency = Number(end - start) / 1000000;
        
        this.results.push({
          timestamp: Date.now(),
          latency,
          success: true,
        });
      } catch (error) {
        const end = process.hrtime.bigint();
        const latency = Number(end - start) / 1000000;
        
        this.results.push({
          timestamp: Date.now(),
          latency,
          success: false,
        });
      }
    }
  }

  private calculateResults() {
    const total = this.results.length;
    const successful = this.results.filter(r => r.success).length;
    const failed = total - successful;
    const avgLatency = this.results.reduce((sum, r) => sum + r.latency, 0) / total;
    const p95Latency = this.results.sort((a, b) => a.latency - b.latency)[Math.floor(total * 0.95)]?.latency || 0;
    const p99Latency = this.results.sort((a, b) => a.latency - b.latency)[Math.floor(total * 0.99)]?.latency || 0;

    return {
      total,
      successful,
      failed,
      successRate: (successful / total) * 100,
      avgLatency: avgLatency.toFixed(2),
      p95Latency: p95Latency.toFixed(2),
      p99Latency: p99Latency.toFixed(2),
    };
  }
}
