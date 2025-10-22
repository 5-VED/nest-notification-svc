import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'notification',
      protoPath: join(__dirname, 'proto/notification.proto'),
      url: 'localhost:50051',
      // Performance optimizations
      keepalive: {
        keepaliveTimeMs: 30000,
        keepaliveTimeoutMs: 5000,
        keepalivePermitWithoutCalls: 1, // 1 for true, 0 for false
        http2MaxPingsWithoutData: 0,
        http2MinTimeBetweenPingsMs: 10000,
        http2MinPingIntervalWithoutDataMs: 300000,
      },
      maxReceiveMessageLength: 4 * 1024 * 1024, // 4MB
      maxSendMessageLength: 4 * 1024 * 1024, // 4MB
      // Enable compression
      compression: 'gzip',
    },
  });
  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
