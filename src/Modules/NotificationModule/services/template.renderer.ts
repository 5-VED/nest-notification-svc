import { Injectable, Logger } from '@nestjs/common';

type CacheEntry = { value: any; timestamp: number };

@Injectable()
export class TemplateRenderer {
  private readonly logger = new Logger(TemplateRenderer.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly maxSize = 500;
  private readonly ttlMs = 5 * 60 * 1000; // 5 minutes

  getCached(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    // LRU: re-insert
    this.cache.delete(key);
    this.cache.set(key, { value: entry.value, timestamp: Date.now() });
    return entry.value;
  }

  setCached(key: string, value: any) {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  render(template: any, variables: Record<string, unknown>): { title: string; message: string; htmlContent?: string } {
    try {
      let title = template.title;
      let message = template.message;
      let htmlContent = template.htmlContent as string | undefined;

      for (const [key, value] of Object.entries(variables)) {
        const placeholder = new RegExp(`{{${key}}}`, 'g');
        title = title.replace(placeholder, String(value));
        message = message.replace(placeholder, String(value));
        if (htmlContent) {
          htmlContent = htmlContent.replace(placeholder, String(value));
        }
      }

      return { title, message, htmlContent };
    } catch (error) {
      this.logger.error('Error rendering template');
      return { title: template.title, message: template.message, htmlContent: template.htmlContent };
    }
  }
}
