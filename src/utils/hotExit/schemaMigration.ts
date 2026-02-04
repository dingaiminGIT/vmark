/**
 * Schema Migration for Hot Exit Sessions
 *
 * Provides migration functions to upgrade old session formats to the current schema.
 * This ensures users don't lose their session data when the app updates.
 *
 * Migration Strategy:
 * - Sessions at current version pass through unchanged
 * - Older sessions are migrated step-by-step (v1 -> v2 -> v3 -> current)
 * - Future sessions (higher version) cannot be migrated (fail gracefully)
 * - Version 0 is invalid and rejected
 */

import type { SessionData } from './types';

/** Current schema version - must match types.ts and Rust session.rs */
export const SCHEMA_VERSION = 1;

/** Minimum supported version for migration */
const MIN_SUPPORTED_VERSION = 1;

/**
 * Type for migration functions.
 * Each migration takes a session and returns the upgraded version.
 */
type MigrationFn = (session: SessionData) => SessionData;

/**
 * Registry of migration functions.
 * Key is the source version, value migrates from that version to the next.
 *
 * Example when we have v2:
 * migrations[1] = (session) => migrateV1toV2(session)
 * migrations[2] = (session) => migrateV2toV3(session)
 */
const migrations: Record<number, MigrationFn> = {
  // Currently no migrations needed since we're at v1
  // When we add v2, add: 1: migrateV1toV2
};

/**
 * Check if a session version can be migrated to current version.
 *
 * @param version - The session's schema version
 * @returns true if migration is possible
 */
export function canMigrate(version: number): boolean {
  // Invalid version
  if (version < MIN_SUPPORTED_VERSION) {
    return false;
  }

  // Current or older (can migrate)
  if (version <= SCHEMA_VERSION) {
    return true;
  }

  // Future version - cannot migrate
  return false;
}

/**
 * Migrate a session to the current schema version.
 *
 * @param session - Session data to migrate
 * @returns Migrated session at current version
 * @throws Error if migration is not possible
 */
export function migrateSession(session: SessionData): SessionData {
  // Validate version
  if (!canMigrate(session.version)) {
    throw new Error(
      `Cannot migrate session from version ${session.version} to ${SCHEMA_VERSION}. ` +
      `Supported versions: ${MIN_SUPPORTED_VERSION} to ${SCHEMA_VERSION}`
    );
  }

  // Already at current version - return as-is
  if (session.version === SCHEMA_VERSION) {
    return session;
  }

  // Apply migrations step by step
  let current = { ...session };

  while (current.version < SCHEMA_VERSION) {
    const migrateFn = migrations[current.version];

    if (!migrateFn) {
      // No migration function - just bump version
      // This handles the case where schema is compatible but version differs
      current = {
        ...current,
        version: current.version + 1,
      };
    } else {
      // Apply migration
      current = migrateFn(current);
    }
  }

  return current;
}

/**
 * Check if session needs migration.
 *
 * @param session - Session to check
 * @returns true if session version is older than current
 */
export function needsMigration(session: SessionData): boolean {
  return session.version < SCHEMA_VERSION;
}

// =============================================================================
// Migration Functions
// =============================================================================
// Add migration functions here as we evolve the schema.
// Each function should:
// 1. Take a session at version N
// 2. Return a session at version N+1
// 3. Add default values for new fields
// 4. Transform data structures as needed

/**
 * Example migration template for v1 -> v2 (when needed):
 *
 * function migrateV1toV2(session: SessionDataV1): SessionData {
 *   return {
 *     ...session,
 *     version: 2,
 *     // Add new fields with defaults
 *     newField: 'default_value',
 *     // Transform existing fields if needed
 *     windows: session.windows.map(w => ({
 *       ...w,
 *       newWindowField: false,
 *     })),
 *   };
 * }
 */
