import {
  LostReportRepository,
  NearbyLostReportRow,
  LostReportRow,
  LostReportDetailRow,
  SightingRow,
} from '../repositories/lost-report.repository';
import { PetRepository } from '../repositories/pet.repository';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import { ExpoPushService } from './expo-push.service';
import { uploadFile } from './storage.service';

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
  reporter: { id: string; name: string; image: string | null };
  photos: string[];
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
    reporter: { id: row.reporter_id, name: row.reporter_name, image: row.reporter_image },
    photos: row.photos ?? [],
    message: row.message,
    seenAt: new Date(row.seen_at).toISOString(),
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

  async addSighting(params: {
    reportId: string;
    reporterId: string;
    lat: number;
    lng: number;
    message?: string;
    files: Express.Multer.File[];
  }): Promise<{ id: string }> {
    const report = await this.repo.findById(params.reportId);
    if (!report) throw new NotFoundError('Lost report not found');
    if (report.status !== 'active') throw new NotFoundError('Lost report not found');

    const uploads = await Promise.all(
      (params.files ?? []).map((file) =>
        uploadFile(file.buffer, `sightings/${params.reportId}`, file.originalname, file.mimetype),
      ),
    );
    const photos = uploads.map((u) => u.url);

    return this.repo.createSighting({
      reportId: params.reportId,
      reporterId: params.reporterId,
      lat: params.lat,
      lng: params.lng,
      message: params.message,
      photos,
    });
  }

  async resolve(params: { reportId: string; userId: string }): Promise<void> {
    const report = await this.repo.findById(params.reportId);
    if (!report) throw new NotFoundError('Lost report not found');
    if (report.user_id !== params.userId) throw new ForbiddenError();
    await this.repo.resolveReport(params.reportId);
  }
}
