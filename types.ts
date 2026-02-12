export interface MangaPage {
  index: number;
  url: string;
  name: string;
}

export interface TranscriptionCache {
  [pageIndex: number]: string;
}

export enum ReaderState {
  IDLE = 'IDLE',
  LOADING_FILE = 'LOADING_FILE',
  READING = 'READING',
}
