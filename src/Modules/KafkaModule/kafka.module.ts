import { Module, forwardRef } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { KafkaConsumer } from './kafka.consumer';
import { KafkaProducer } from './kafka.producer';
import { NotificationModule } from '../NotificationModule/notification.module';

@Module({
  imports: [forwardRef(() => NotificationModule)],
  providers: [KafkaConsumer, KafkaProducer],
  exports: [KafkaConsumer, KafkaProducer],
})
export class KafkaModule {}
