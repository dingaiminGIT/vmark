/**
 * WebSocketBridge - Real WebSocket connection to VMark.
 *
 * Implements the Bridge interface for production use.
 * Connects to VMark's WebSocket server and relays MCP commands.
 */

import WebSocket from 'ws';
import type { Bridge, BridgeRequest, BridgeResponse } from './types.js';

/**
 * Logger interface for WebSocketBridge.
 * Compatible with console, pino, winston, etc.
 */
export interface Logger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

/**
 * Default no-op logger (silent).
 */
const nullLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

/**
 * Configuration for WebSocketBridge.
 */
export interface WebSocketBridgeConfig {
  /** Host to connect to (default: localhost) */
  host?: string;
  /** Port to connect to (default: 9224) */
  port?: number;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** Whether to auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Maximum reconnection attempts (default: 10) */
  maxReconnectAttempts?: number;
  /** Base delay between reconnection attempts in ms (default: 1000) */
  reconnectDelay?: number;
  /** Maximum reconnection delay in ms (default: 30000) */
  maxReconnectDelay?: number;
  /** Optional logger for debugging (default: silent) */
  logger?: Logger;
}

/**
 * Pending request waiting for response.
 */
interface PendingRequest {
  resolve: (response: BridgeResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Message format for WebSocket communication.
 */
interface WsMessage {
  id: string;
  type: 'request' | 'response';
  payload: BridgeRequest | BridgeResponse;
}

/**
 * WebSocketBridge connects to VMark via WebSocket.
 */
export class WebSocketBridge implements Bridge {
  private readonly host: string;
  private readonly port: number;
  private readonly timeout: number;
  private readonly autoReconnect: boolean;
  private readonly maxReconnectAttempts: number;
  private readonly reconnectDelay: number;
  private readonly maxReconnectDelay: number;
  private readonly logger: Logger;

  private ws: WebSocket | null = null;
  private connected = false;
  private connecting = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private requestId = 0;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private connectionCallbacks: Set<(connected: boolean) => void> = new Set();
  private intentionalDisconnect = false;

  constructor(config: WebSocketBridgeConfig = {}) {
    this.host = config.host ?? 'localhost';
    this.port = config.port ?? 9224;
    this.timeout = config.timeout ?? 30000;
    this.autoReconnect = config.autoReconnect ?? true;
    this.maxReconnectAttempts = config.maxReconnectAttempts ?? 10;
    this.reconnectDelay = config.reconnectDelay ?? 1000;
    this.maxReconnectDelay = config.maxReconnectDelay ?? 30000;
    this.logger = config.logger ?? nullLogger;
  }

  /**
   * Get the WebSocket URL.
   */
  private get url(): string {
    return `ws://${this.host}:${this.port}`;
  }

  /**
   * Generate a unique request ID.
   */
  private nextRequestId(): string {
    return `req_${++this.requestId}_${Date.now()}`;
  }

  /**
   * Connect to VMark WebSocket server.
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    if (this.connecting) {
      // Wait for existing connection attempt
      return new Promise((resolve, reject) => {
        const checkConnection = () => {
          if (this.connected) {
            resolve();
          } else if (!this.connecting) {
            reject(new Error('Connection failed'));
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
      });
    }

    this.connecting = true;
    this.intentionalDisconnect = false;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        const connectionTimeout = setTimeout(() => {
          if (!this.connected) {
            this.ws?.close();
            this.connecting = false;
            reject(new Error(`Connection timeout to ${this.url}`));
          }
        }, this.timeout);

        this.ws.on('open', () => {
          clearTimeout(connectionTimeout);
          this.connected = true;
          this.connecting = false;
          this.reconnectAttempts = 0;
          this.notifyConnectionChange(true);
          resolve();
        });

        this.ws.on('message', (data: WebSocket.RawData) => {
          this.handleMessage(data);
        });

        this.ws.on('close', () => {
          this.handleDisconnect();
        });

        this.ws.on('error', (error: Error) => {
          clearTimeout(connectionTimeout);
          if (!this.connected) {
            this.connecting = false;
            reject(new Error(`WebSocket error: ${error.message}`));
          }
          // If already connected, error will trigger close event
        });
      } catch (error) {
        this.connecting = false;
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Disconnect from VMark.
   */
  async disconnect(): Promise<void> {
    this.intentionalDisconnect = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      // Reject all pending requests
      for (const [id, pending] of this.pendingRequests) {
        clearTimeout(pending.timer);
        pending.reject(new Error('Connection closed'));
        this.pendingRequests.delete(id);
      }

      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      this.ws = null;
    }

    this.connected = false;
    this.connecting = false;
    this.notifyConnectionChange(false);
  }

  /**
   * Check if connected.
   */
  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Send a request to VMark.
   */
  async send<T = unknown>(
    request: BridgeRequest
  ): Promise<BridgeResponse & { data: T }> {
    if (!this.isConnected()) {
      throw new Error('Not connected to VMark');
    }

    const id = this.nextRequestId();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${request.type}`));
      }, this.timeout);

      this.pendingRequests.set(id, {
        resolve: resolve as (response: BridgeResponse) => void,
        reject,
        timer,
      });

      const message: WsMessage = {
        id,
        type: 'request',
        payload: request,
      };

      try {
        this.ws!.send(JSON.stringify(message));
      } catch (error) {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Subscribe to connection state changes.
   */
  onConnectionChange(callback: (connected: boolean) => void): () => void {
    this.connectionCallbacks.add(callback);
    return () => this.connectionCallbacks.delete(callback);
  }

  /**
   * Handle incoming WebSocket message.
   */
  private handleMessage(data: WebSocket.RawData): void {
    try {
      const message = JSON.parse(data.toString()) as WsMessage;

      if (message.type !== 'response') {
        this.logger.warn('Received non-response message:', message.type);
        return;
      }

      const pending = this.pendingRequests.get(message.id);
      if (!pending) {
        this.logger.warn('Received response for unknown request:', message.id);
        return;
      }

      clearTimeout(pending.timer);
      this.pendingRequests.delete(message.id);
      pending.resolve(message.payload as BridgeResponse);
    } catch (error) {
      this.logger.error('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * Handle WebSocket disconnect.
   */
  private handleDisconnect(): void {
    const wasConnected = this.connected;
    this.connected = false;
    this.ws = null;

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Connection lost'));
      this.pendingRequests.delete(id);
    }

    if (wasConnected) {
      this.notifyConnectionChange(false);
    }

    // Auto-reconnect if enabled and not intentional
    if (
      this.autoReconnect &&
      !this.intentionalDisconnect &&
      this.reconnectAttempts < this.maxReconnectAttempts
    ) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule a reconnection attempt.
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    this.reconnectAttempts++;
    this.logger.debug(
      `Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`
    );

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;

      try {
        await this.connect();
        this.logger.info('Reconnected successfully');
      } catch (error) {
        this.logger.debug(
          `Reconnect attempt ${this.reconnectAttempts} failed:`,
          error instanceof Error ? error.message : error
        );
        // handleDisconnect will schedule next attempt if attempts remain
      }
    }, delay);
  }

  /**
   * Notify connection state change.
   */
  private notifyConnectionChange(connected: boolean): void {
    for (const callback of this.connectionCallbacks) {
      try {
        callback(connected);
      } catch (error) {
        this.logger.error('Connection callback error:', error);
      }
    }
  }
}
