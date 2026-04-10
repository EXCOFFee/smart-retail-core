/**
 * ============================================================================
 * SMART_RETAIL - Módulo de Health Check
 * ============================================================================
 * Expone endpoints de salud para monitoreo y balanceadores de carga.
 * 
 * Por qué es importante: Los orquestadores (K8s, Docker Swarm) necesitan
 * saber si la instancia está viva y lista para recibir tráfico.
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { HealthController } from '@infrastructure/controllers/health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
