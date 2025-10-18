-- Performance optimization indexes for notification service
-- These indexes are designed to handle 1000+ notifications per second

-- Index for pending notifications (most common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_status_created 
ON notifications(status, created_at) 
WHERE status IN ('PENDING', 'PROCESSING');

-- Index for user notifications with priority
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_priority_created 
ON notifications(user_id, priority, created_at);

-- Index for scheduled notifications
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_scheduled 
ON notifications(scheduled_at) 
WHERE scheduled_at IS NOT NULL;

-- Index for failed notifications (for retry logic)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_failed_retry 
ON notifications(status, retry_count, failed_at) 
WHERE status = 'FAILED' AND retry_count < 3;

-- Index for notification type and channel
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_type_channel 
ON notifications(type, channel, created_at);

-- Index for user preferences (frequently queried)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_preferences_user_channel 
ON user_preferences(user_id, channel);

-- Index for device tokens (for push notifications)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_device_tokens_user_active 
ON device_tokens(user_id, is_active) 
WHERE is_active = true;

-- Index for notification templates
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_templates_type_channel_active 
ON notification_templates(type, channel, is_active) 
WHERE is_active = true;

-- Composite index for complex queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_complex 
ON notifications(user_id, status, priority, created_at);

-- Partial index for high priority notifications
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_high_priority 
ON notifications(created_at, status) 
WHERE priority IN ('HIGH', 'URGENT');

-- Index for cleanup operations (old completed notifications)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_cleanup 
ON notifications(created_at, status) 
WHERE status IN ('SENT', 'FAILED') AND created_at < NOW() - INTERVAL '30 days';
