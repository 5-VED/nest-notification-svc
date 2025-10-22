import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB', 0),
        },
        defaultJobOptions: {
          removeOnComplete: 5, // Keep only 5 completed jobs for performance
          removeOnFail: 3, // Keep only 3 failed jobs
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000, // Faster retry
          },
        },
        settings: {
          stalledInterval: 5000, // Check for stalled jobs every 5s
          maxStalledCount: 1, // Retry stalled jobs once
          retryProcessDelay: 100, // Faster retry processing
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: 'email-queue' },
      { name: 'push-queue' },
      { name: 'sms-queue' },
    ),
  ],
  exports: [BullModule],
})
export class BullConfigModule {}
