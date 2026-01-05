export type LanguageCode = 'en-US' | 'fr-FR' | 'es-ES' | 'zh-CN';

export interface TrackDescriptor {
  speakerId: string;
  language: LanguageCode;
  trackLabel: string; // e.g., `${speakerId}:${language}`
}

export type PipelineState = 'starting' | 'active' | 'stopping' | 'stopped' | 'error';


