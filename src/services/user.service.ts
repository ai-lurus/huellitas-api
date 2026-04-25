import {
  UserRepository,
  UserProfileRow,
  UpdateUserProfileData,
} from '../repositories/user.repository';
import { deleteFile, uploadFile } from './storage.service';
import { NotFoundError } from '../utils/errors';
import {
  PatchUserProfileInput,
  UpdateLocationInput,
  UpdateUserSettingsInput,
  RegisterPushTokenInput,
} from '../schemas/user.schemas';

export interface UserProfileDto {
  id: string;
  name: string;
  email: string;
  image: string | null;
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;
  alertsEnabled: boolean;
  alertRadiusKm: number;
  notificationsEnabled: boolean;
  emailAlertsEnabled: boolean;
}

function toDto(row: UserProfileRow): UserProfileDto {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    image: row.image,
    onboardingCompleted: row.onboarding_completed_at != null,
    onboardingCompletedAt: row.onboarding_completed_at
      ? new Date(row.onboarding_completed_at).toISOString()
      : null,
    alertsEnabled: row.alerts_enabled,
    alertRadiusKm: row.alert_radius_km,
    notificationsEnabled: row.notifications_enabled,
    emailAlertsEnabled: row.email_alerts_enabled,
  };
}

export class UserService {
  private repo: UserRepository;

  constructor(repo?: UserRepository) {
    this.repo = repo ?? new UserRepository();
  }

  async getProfile(userId: string): Promise<UserProfileDto> {
    const row = await this.repo.findProfileById(userId);
    if (!row) throw new NotFoundError('Usuario no encontrado');
    return toDto(row);
  }

  async updateProfile(userId: string, body: PatchUserProfileInput): Promise<UserProfileDto> {
    const existing = await this.repo.findProfileById(userId);
    if (!existing) throw new NotFoundError('Usuario no encontrado');

    const data: UpdateUserProfileData = {
      name: body.name,
      image: body.image,
      onboardingCompleted: body.onboardingCompleted,
    };

    // Si el cliente manda `image: null` en JSON, se borra la foto (y se intenta borrar el archivo).
    if (body.image === null && existing.image) {
      try {
        await deleteFile(existing.image);
      } catch {
        // best-effort: no bloquea actualización de perfil
      }
    }

    const row = await this.repo.updateProfile(userId, data);
    if (!row) throw new NotFoundError('Usuario no encontrado');

    // Settings (en el mismo PATCH /users/me)
    const settingsRow = await this.repo.updateSettings(userId, {
      alert_radius_km: body.alertRadiusKm,
      alerts_enabled: body.alertsEnabled,
      notifications_enabled: body.notificationsEnabled,
      email_alerts_enabled: body.emailAlertsEnabled,
    });
    return toDto(settingsRow ?? row);
  }

  async updateLocation(
    userId: string,
    body: UpdateLocationInput,
  ): Promise<{ locationUpdated: boolean }> {
    const exists = await this.repo.findProfileById(userId);
    if (!exists) throw new NotFoundError('Usuario no encontrado');
    const locationUpdated = await this.repo.updateLocationIfMoved(userId, body.lat, body.lng);
    return { locationUpdated };
  }

  async updateSettings(userId: string, body: UpdateUserSettingsInput): Promise<UserProfileDto> {
    const row = await this.repo.updateSettings(userId, {
      alert_radius_km: body.alert_radius_km,
      alerts_enabled: body.alerts_enabled,
    });
    if (!row) throw new NotFoundError('Usuario no encontrado');
    return toDto(row);
  }

  async registerPushToken(userId: string, body: RegisterPushTokenInput): Promise<void> {
    const exists = await this.repo.findProfileById(userId);
    if (!exists) throw new NotFoundError('Usuario no encontrado');
    await this.repo.upsertPushToken(userId, body.token, body.platform);
  }

  async deletePushTokens(userId: string): Promise<void> {
    const exists = await this.repo.findProfileById(userId);
    if (!exists) throw new NotFoundError('Usuario no encontrado');
    await this.repo.deleteAllPushTokensForUser(userId);
  }

  async uploadAvatar(userId: string, file: Express.Multer.File): Promise<{ url: string }> {
    const existing = await this.repo.findProfileById(userId);
    if (!existing) throw new NotFoundError('Usuario no encontrado');

    const { url } = await uploadFile(
      file.buffer,
      `avatars/${userId}`,
      file.originalname,
      file.mimetype,
    );

    if (existing.image) {
      try {
        await deleteFile(existing.image);
      } catch {
        // best-effort
      }
    }

    await this.repo.updateProfile(userId, { image: url });
    return { url };
  }

  async deleteAccount(userId: string): Promise<void> {
    const existing = await this.repo.findProfileById(userId);
    if (!existing) throw new NotFoundError('Usuario no encontrado');
    await this.repo.softDeleteUser(userId);
    if (existing.image) {
      try {
        await deleteFile(existing.image);
      } catch {
        // best-effort
      }
    }
  }
}
