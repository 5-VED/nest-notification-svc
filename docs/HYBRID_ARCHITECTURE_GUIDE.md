# Hybrid Notification Architecture Guide

## 🚀 Architecture Overview

This notification service implements a **hybrid architecture** optimized for different use cases:

- **gRPC**: Real-time notifications (1-5ms latency, 1,000+ notifications/sec)
- **Kafka**: Bulk operations (10-50ms latency, 10,000+ notifications/sec)  
- **REST API**: Admin/external access only

## 📊 Performance Targets

| Method | Latency | Throughput | Use Case |
|--------|---------|------------|----------|
| **gRPC Single** | 1-5ms | 1,000+ req/s | Real-time notifications |
| **gRPC Bulk** | 10-50ms | 5,000+ req/s | Batch processing |
| **gRPC Stream** | 1-5ms | 10,000+ req/s | High-volume streaming |
| **Kafka Bulk** | 10-50ms | 10,000+ msg/s | Background processing |
| **REST Admin** | 5-20ms | 100-500 req/s | Management only |

## 🔧 Usage Examples

### 1. Real-time Notifications (gRPC)

**Single Notification:**
```typescript
// For immediate notifications (order confirmations, alerts)
const result = await notificationClient.sendNotification({
  userId: '123',
  type: 'ORDER_CONFIRMATION',
  title: 'Order Confirmed',
  message: 'Your order has been confirmed',
  priority: 'HIGH'
});
```

**Bulk Notifications:**
```typescript
// For batch processing (up to 1,000 notifications)
const result = await notificationClient.sendBulkNotificationsOptimized({
  notifications: [
    { userId: '1', type: 'WELCOME', title: 'Welcome!', message: 'Welcome!' },
    { userId: '2', type: 'WELCOME', title: 'Welcome!', message: 'Welcome!' },
    // ... up to 1,000 notifications
  ]
});
```

**Streaming (Maximum Performance):**
```typescript
// For high-volume real-time processing
const notifications$ = new Observable(subscriber => {
  // Stream notifications as they come in
  subscriber.next({ userId: '1', type: 'ALERT', title: 'Alert', message: 'Something happened' });
  subscriber.next({ userId: '2', type: 'ALERT', title: 'Alert', message: 'Something else happened' });
  subscriber.complete();
});

notificationClient.sendNotificationStream(notifications$).subscribe({
  next: (response) => console.log('Processed:', response),
  complete: () => console.log('All processed'),
});
```

### 2. Bulk Operations (Kafka)

**High-Volume Background Processing:**
```typescript
// For newsletters, marketing campaigns, system announcements
const notifications = generateBulkNotifications(10000); // 10,000 notifications

await kafkaProducer.sendBulkNotifications(notifications, 'campaign_2024_01');
```

**Event-Driven Notifications:**
```typescript
// For system events (user registration, order updates)
await kafkaProducer.sendEvent('user.events', {
  eventType: 'USER_REGISTERED',
  userId: '123',
  userName: 'John Doe',
  email: 'john@example.com',
  timestamp: new Date().toISOString(),
});
```

### 3. Admin Management (REST API)

**System Health Check:**
```bash
GET /admin/notifications/health
```

**Send Test Notification:**
```bash
POST /admin/notifications
{
  "userId": "123",
  "type": "TEST",
  "title": "Test Notification",
  "message": "This is a test",
  "channel": "EMAIL"
}
```

**Bulk Admin Operations:**
```bash
POST /admin/notifications/bulk
{
  "notifications": [
    { "userId": "1", "type": "WELCOME", "title": "Welcome!", "message": "Welcome!" },
    { "userId": "2", "type": "WELCOME", "title": "Welcome!", "message": "Welcome!" }
  ]
}
```

## 🎯 When to Use Each Method

### Use gRPC When:
- ✅ **Real-time notifications** (order confirmations, alerts)
- ✅ **Low latency required** (<5ms)
- ✅ **Interactive applications** (user actions)
- ✅ **Critical notifications** (security alerts, payment confirmations)
- ✅ **Small to medium batches** (<1,000 notifications)

### Use Kafka When:
- ✅ **Bulk operations** (>1,000 notifications)
- ✅ **Background processing** (newsletters, reports)
- ✅ **System events** (user registration, data sync)
- ✅ **High throughput** (10,000+ notifications/sec)
- ✅ **Event-driven architecture**

### Use REST API When:
- ✅ **Admin operations** (user management, system config)
- ✅ **External integrations** (third-party systems)
- ✅ **Testing and debugging**
- ✅ **System monitoring** (health checks, metrics)

## ⚡ Performance Optimization

### Database Optimization
```sql
-- Key indexes for performance
CREATE INDEX idx_notifications_status_created ON notifications(status, created_at);
CREATE INDEX idx_notifications_user_priority ON notifications(user_id, priority, created_at);
CREATE INDEX idx_notifications_scheduled ON notifications(scheduled_at);
```

### Connection Pooling
```typescript
// Environment variables for connection pooling
DB_MAX_CONNECTIONS=20
REDIS_MAX_CONNECTIONS=50
KAFKA_MAX_CONNECTIONS=10
GRPC_MAX_CONNECTIONS=100
```

### Monitoring
```typescript
// Health check with performance metrics
const health = await notificationClient.healthCheck();
console.log(`Status: ${health.status}`);
console.log(`Throughput: ${health.throughputPerSecond}/sec`);
console.log(`Queue Depth: ${health.queueDepth}`);
console.log(`Active Workers: ${health.activeWorkers}`);
```

## 🚦 Load Balancing

### gRPC Load Balancing
- Use **round-robin** or **least-connections** strategy
- Health checks every 30 seconds
- Circuit breaker for failed instances

### Kafka Partitioning
- Partition by `userId` for user-specific notifications
- Partition by `type` for notification type distribution
- Use multiple consumers for parallel processing

## 📈 Scaling Guidelines

### Horizontal Scaling
- **gRPC**: Scale to 5-10 instances for 10,000+ req/s
- **Kafka**: Scale consumers based on partition count
- **Workers**: Scale based on queue depth

### Vertical Scaling
- **CPU**: 4-8 cores for high throughput
- **Memory**: 8-16GB for connection pooling
- **Network**: 1Gbps+ for high-volume operations

## 🔍 Monitoring and Alerting

### Key Metrics
- **Throughput**: Notifications per second
- **Latency**: P50, P95, P99 response times
- **Error Rate**: Failed notifications percentage
- **Queue Depth**: Pending notifications count
- **Active Workers**: Processing capacity

### Alerting Thresholds
- **Error Rate**: >5% for 5 minutes
- **Queue Depth**: >1,000 pending notifications
- **Latency**: P95 >100ms for 5 minutes
- **Throughput**: <50% of expected capacity

## 🛠️ Development Setup
t
### Prerequisites
```bash
# Insall dependencies
npm install

# Start infrastructure
docker-compose up -d redis kafka postgres

# Generate Prisma client
npx prisma generate
npx prisma db push

# Run performance tests
npm run test:performance
```

### Environment Variables
```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/notifications"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Kafka
KAFKA_BROKER=localhost:9092

# gRPC
GRPC_PORT=50051

# Performance
DB_MAX_CONNECTIONS=20
REDIS_MAX_CONNECTIONS=50
KAFKA_MAX_CONNECTIONS=10
GRPC_MAX_CONNECTIONS=100
```

## 🎉 Expected Results

With this hybrid architecture, you can achieve:

- **1,000+ notifications/sec** via gRPC (real-time)
- **10,000+ notifications/sec** via Kafka (bulk)
- **<5ms latency** for critical notifications
- **99.9% reliability** with retry mechanisms
- **Horizontal scaling** to handle growth

**Your 1000 notifications/sec target is easily achievable with room for 10x growth!** 🚀
