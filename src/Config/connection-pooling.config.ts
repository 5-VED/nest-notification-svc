import { ConfigService } from '@nestjs/config';

export interface ConnectionPoolConfig {
  database: {
    maxConnections: number;
    minConnections: number;
    connectionTimeout: number;
    idleTimeout: number;
  };
  redis: {
    maxConnections: number;
    minConnections: number;
    connectionTimeout: number;
    idleTimeout: number;
  };
  kafka: {
    maxConnections: number;
    connectionTimeout: number;
    retryAttempts: number;
  };
  grpc: {
    maxConnections: number;
    keepAliveTime: number;
    keepAliveTimeout: number;
  };
}

export const getConnectionPoolConfig = (
  configService: ConfigService,
): ConnectionPoolConfig => ({
  database: {
    maxConnections: configService.get('DB_MAX_CONNECTIONS', 20),
    minConnections: configService.get('DB_MIN_CONNECTIONS', 5),
    connectionTimeout: configService.get('DB_CONNECTION_TIMEOUT', 30000),
    idleTimeout: configService.get('DB_IDLE_TIMEOUT', 300000),
  },
  redis: {
    maxConnections: configService.get('REDIS_MAX_CONNECTIONS', 50),
    minConnections: configService.get('REDIS_MIN_CONNECTIONS', 10),
    connectionTimeout: configService.get('REDIS_CONNECTION_TIMEOUT', 10000),
    idleTimeout: configService.get('REDIS_IDLE_TIMEOUT', 300000),
  },
  kafka: {
    maxConnections: configService.get('KAFKA_MAX_CONNECTIONS', 10),
    connectionTimeout: configService.get('KAFKA_CONNECTION_TIMEOUT', 30000),
    retryAttempts: configService.get('KAFKA_RETRY_ATTEMPTS', 8),
  },
  grpc: {
    maxConnections: configService.get('GRPC_MAX_CONNECTIONS', 100),
    keepAliveTime: configService.get('GRPC_KEEPALIVE_TIME', 30000),
    keepAliveTimeout: configService.get('GRPC_KEEPALIVE_TIMEOUT', 5000),
  },
});

// Performance-optimized Prisma configuration
export const getPrismaConfig = (configService: ConfigService) => ({
  datasources: {
    db: {
      url: configService.get('DATABASE_URL'),
    },
  },
  // Connection pooling settings
  connectionLimit: configService.get('DB_MAX_CONNECTIONS', 20),
  pool: {
    min: configService.get('DB_MIN_CONNECTIONS', 5),
    max: configService.get('DB_MAX_CONNECTIONS', 20),
    acquireTimeoutMillis: configService.get('DB_CONNECTION_TIMEOUT', 30000),
    createTimeoutMillis: configService.get('DB_CONNECTION_TIMEOUT', 30000),
    destroyTimeoutMillis: configService.get('DB_CONNECTION_TIMEOUT', 30000),
    idleTimeoutMillis: configService.get('DB_IDLE_TIMEOUT', 300000),
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200,
  },
  // Query optimization
  log:
    configService.get('NODE_ENV') === 'development'
      ? ['query', 'info', 'warn', 'error']
      : ['error'],
  // Performance settings
  transactionOptions: {
    maxWait: configService.get('DB_CONNECTION_TIMEOUT', 30000),
    timeout: configService.get('DB_CONNECTION_TIMEOUT', 30000),
  },
});

// Redis connection pool configuration
export const getRedisConfig = (configService: ConfigService) => ({
  host: configService.get('REDIS_HOST', 'localhost'),
  port: configService.get('REDIS_PORT', 6379),
  password: configService.get('REDIS_PASSWORD'),
  db: configService.get('REDIS_DB', 0),
  // Connection pooling
  family: 4,
  keepAlive: true,
  keepAliveInitialDelay: 0,
  // Performance settings
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxLoadingTimeout: 10000,
  lazyConnect: true,
  // Connection pool
  maxConnections: configService.get('REDIS_MAX_CONNECTIONS', 50),
  minConnections: configService.get('REDIS_MIN_CONNECTIONS', 10),
  connectionTimeout: configService.get('REDIS_CONNECTION_TIMEOUT', 10000),
  idleTimeout: configService.get('REDIS_IDLE_TIMEOUT', 300000),
});

// Kafka connection configuration
export const getKafkaConfig = (configService: ConfigService) => ({
  clientId: 'notification-service',
  brokers: [configService.get('KAFKA_BROKER', 'localhost:9092')],
  retry: {
    initialRetryTime: 100,
    retries: configService.get('KAFKA_RETRY_ATTEMPTS', 8),
  },
  // Connection pooling
  connectionTimeout: configService.get('KAFKA_CONNECTION_TIMEOUT', 30000),
  requestTimeout: 30000,
  // Performance settings
  maxInFlightRequests: 5,
  idempotent: true,
  transactionTimeout: 30000,
  // Consumer settings
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
  maxBytesPerPartition: 1048576 * 4, // 4MB
  maxWaitTimeInMs: 100,
  minBytes: 1,
  maxBytes: 1048576, // 1MB
});

// gRPC connection configuration
export const getGrpcConfig = (configService: ConfigService) => ({
  package: 'notification',
  protoPath: 'src/proto/notification.proto',
  url: `localhost:${configService.get('GRPC_PORT', 50051)}`,
  // Connection pooling
  maxConnections: configService.get('GRPC_MAX_CONNECTIONS', 100),
  // Keepalive settings
  keepalive: {
    keepaliveTimeMs: configService.get('GRPC_KEEPALIVE_TIME', 30000),
    keepaliveTimeoutMs: configService.get('GRPC_KEEPALIVE_TIMEOUT', 5000),
    keepalivePermitWithoutCalls: 1,
    http2MaxPingsWithoutData: 0,
    http2MinTimeBetweenPingsMs: 10000,
    http2MinPingIntervalWithoutDataMs: 300000,
  },
  // Message size limits
  maxReceiveMessageLength: 4 * 1024 * 1024, // 4MB
  maxSendMessageLength: 4 * 1024 * 1024, // 4MB
  // Compression
  compression: 'gzip',
});
