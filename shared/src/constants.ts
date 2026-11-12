export const DOCUMENT_SCHEMA_VERSION = 1 as const;

export const MIN_CANVAS_DIMENSION = 1;
export const MAX_CANVAS_DIMENSION = 8192;
export const DEFAULT_CANVAS_WIDTH = 1200;
export const DEFAULT_CANVAS_HEIGHT = 800;

export const MAX_PROJECT_NAME_LENGTH = 120;
export const MAX_LAYER_NAME_LENGTH = 120;
export const MAX_LAYERS_PER_DOCUMENT = 500;
export const MAX_DOCUMENT_JSON_BYTES = 5 * 1024 * 1024; // 5 MiB guard against oversized BSON payloads

export const MAX_ASSET_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MiB per asset
export const MAX_ASSET_PIXEL_COUNT = 40_000_000; // 40 megapixels max
export const MAX_ASSET_DIMENSION = 8192;

export const DEFAULT_AUTOSAVE_DEBOUNCE_MS = 1500;
export const DEFAULT_PAGE_LIMIT = 12;
export const MAX_PAGE_LIMIT = 50;

export const ALLOWED_ASSET_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export const ALLOWED_FONT_FAMILIES = [
  'Inter',
  'Roboto',
  'Poppins',
  'Montserrat',
  'Playfair Display',
  'Merriweather',
  'Space Grotesk',
  'JetBrains Mono',
  'Arial',
  'Georgia',
] as const;

export type SaveStatus =
  | 'unsaved_changes'
  | 'saved_on_device'
  | 'saving_to_cloud'
  | 'saved_to_cloud'
  | 'save_failed'
  | 'sign_in_required';

export const SAVE_STATUS_LABELS: Record<SaveStatus, string> = {
  unsaved_changes: 'Unsaved changes',
  saved_on_device: 'Saved on this device',
  saving_to_cloud: 'Saving to cloud',
  saved_to_cloud: 'Saved to cloud',
  save_failed: 'Save failed',
  sign_in_required: 'Sign in required',
};

