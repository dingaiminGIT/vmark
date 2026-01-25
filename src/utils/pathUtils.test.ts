/**
 * Tests for cross-platform path utilities.
 */

import { describe, it, expect } from "vitest";
import {
  getFileName,
  getFileNameWithoutExtension,
  getDirectory,
  joinPath,
} from "./pathUtils";

describe("getFileName", () => {
  describe("POSIX paths", () => {
    it("extracts filename from absolute path", () => {
      expect(getFileName("/Users/john/documents/file.md")).toBe("file.md");
    });

    it("extracts filename from relative path", () => {
      expect(getFileName("folder/subfolder/file.txt")).toBe("file.txt");
    });

    it("returns the input if no slashes", () => {
      expect(getFileName("file.md")).toBe("file.md");
    });

    it("handles trailing slash", () => {
      expect(getFileName("/path/to/folder/")).toBe("");
    });
  });

  describe("Windows paths", () => {
    it("extracts filename from Windows absolute path", () => {
      expect(getFileName("C:\\Users\\john\\documents\\file.md")).toBe("file.md");
    });

    it("extracts filename from Windows relative path", () => {
      expect(getFileName("folder\\subfolder\\file.txt")).toBe("file.txt");
    });

    it("handles trailing backslash", () => {
      expect(getFileName("C:\\path\\to\\folder\\")).toBe("");
    });
  });

  describe("mixed separators", () => {
    it("handles mixed slashes preferring the last separator", () => {
      // Takes the rightmost separator regardless of type
      expect(getFileName("/path\\to/file.md")).toBe("file.md");
      expect(getFileName("C:\\path/to\\file.md")).toBe("file.md");
    });
  });
});

describe("getFileNameWithoutExtension", () => {
  it("removes extension from filename", () => {
    expect(getFileNameWithoutExtension("/path/file.md")).toBe("file");
  });

  it("handles multiple dots", () => {
    expect(getFileNameWithoutExtension("/path/file.test.ts")).toBe("file.test");
  });

  it("handles no extension", () => {
    expect(getFileNameWithoutExtension("/path/README")).toBe("README");
  });

  it("handles hidden files (dot prefix)", () => {
    expect(getFileNameWithoutExtension("/path/.gitignore")).toBe(".gitignore");
  });

  it("handles Windows paths", () => {
    expect(getFileNameWithoutExtension("C:\\Users\\file.docx")).toBe("file");
  });

  it("returns input if no path separators and no extension", () => {
    expect(getFileNameWithoutExtension("Makefile")).toBe("Makefile");
  });
});

describe("getDirectory", () => {
  describe("POSIX paths", () => {
    it("extracts directory from absolute path", () => {
      expect(getDirectory("/Users/john/documents/file.md")).toBe("/Users/john/documents");
    });

    it("extracts directory from relative path", () => {
      expect(getDirectory("folder/subfolder/file.txt")).toBe("folder/subfolder");
    });

    it("returns empty string for filename only", () => {
      expect(getDirectory("file.md")).toBe("");
    });

    it("handles root path", () => {
      expect(getDirectory("/file.md")).toBe("");
    });
  });

  describe("Windows paths", () => {
    it("extracts directory from Windows absolute path", () => {
      expect(getDirectory("C:\\Users\\john\\file.md")).toBe("C:\\Users\\john");
    });

    it("extracts directory from Windows relative path", () => {
      expect(getDirectory("folder\\subfolder\\file.txt")).toBe("folder\\subfolder");
    });

    it("handles drive root", () => {
      expect(getDirectory("C:\\file.md")).toBe("C:");
    });
  });
});

describe("joinPath", () => {
  describe("POSIX paths", () => {
    it("joins directory and filename", () => {
      expect(joinPath("/Users/john", "file.md")).toBe("/Users/john/file.md");
    });

    it("handles trailing slash in directory", () => {
      expect(joinPath("/Users/john/", "file.md")).toBe("/Users/john/file.md");
    });

    it("returns filename if directory is empty", () => {
      expect(joinPath("", "file.md")).toBe("file.md");
    });
  });

  describe("Windows paths", () => {
    it("joins directory and filename with backslash", () => {
      expect(joinPath("C:\\Users\\john", "file.md")).toBe("C:\\Users\\john\\file.md");
    });

    it("handles trailing backslash in directory", () => {
      expect(joinPath("C:\\Users\\john\\", "file.md")).toBe("C:\\Users\\john\\file.md");
    });

    it("detects Windows path by backslash presence", () => {
      expect(joinPath("folder\\subfolder", "file.md")).toBe("folder\\subfolder\\file.md");
    });
  });

  describe("edge cases", () => {
    it("uses forward slash as default separator", () => {
      expect(joinPath("folder", "file.md")).toBe("folder/file.md");
    });

    it("handles single segment directory", () => {
      expect(joinPath("folder", "file.txt")).toBe("folder/file.txt");
    });
  });
});
