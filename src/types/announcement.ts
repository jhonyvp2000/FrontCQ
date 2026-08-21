export type AnnouncementSeverity = 'danger' | 'warning' | 'info' | 'success';
export type AnnouncementTargetType = 'ALL' | 'ROLE' | 'USER';
export type AnnouncementActionType = 'OPEN_IMAGE_MODAL' | 'OPEN_PROFILE_CONTACTS' | 'EXTERNAL_LINK';

export interface SystemAnnouncement {
  id: string;
  title: string;
  message: string;
  severity: AnnouncementSeverity;
  targetType: AnnouncementTargetType;
  targetRoleId?: string | null;
  targetRoleName?: string | null;
  targetUserId?: string | null;
  targetUserName?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  actionLabel?: string | null;
  actionType?: AnnouncementActionType | null;
  customUrl?: string | null;
  validFrom?: string | Date | null;
  validUntil?: string | Date | null;
  isActive: boolean;
  isSystemRule?: boolean; // True for auto-generated alerts like unverified email
  isRead?: boolean;
  readsCount?: number;
  createdAt?: string | Date;
}
