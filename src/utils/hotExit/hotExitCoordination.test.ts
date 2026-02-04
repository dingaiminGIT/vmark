/**
 * Hot Exit Coordination Tests
 *
 * Tests for coordination between hot exit restore and other startup hooks.
 * Critical: Finder file open must wait for hot exit restore to complete.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  isRestoreInProgress,
  setRestoreInProgress,
  waitForRestoreComplete,
  notifyRestoreComplete,
  resetCoordinationState,
} from './hotExitCoordination';

describe('hotExitCoordination', () => {
  beforeEach(() => {
    // Reset state before each test
    resetCoordinationState();
  });

  describe('isRestoreInProgress', () => {
    it('should return false initially', () => {
      expect(isRestoreInProgress()).toBe(false);
    });

    it('should return true after setRestoreInProgress(true)', () => {
      setRestoreInProgress(true);
      expect(isRestoreInProgress()).toBe(true);
    });

    it('should return false after setRestoreInProgress(false)', () => {
      setRestoreInProgress(true);
      setRestoreInProgress(false);
      expect(isRestoreInProgress()).toBe(false);
    });
  });

  describe('waitForRestoreComplete', () => {
    it('should resolve immediately if restore is not in progress', async () => {
      setRestoreInProgress(false);
      const start = Date.now();
      await waitForRestoreComplete();
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(50); // Should be nearly instant
    });

    it('should wait until restore completes', async () => {
      setRestoreInProgress(true);

      // Start waiting
      const waitPromise = waitForRestoreComplete();

      // Simulate restore completing after 100ms
      setTimeout(() => {
        notifyRestoreComplete();
      }, 100);

      const start = Date.now();
      await waitPromise;
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(90);
      expect(elapsed).toBeLessThan(200);
    });

    it('should handle timeout gracefully', async () => {
      setRestoreInProgress(true);

      // Wait with a short timeout
      const result = await waitForRestoreComplete(50);

      // Should have timed out but not throw
      expect(result).toBe(false); // Indicates timeout
    });

    it('should return true when restore completes normally', async () => {
      setRestoreInProgress(true);

      setTimeout(() => {
        notifyRestoreComplete();
      }, 10);

      const result = await waitForRestoreComplete(1000);
      expect(result).toBe(true);
    });
  });

  describe('notifyRestoreComplete', () => {
    it('should clear the restore in progress flag', () => {
      setRestoreInProgress(true);
      notifyRestoreComplete();
      expect(isRestoreInProgress()).toBe(false);
    });

    it('should resolve all pending waiters', async () => {
      setRestoreInProgress(true);

      // Multiple waiters
      const waiter1 = waitForRestoreComplete();
      const waiter2 = waitForRestoreComplete();
      const waiter3 = waitForRestoreComplete();

      setTimeout(() => {
        notifyRestoreComplete();
      }, 10);

      const results = await Promise.all([waiter1, waiter2, waiter3]);
      expect(results).toEqual([true, true, true]);
    });
  });
});
