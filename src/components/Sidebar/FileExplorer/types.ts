export interface FileNode {
  id: string; // Full path
  name: string; // Display name (without extension for .md files)
  isFolder: boolean;
  children?: FileNode[];
}

export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isHidden: boolean;
}

/**
 * File system change event from watcher.
 * Includes watchId to scope events to their originating watcher.
 */
export interface FsChangeEvent {
  /** Unique identifier for this watcher (window label) */
  watchId: string;
  /** Root path being watched */
  rootPath: string;
  /** Changed paths (may be multiple for batch operations) */
  paths: string[];
  /** Event kind */
  kind: "create" | "modify" | "remove" | "rename";
}
