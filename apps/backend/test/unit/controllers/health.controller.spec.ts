/**
 * ============================================================================
 * SMART_RETAIL - HealthController Tests
 * ============================================================================
 * Tests unitarios para el controlador de health checks.
 * ============================================================================
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import {
    HealthController,
    metricsStore,
} from '../../../src/infrastructure/controllers/health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let mockResponse: Partial<Response>;

  beforeEach(async () => {
    // Reset metrics store before each test
    metricsStore.reset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: 'DATABASE_CONNECTION', useValue: null },
        { provide: 'REDIS_CLIENT', useValue: null },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getHealth (liveness)
  // ─────────────────────────────────────────────────────────────────────────

  describe('getHealth', () => {
    it('should return ok status', () => {
      const result = controller.getHealth();

      expect(result.status).toBe('ok');
    });

    it('should return timestamp', () => {
      const result = controller.getHealth();

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should return version', () => {
      const result = controller.getHealth();

      expect(result.version).toBeDefined();
      expect(typeof result.version).toBe('string');
    });

    it('should return uptime in seconds', () => {
      const result = controller.getHealth();

      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(typeof result.uptime).toBe('number');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getReady (readiness)
  // ─────────────────────────────────────────────────────────────────────────

  describe('getReady', () => {
    it('should return 200 when all checks pass', async () => {
      await controller.getReady(mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ok',
          checks: {
            database: 'ok',
            redis: 'ok',
          },
        }),
      );
    });

    it('should include timestamp and version', async () => {
      await controller.getReady(mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String),
          version: expect.any(String),
          uptime: expect.any(Number),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getMetrics
  // ─────────────────────────────────────────────────────────────────────────

  describe('getMetrics', () => {
    it('should set content-type header', () => {
      controller.getMetrics(mockResponse as Response);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/plain; charset=utf-8',
      );
    });

    it('should return Prometheus format', () => {
      controller.getMetrics(mockResponse as Response);

      const output = (mockResponse.send as jest.Mock).mock.calls[0][0];

      expect(output).toContain('# HELP');
      expect(output).toContain('# TYPE');
      expect(output).toContain('smart_retail_http_requests_total');
    });

    it('should include all metrics', () => {
      controller.getMetrics(mockResponse as Response);

      const output = (mockResponse.send as jest.Mock).mock.calls[0][0];

      expect(output).toContain('smart_retail_http_requests_total');
      expect(output).toContain('smart_retail_transactions_total');
      expect(output).toContain('smart_retail_transactions_successful_total');
      expect(output).toContain('smart_retail_transactions_failed_total');
      expect(output).toContain('smart_retail_active_connections');
      expect(output).toContain('smart_retail_queue_size');
      expect(output).toContain('smart_retail_latency_p50_ms');
      expect(output).toContain('smart_retail_latency_p90_ms');
      expect(output).toContain('smart_retail_latency_p95_ms');
      expect(output).toContain('smart_retail_latency_p99_ms');
      expect(output).toContain('smart_retail_uptime_seconds');
      expect(output).toContain('smart_retail_info');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // MetricsStore
  // ─────────────────────────────────────────────────────────────────────────

  describe('MetricsStore', () => {
    it('should increment http requests', () => {
      metricsStore.incrementHttpRequests();
      metricsStore.incrementHttpRequests();

      const metrics = metricsStore.getMetrics();
      expect(metrics.httpRequestsTotal).toBe(2);
    });

    it('should track successful transactions', () => {
      metricsStore.incrementTransactions(true);
      metricsStore.incrementTransactions(true);

      const metrics = metricsStore.getMetrics();
      expect(metrics.transactionsTotal).toBe(2);
      expect(metrics.transactionsSuccessful).toBe(2);
      expect(metrics.transactionsFailed).toBe(0);
    });

    it('should track failed transactions', () => {
      metricsStore.incrementTransactions(false);

      const metrics = metricsStore.getMetrics();
      expect(metrics.transactionsFailed).toBe(1);
    });

    it('should set active connections', () => {
      metricsStore.setConnections(42);

      const metrics = metricsStore.getMetrics();
      expect(metrics.activeConnections).toBe(42);
    });

    it('should set queue size', () => {
      metricsStore.setQueueSize(100);

      const metrics = metricsStore.getMetrics();
      expect(metrics.queueSize).toBe(100);
    });

    it('should calculate latency percentiles', () => {
      // Add latency samples
      for (let i = 1; i <= 100; i++) {
        metricsStore.recordLatency(i);
      }

      const metrics = metricsStore.getMetrics();
      
      expect(metrics.latencyP50).toBeGreaterThan(0);
      expect(metrics.latencyP90).toBeGreaterThan(metrics.latencyP50);
      expect(metrics.latencyP95).toBeGreaterThan(metrics.latencyP90);
      expect(metrics.latencyP99).toBeGreaterThan(metrics.latencyP95);
    });

    it('should return 0 for percentiles when no latencies recorded', () => {
      const metrics = metricsStore.getMetrics();

      expect(metrics.latencyP50).toBe(0);
      expect(metrics.latencyP90).toBe(0);
      expect(metrics.latencyP95).toBe(0);
      expect(metrics.latencyP99).toBe(0);
    });

    it('should reset all metrics', () => {
      metricsStore.incrementHttpRequests();
      metricsStore.incrementTransactions(true);
      metricsStore.setConnections(10);
      metricsStore.recordLatency(100);

      metricsStore.reset();

      const metrics = metricsStore.getMetrics();
      expect(metrics.httpRequestsTotal).toBe(0);
      expect(metrics.transactionsTotal).toBe(0);
      expect(metrics.activeConnections).toBe(0);
      expect(metrics.latencyP50).toBe(0);
    });
  });
});
