import { Module, forwardRef } from '@nestjs/common';
import { BullConfigModule } from '../BullModule/bull.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { KafkaModule } from '../KafkaModule/kafka.module';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationGrpcController } from './grpc/notification.grpc.controller';
import { ChannelService } from './services/channel.service';
import { TemplateRenderer } from './services/template.renderer';
import { EmailWorker } from './workers/email.worker';
import { PushWorker } from './workers/push.worker';
import { MqttWorker } from './workers/mqtt.worker';
import { PerformanceMonitor } from './monitoring/performance.monitor';

@Module({
  imports: [BullConfigModule, PrismaModule, forwardRef(() => KafkaModule)],
  controllers: [NotificationController, NotificationGrpcController],
  providers: [
    NotificationService,
    ChannelService,
    TemplateRenderer,
    EmailWorker,
    PushWorker,
    MqttWorker,
    PerformanceMonitor,
  ],
  exports: [NotificationService, ChannelService, PerformanceMonitor],
})
export class NotificationModule {}
