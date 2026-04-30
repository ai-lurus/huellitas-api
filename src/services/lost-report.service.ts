import { LostReportRepository, NearbyLostReportRow } from '../repositories/lost-report.repository';

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

  constructor(repo?: LostReportRepository) {
    this.repo = repo ?? new LostReportRepository();
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
}
