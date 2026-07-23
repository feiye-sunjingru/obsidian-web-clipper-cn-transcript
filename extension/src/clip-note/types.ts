export type ClipNoteProvider = 'bcut' | 'faster-whisper';
export type WhisperModelSize = 'tiny' | 'base' | 'small' | 'medium' | 'large-v3' | 'large-v3-turbo';
export type CookieMode = 'off' | 'browser' | 'manual';
export type CookieStatus = 'empty' | 'ready' | 'stale' | 'invalid';
export type ClipNotePlatform = 'bilibili' | 'youtube';

export interface ClipNoteGeneralSettings {
	enabled: boolean;
}

export interface ClipNoteAsrSettings {
	provider: ClipNoteProvider;
	whisperModel: WhisperModelSize;
}

export interface StoredCookie {
	domain: string;
	name: string;
	value: string;
	path: string;
	secure: boolean;
	expirationDate?: number;
	httpOnly?: boolean;
}

export interface PlatformCookieConfig {
	mode: CookieMode;
	cookies: StoredCookie[];
	updatedAt: number | null;
	lastValidatedAt: number | null;
	status: CookieStatus;
}

export interface ClipNoteCookieSettings {
	bilibili: PlatformCookieConfig;
	youtube: PlatformCookieConfig;
}

export interface TranscriptSegment {
	start: number;
	end: number;
	text: string;
}

export interface TranscriptResult {
	language: string;
	fullText: string;
	segments: TranscriptSegment[];
	source: 'platform' | 'bcut' | 'faster-whisper';
}

export type ClipNoteJobStatus = 'queued' | 'downloading' | 'transcribing' | 'completed' | 'failed';

export interface ClipNoteJobState {
	taskId: string;
	url: string;
	videoKey: string;
	provider: ClipNoteProvider;
	status: ClipNoteJobStatus;
	stage: string;
	startedAt: number;
	updatedAt: number;
	result?: TranscriptResult;
	error?: string;
}

export interface HelperHealth {
	status: 'ok';
	version: string;
	idleTimeoutSeconds: number;
	capabilities: Record<string, boolean>;
}
