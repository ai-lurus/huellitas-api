import {
  UserRepository,
  UserProfileRow,
  UpdateUserProfileData,
} from '../repositories/user.repository';
import { uploadFile } from './storage.service';
import { NotFoundError } from '../utils/errors';
import { PatchUserProfileInput } from '../schemas/user.schemas';

export interface UserProfileDto {
  id: string;
  name: string;
  email: string;
  image: string | null;
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;
  alertsEnabled: boolean;
  alertRadiusKm: number;
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
    const data: UpdateUserProfileData = {
      name: body.name,
      image: body.image,
      onboardingCompleted: body.onboardingCompleted,
      alertsEnabled: body.alertsEnabled,
      location: body.location,
    };
    const row = await this.repo.updateProfile(userId, data);
    if (!row) throw new NotFoundError('Usuario no encontrado');
    return toDto(row);
  }

  async uploadAvatar(userId: string, file: Express.Multer.File): Promise<{ url: string }> {
    const existing = await this.repo.findProfileById(userId);
    if (!existing) throw new NotFoundError('Usuario no encontrado');

    const url = await uploadFile(
      file.buffer,
      `avatars/${userId}`,
      file.originalname,
      file.mimetype,
    );

    await this.repo.updateProfile(userId, { image: url });
    return { url };
  }
}
