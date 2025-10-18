import { IsArray, IsDateString, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationChannel, NotificationPriority, NotificationType } from '../Types/notification.types';

export class SendNotificationDto {
    @IsString()
    @IsNotEmpty()
    userId: string;

    @IsEnum(NotificationType)
    @IsString()
    type: NotificationType | string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    title: string;

    @IsString()
    @IsNotEmpty()
    message: string;

    @IsOptional()
    @IsEnum(NotificationChannel)
    @IsString()
    channel?: NotificationChannel | string;

    @IsOptional()
    @IsEnum(NotificationPriority)
    @IsString()
    priority?: NotificationPriority | string;

    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;

    @IsOptional()
    @IsDateString()
    scheduledAt?: string;
}

export class BulkNotificationsDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SendNotificationDto)
    notifications: SendNotificationDto[];
}

export class UpdatePreferencesDto {
    @IsEnum(NotificationChannel)
    @IsString()
    channel: NotificationChannel | string;

    @Type(() => Boolean)
    isEnabled: boolean;
}

export class DeviceTokenDto {
    @IsString()
    token: string;

    @IsString()
    platform: string;
}
