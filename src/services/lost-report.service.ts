import {
  LostReportRepository,
  NearbyLostReportRow,
  LostReportRow,
  LostReportDetailRow,
  SightingRow,
} from '../repositories/lost-report.repository';
import { PetRepository } from '../repositories/pet.repository';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { uploadFile } from './storage.service';
import { notificationsService } from './notifications.service';
import { createHash } from 'crypto';

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

export interface SightingDto {
  id: string;
  reporter: { id: string };
  location: { lat: number; lng: number };
  photo: string | null;
  message: string | null;
  seenAt: string;
}

export interface LostReportDetailDto {
  id: string;
  pet: { id: string; name: string; species: LostReportDetailRow['pet_species'] };
  userId: string;
  status: 'active' | 'resolved';
  lastSeenAt: string;
  message: string | null;
  sightings: SightingDto[];
  createdAt: string;
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

function toSightingDto(row: SightingRow): SightingDto {
  return {
    id: row.id,
    reporter: { id: anonymizeReporterId(row.report_id, row.reporter_id) },
    location: { lat: Number(row.lat), lng: Number(row.lng) },
    photo: (row.photos ?? [])[0] ?? null,
    message: row.message,
    seenAt: new Date(row.seen_at).toISOString(),
  };
}

function anonymizeReporterId(reportId: string, reporterId: string): string {
  const h = createHash('sha256').update(`${reportId}:${reporterId}`).digest('hex').slice(0, 16);
  return `anon_${h}`;
}

export class LostReportService {
  private repo: LostReportRepository;
  private pets: PetRepository;

  constructor(repo?: LostReportRepository) {
    this.repo = repo ?? new LostReportRepository();
    this.pets = new PetRepository();
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

  async getDetail(reportId: string): Promise<LostReportDetailDto> {
    const report = await this.repo.findDetailById(reportId);
    if (!report) throw new NotFoundError('Lost report not found');

    const sightings = await this.repo.listSightingsForReport(reportId);

    return {
      id: report.id,
      pet: { id: report.pet_id, name: report.pet_name, species: report.pet_species },
      userId: report.user_id,
      status: report.status,
      lastSeenAt: new Date(report.last_seen_at).toISOString(),
      message: report.message,
      sightings: sightings.map(toSightingDto),
      createdAt: new Date(report.created_at).toISOString(),
    };
  }

  async listSightingsOwnerOnly(params: {
    reportId: string;
    userId: string;
  }): Promise<SightingDto[]> {
    const report = await this.repo.findById(params.reportId);
    if (!report) throw new NotFoundError('Lost report not found');
    if (report.user_id !== params.userId) throw new ForbiddenError();
    const sightings = await this.repo.listSightingsForReport(params.reportId);
    return sightings.map(toSightingDto);
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
      void notificationsService
        .sendLostPetAlert({
          reportId: created.id,
          petName: pet.name,
          ownerId: params.userId,
          lat: params.lat,
          lng: params.lng,
          radiusMeters: 10_000,
        })
        .catch(() => {});
    });

    return created;
  }

  async addSighting(params: {
    reportId: string;
    reporterId: string;
    lat: number;
    lng: number;
    message?: string;
    files: Express.Multer.File[];
  }): Promise<SightingDto> {
    const report = await this.repo.findDetailById(params.reportId);
    if (!report) throw new NotFoundError('Lost report not found');
    if (report.status !== 'active') throw new ValidationError('Lost report is resolved');

    const created = await this.repo.createSighting({
      reportId: params.reportId,
      reporterId: params.reporterId,
      lat: params.lat,
      lng: params.lng,
      message: params.message,
    });

    const uploads = await Promise.all(
      (params.files ?? []).map((file) =>
        uploadFile(file.buffer, `sightings/${created.id}`, file.originalname, file.mimetype),
      ),
    );
    const photos = uploads.map((u) => u.url);
    if (photos.length) {
      await this.repo.updateSightingPhotos({ sightingId: created.id, photos });
    }

    // Background push al dueño (FCM)
    setImmediate(() => {
      void notificationsService
        .sendSightingNotification({
          ownerId: report.user_id,
          petName: report.pet_name,
          reportId: report.id,
        })
        .catch(() => {});
    });

    return {
      id: created.id,
      reporter: { id: anonymizeReporterId(params.reportId, params.reporterId) },
      location: { lat: Number(created.lat), lng: Number(created.lng) },
      photo: photos[0] ?? null,
      message: created.message,
      seenAt: new Date(created.seen_at).toISOString(),
    };
  }

  async resolve(params: { reportId: string; userId: string }): Promise<void> {
    const report = await this.repo.findById(params.reportId);
    if (!report) throw new NotFoundError('Lost report not found');
    if (report.user_id !== params.userId) throw new ForbiddenError();
    await this.repo.resolveReport(params.reportId);
  }
}
