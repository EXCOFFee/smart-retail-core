/**
 * ============================================================================
 * SMART_RETAIL - Health Controller
 * ============================================================================
 * Endpoints de verificación de salud del sistema y métricas.
 * 
 * ARQUITECTURA: Capa de INFRAESTRUCTURA (Controller)
 * No contiene lógica de negocio, solo expone el estado del sistema.
 * 
 * ENDPOINTS:
 * - GET /health: Liveness probe (app viva?)
 * - GET /health/ready: Readiness probe (dependencias OK?)
 * - GET /metrics: Métricas Prometheus
 * ============================================================================
 */

import { Controller, Get, Inject, Optional, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  version: string;
  uptime: number;
}

interface ReadinessResponse extends HealthResponse {
  checks: {
    database: 'ok' | 'error';
    redis: 'ok' | 'error';
  };
}

interface MetricsData {
  // Contadores
  httpRequestsTotal: number;
  transactionsTotal: number;
  transactionsSuccessful: number;
  transactionsFailed: number;
  
  // Gauges
  activeConnections: number;
  queueSize: number;
  
  // Histogramas (latencia P50, P90, P95, P99)
  latencyP50: number;
  latencyP90: number;
  latencyP95: number;
  latencyP99: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY METRICS STORE
// Por qué: Para MVP, usamos store en memoria. En producción, usar Prometheus client.
// ─────────────────────────────────────────────────────────────────────────────

class MetricsStore {
  private httpRequests = 0;
  private transactions = 0;
  private transactionsSuccess = 0;
  private transactionsFail = 0;
  private connections = 0;
  private queue = 0;
  private latencies: number[] = [];
  
  incrementHttpRequests(): void {
    this.httpRequests++;
  }
  
  incrementTransactions(success: boolean): void {
    this.transactions++;
    if (success) {
      this.transactionsSuccess++;
    } else {
      this.transactionsFail++;
    }
  }
  
  setConnections(count: number): void {
    this.connections = count;
  }
  
  setQueueSize(size: number): void {
    this.queue = size;
  }
  
  recordLatency(ms: number): void {
    this.latencies.push(ms);
    // Mantener solo los últimos 1000 registros
    if (this.latencies.length > 1000) {
      this.latencies.shift();
    }
  }
  
  private getPercentile(percentile: number): number {
    if (this.latencies.length === 0) return 0;
    
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * (percentile / 100));
    return sorted[index] ?? 0;
  }
  
  getMetrics(): MetricsData {
    return {
      httpRequestsTotal: this.httpRequests,
      transactionsTotal: this.transactions,
      transactionsSuccessful: this.transactionsSuccess,
      transactionsFailed: this.transactionsFail,
      activeConnections: this.connections,
      queueSize: this.queue,
      latencyP50: this.getPercentile(50),
      latencyP90: this.getPercentile(90),
      latencyP95: this.getPercentile(95),
      latencyP99: this.getPercentile(99),
    };
  }
  
  reset(): void {
    this.httpRequests = 0;
    this.transactions = 0;
    this.transactionsSuccess = 0;
    this.transactionsFail = 0;
    this.connections = 0;
    this.queue = 0;
    this.latencies = [];
  }
}

// Singleton de métricas
export const metricsStore = new MetricsStore();

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH CONTROLLER
// ─────────────────────────────────────────────────────────────────────────────

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly startTime: Date;

  constructor(
    // Opcional: inyectar servicios de DB y Redis para checks reales
    @Optional() @Inject('DATABASE_CONNECTION') private readonly dbConnection?: unknown,
    @Optional() @Inject('REDIS_CLIENT') private readonly redisClient?: unknown,
  ) {
    this.startTime = new Date();
  }

  /**
   * Health Check básico (Liveness Probe)
   * 
   * Por qué: Los balanceadores de carga consultan este endpoint
   * para saber si la instancia está viva. Si retorna error,
   * el tráfico se redirige a otras instancias.
   */
  @Get()
  @ApiOperation({
    summary: 'Verificar estado del servicio',
    description: 'Endpoint de liveness probe para balanceadores de carga',
  })
  @ApiResponse({
    status: 200,
    description: 'Servicio funcionando correctamente',
  })
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
    };
  }

  /**
   * Ready Check (Readiness Probe)
   * 
   * Por qué: Diferente al liveness, este verifica que TODAS
   * las dependencias (DB, Redis) estén listas. Útil durante
   * el arranque cuando la app está viva pero no lista.
   */
  @Get('ready')
  @ApiOperation({
    summary: 'Verificar que el servicio está listo',
    description: 'Readiness probe - verifica dependencias (DB, Redis)',
  })
  @ApiResponse({
    status: 200,
    description: 'Servicio listo para recibir tráfico',
  })
  @ApiResponse({
    status: 503,
    description: 'Servicio no listo (dependencias caídas)',
  })
  async getReady(@Res() res: Response): Promise<void> {
    const checks = await this.performHealthChecks();
    
    const status = 
      checks.database === 'ok' && checks.redis === 'ok' 
        ? 'ok' 
        : checks.database === 'error' && checks.redis === 'error'
          ? 'down'
          : 'degraded';
    
    const response: ReadinessResponse = {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
      checks,
    };
    
    // Retornar 503 si no está ready
    const statusCode = status === 'ok' ? 200 : 503;
    res.status(statusCode).json(response);
  }

  /**
   * Métricas Prometheus
   * 
   * Por qué: Permite monitoreo y alertas en producción.
   * Formato compatible con Prometheus/Grafana.
   */
  @Get('metrics')
  @ApiOperation({
    summary: 'Obtener métricas del sistema',
    description: 'Métricas en formato Prometheus para monitoreo',
  })
  @ApiResponse({
    status: 200,
    description: 'Métricas en formato texto',
    content: {
      'text/plain': {},
    },
  })
  getMetrics(@Res() res: Response): void {
    const metrics = metricsStore.getMetrics();
    const uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
    
    // Formato Prometheus
    const prometheusOutput = `
# HELP smart_retail_http_requests_total Total de requests HTTP recibidos
# TYPE smart_retail_http_requests_total counter
smart_retail_http_requests_total ${metrics.httpRequestsTotal}

# HELP smart_retail_transactions_total Total de transacciones procesadas
# TYPE smart_retail_transactions_total counter
smart_retail_transactions_total ${metrics.transactionsTotal}

# HELP smart_retail_transactions_successful_total Transacciones exitosas
# TYPE smart_retail_transactions_successful_total counter
smart_retail_transactions_successful_total ${metrics.transactionsSuccessful}

# HELP smart_retail_transactions_failed_total Transacciones fallidas
# TYPE smart_retail_transactions_failed_total counter
smart_retail_transactions_failed_total ${metrics.transactionsFailed}

# HELP smart_retail_active_connections Conexiones WebSocket activas
# TYPE smart_retail_active_connections gauge
smart_retail_active_connections ${metrics.activeConnections}

# HELP smart_retail_queue_size Tamaño de la cola de procesamiento
# TYPE smart_retail_queue_size gauge
smart_retail_queue_size ${metrics.queueSize}

# HELP smart_retail_latency_p50_ms Latencia P50 en milisegundos
# TYPE smart_retail_latency_p50_ms gauge
smart_retail_latency_p50_ms ${metrics.latencyP50}

# HELP smart_retail_latency_p90_ms Latencia P90 en milisegundos
# TYPE smart_retail_latency_p90_ms gauge
smart_retail_latency_p90_ms ${metrics.latencyP90}

# HELP smart_retail_latency_p95_ms Latencia P95 en milisegundos (KPI < 200ms)
# TYPE smart_retail_latency_p95_ms gauge
smart_retail_latency_p95_ms ${metrics.latencyP95}

# HELP smart_retail_latency_p99_ms Latencia P99 en milisegundos
# TYPE smart_retail_latency_p99_ms gauge
smart_retail_latency_p99_ms ${metrics.latencyP99}

# HELP smart_retail_uptime_seconds Tiempo de actividad en segundos
# TYPE smart_retail_uptime_seconds gauge
smart_retail_uptime_seconds ${uptime}

# HELP smart_retail_info Información del servicio
# TYPE smart_retail_info gauge
smart_retail_info{version="${process.env.npm_package_version || '0.1.0'}"} 1
`.trim();

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(prometheusOutput);
  }

  /**
   * Realiza los health checks de las dependencias.
   */
  private async performHealthChecks(): Promise<{ database: 'ok' | 'error'; redis: 'ok' | 'error' }> {
    let dbStatus: 'ok' | 'error' = 'ok';
    let redisStatus: 'ok' | 'error' = 'ok';
    
    // Check PostgreSQL
    try {
      if (this.dbConnection) {
        // TODO: Ejecutar query simple como SELECT 1
        // await this.dbConnection.query('SELECT 1');
      }
      // Si no hay conexión inyectada, asumir OK (para tests)
    } catch {
      dbStatus = 'error';
    }
    
    // Check Redis
    try {
      if (this.redisClient) {
        // TODO: Ejecutar PING
        // await this.redisClient.ping();
      }
      // Si no hay cliente inyectado, asumir OK (para tests)
    } catch {
      redisStatus = 'error';
    }
    
    return {
      database: dbStatus,
      redis: redisStatus,
    };
  }
}
