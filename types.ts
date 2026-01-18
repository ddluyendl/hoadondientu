
export interface TaxRecord {
  CQT: string;
  MST: string;
  Ten: string;
  SL: number;
  Thue: number;
  TongTien: number;
}

export interface AppMessage {
  type: 'success' | 'error' | '';
  text: string;
}

export enum LoadingState {
  IDLE = 'IDLE',
  FETCHING_DATA = 'FETCHING_DATA',
  SEARCHING = 'SEARCHING',
  AI_ANALYZING = 'AI_ANALYZING'
}
