import {
  LostReportRepository,
  NearbyLostReportRow,
  LostReportRow,
} from '../repositories/lost-report.repository';
import { PetRepository } from '../repositories/pet.repository';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import { ExpoPushService } from './expo-push.service';

export interface NearbyLostReportDto {
  id: string;
  petId: string;
  userId: string;
  lastSeenAt: string;
  status: 'active' | 'resolved';
  message: string | null;
  species: NearbyLostReportRow['species'];
  /** Campo virtual: distancia al punto consultado (m). */
  distance: number;
}

function toNearbyDto(row: NearbyLostReportRow): NearbyLostReportDto {
  return {
    id: row.id,
    petId: row.pet_id,
    userId: row.user_id,
    lastSeenAt: new Date(row.last_seen_at).toISOString(),
    status: row.status,
    message: row.message,
    species: row.species,
    distance: row.distance_meters,
  };
}

export class LostReportService {
  private repo: LostReportRepository;
  private pets: PetRepository;
  private push: ExpoPushService;

  constructor(repo?: LostReportRepository) {
    this.repo = repo ?? new LostReportRepository();
    this.pets = new PetRepository();
    this.push = new ExpoPushService(this.repo);
  }

  async nearby(params: {
    lat: number;
    lng: number;
    radiusKm: number;
    species?: NearbyLostReportRow['species'];
  }): Promise<NearbyLostReportDto[]> {
    const rows = await this.repo.findNearby(params);
    return rows.map(toNearbyDto);
  }

  async createLostReport(params: {
    userId: string;
    petId: string;
    lat: number;
    lng: number;
    lastSeenAt: Date;
    message?: string;
  }): Promise<LostReportRow> {
    const pet = await this.pets.findById(params.petId);
    if (!pet) throw new NotFoundError('Pet not found');
    if (pet.user_id !== params.userId) throw new ForbiddenError();

    const created = await this.repo.create({
      petId: params.petId,
      userId: params.userId,
      lat: params.lat,
      lng: params.lng,
      lastSeenAt: params.lastSeenAt,
      message: params.message,
    });

    // Background: no bloquear respuesta HTTP
    setImmediate(() => {
      void this.push
        .notifyLostReportNearby({
          reportId: created.id,
          lat: params.lat,
          lng: params.lng,
          excludeUserId: params.userId,
          radiusMeters: 10_000,
        })
        .catch(() => {
          // swallow en background; el logger ya registra fallos internos
        });
    });

    return created;
  }
}
