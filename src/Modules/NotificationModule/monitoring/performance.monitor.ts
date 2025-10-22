import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

export interface PerformanceMetrics {
  timestamp: number;
  totalProcessed: number;
  throughputPerSecond: number;
  queueDepths: {
    email: number;
    push: number;
    sms: number;
    total: number;
  };
  activeWorkers: {
    email: number;
    push: number;
    sms: number;
    total: number;
  };
  averageProcessingTime: number;
  errorRate: number;
}

@Injectable()
export class PerformanceMonitor {
  private readonly logger = new Logger(PerformanceMonitor.name);
  private metrics: PerformanceMetrics[] = [];
  private startTime = Date.now();
  private totalProcessed = 0;
  private totalErrors = 0;

  constructor(
    @InjectQueue('email-queue') private emailQueue: Queue,
    @InjectQueue('push-queue') private pushQueue: Queue,
    @InjectQueue('sms-queue') private smsQueue: Queue,
  ) {
    // Collect metrics every 10 seconds
    setInterval(() => this.collectMetrics(), 10000);
  }

  async collectMetrics(): Promise<PerformanceMetrics> {
    try {
      const now = Date.now();
      const timeElapsed = (now - this.startTime) / 1000; // seconds
      const throughput =
        timeElapsed > 0 ? this.totalProcessed / timeElapsed : 0;

      // Get queue depths
      const emailWaiting = await this.emailQueue.getWaiting();
      const pushWaiting = await this.pushQueue.getWaiting();
      const smsWaiting = await this.smsQueue.getWaiting();

      // Get active workers
      const emailActive = await this.emailQueue.getActive();
      const pushActive = await this.pushQueue.getActive();
      const smsActive = await this.smsQueue.getActive();

      const metrics: PerformanceMetrics = {
        timestamp: now,
        totalProcessed: this.totalProcessed,
        throughputPerSecond: Math.round(throughput),
        queueDepths: {
          email: emailWaiting.length,
          push: pushWaiting.length,
          sms: smsWaiting.length,
          total: emailWaiting.length + pushWaiting.length + smsWaiting.length,
        },
        activeWorkers: {
          email: emailActive.length,
          push: pushActive.length,
          sms: smsActive.length,
          total: emailActive.length + pushActive.length + smsActive.length,
        },
        averageProcessingTime: 0, // Would need to track this separately
        errorRate:
          this.totalProcessed > 0
            ? (this.totalErrors / this.totalProcessed) * 100
            : 0,
      };

      this.metrics.push(metrics);

      // Keep only last 100 metrics (10 minutes of data)
      if (this.metrics.length > 100) {
        this.metrics = this.metrics.slice(-100);
      }

      // Log performance summary
      this.logger.log(
        `Performance: ${metrics.throughputPerSecond}/sec, Queues: ${metrics.queueDepths.total}, Workers: ${metrics.activeWorkers.total}, Errors: ${metrics.errorRate.toFixed(2)}%`,
      );

      return metrics;
    } catch (error) {
      this.logger.error('Error collecting metrics:', error);
      throw error;
    }
  }

  recordProcessed() {
    this.totalProcessed++;
  }

  recordError() {
    this.totalErrors++;
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0
      ? this.metrics[this.metrics.length - 1]
      : null;
  }

  getAverageThroughput(): number {
    if (this.metrics.length === 0) return 0;

    const totalThroughput = this.metrics.reduce(
      (sum, metric) => sum + metric.throughputPerSecond,
      0,
    );
    return Math.round(totalThroughput / this.metrics.length);
  }

  getPeakThroughput(): number {
    if (this.metrics.length === 0) return 0;

    return Math.max(
      ...this.metrics.map((metric) => metric.throughputPerSecond),
    );
  }

  isHealthy(): boolean {
    const current = this.getCurrentMetrics();
    if (!current) return false;

    // Service is healthy if:
    // - Error rate is less than 5%
    // - Queue depth is not too high (less than 1000)
    // - At least some workers are active
    return (
      current.errorRate < 5 &&
      current.queueDepths.total < 1000 &&
      current.activeWorkers.total > 0
    );
  }

  // Reset metrics (useful for testing)
  reset() {
    this.metrics = [];
    this.startTime = Date.now();
    this.totalProcessed = 0;
    this.totalErrors = 0;
  }
}
