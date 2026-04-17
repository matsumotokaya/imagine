const DEFAULT_THE_CLUB_R2_BASE_URL =
  'https://pub-9339dc326a024891a297479881e66962.r2.dev';

const rawBaseUrl =
  import.meta.env.VITE_THE_CLUB_R2_BASE_URL || DEFAULT_THE_CLUB_R2_BASE_URL;
const THE_CLUB_R2_BASE_URL = rawBaseUrl.endsWith('/')
  ? rawBaseUrl.slice(0, -1)
  : rawBaseUrl;

const SNAPSHOT_LATEST_EPISODE = 420;
const SNAPSHOT_COUNT = 50;

export const THE_CLUB_ENTRY_URL = 'https://whatif-ep.xyz/the-club';

export interface ClubThumbnailPreview {
  id: string;
  label: string;
  thumbnailUrlJpg: string;
  thumbnailUrlPng: string;
}

export const THE_CLUB_THUMBNAILS: ClubThumbnailPreview[] = Array.from(
  { length: SNAPSHOT_COUNT },
  (_, index) => SNAPSHOT_LATEST_EPISODE - index,
)
  .filter((episodeNumber) => episodeNumber > 0)
  .map((episodeNumber) => {
    const coverNumber = String(episodeNumber).padStart(4, '0');
    return {
      id: coverNumber,
      label: `EP ${coverNumber}`,
      thumbnailUrlJpg: `${THE_CLUB_R2_BASE_URL}/club/wallpapers/${coverNumber}/cover.jpg`,
      thumbnailUrlPng: `${THE_CLUB_R2_BASE_URL}/club/wallpapers/${coverNumber}/cover.png`,
    };
  });
