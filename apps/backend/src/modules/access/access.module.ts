/**
 * ============================================================================
 * SMART_RETAIL - Access Module
 * ============================================================================
 * Módulo principal que configura el dominio de Acceso/Compra.
 * 
 * ARQUITECTURA: Módulo de NEGOCIO (composición de capas)
 * 
 * Este módulo:
 * 1. Registra los providers (Use Cases, Repositories, Adapters)
 * 2. Exporta el controller de acceso
 * 3. Conecta las capas hexagonales via Dependency Injection
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

// Domain / Application
import {
    PROCESS_ACCESS_USE_CASE,
    ProcessAccessService,
} from '@application/use-cases/process-access.service';

// Infrastructure - Database
import { DeviceOrmEntity } from '@infrastructure/database/entities/device.orm-entity';
import { ProductOrmEntity } from '@infrastructure/database/entities/product.orm-entity';
import { TransactionOrmEntity } from '@infrastructure/database/entities/transaction.orm-entity';
import { UserOrmEntity } from '@infrastructure/database/entities/user.orm-entity';
import {
    DeviceRepository,
    ProductRepository,
    TransactionRepository,
    UserRepository,
} from '@infrastructure/database/repositories';

// Infrastructure - Cache
import { RedisStockCacheAdapter } from '@infrastructure/adapters/cache/redis-stock-cache.adapter';

// Ports (tokens)
import { DEVICE_GATEWAY_PORT } from '@application/ports/output/device-gateway.port';
import { PAYMENT_GATEWAY_PORT } from '@application/ports/output/payment-gateway.port';
import {
    DEVICE_REPOSITORY,
    PRODUCT_REPOSITORY,
    TRANSACTION_REPOSITORY,
    USER_REPOSITORY,
} from '@application/ports/output/repositories.port';
import { STOCK_CACHE_PORT } from '@application/ports/output/stock-cache.port';

// Interfaces - HTTP
import { AccessController } from '@interfaces/http/controllers/access.controller';

/**
 * Mock temporal del Payment Gateway (será reemplazado en Semana 3)
 */
const MockPaymentGatewayProvider = {
  provide: PAYMENT_GATEWAY_PORT,
  useValue: {
    gatewayName: 'MERCADOPAGO' as const,
    async charge(input: { amount: { cents: number }; transactionId: string }) {
      // Simular latencia de pasarela
      await new Promise((resolve) => setTimeout(resolve, 100));
      return {
        success: true,
        externalId: `mock-${input.transactionId}`,
        status: 'approved' as const,
        responseCode: 'APPROVED',
        responseMessage: 'Pago aprobado (mock)',
        paymentMethod: 'mock_wallet',
      };
    },
    async refund(externalId: string) {
      return {
        success: true,
        refundId: `refund-${externalId}`,
        status: 'approved' as const,
        message: 'Refund processed (mock)',
      };
    },
    async getTransactionStatus(externalId: string) {
      return {
        externalId,
        status: 'completed' as const,
        paidAt: new Date(),
      };
    },
  },
};

/**
 * Mock temporal del Device Gateway (será reemplazado en Semana 3)
 */
const MockDeviceGatewayProvider = {
  provide: DEVICE_GATEWAY_PORT,
  useValue: {
    async sendCommand(_deviceId: string, _command: { type: string }) {
      // Simular latencia de WebSocket
      await new Promise((resolve) => setTimeout(resolve, 50));
      return true;
    },
    async openAndWaitConfirmation(_deviceId: string, _transactionId: string, _timeoutMs: number) {
      // Simular ACK del hardware
      await new Promise((resolve) => setTimeout(resolve, 100));
      return true;
    },
    async isDeviceConnected(_deviceId: string) {
      return true;
    },
  },
};

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      UserOrmEntity,
      ProductOrmEntity,
      DeviceOrmEntity,
      TransactionOrmEntity,
    ]),
  ],
  controllers: [AccessController],
  providers: [
    // ═════════════════════════════════════════════════════════════════════
    // USE CASES (Application Layer)
    // ═════════════════════════════════════════════════════════════════════
    {
      provide: PROCESS_ACCESS_USE_CASE,
      useClass: ProcessAccessService,
    },

    // ═════════════════════════════════════════════════════════════════════
    // REPOSITORIES (Infrastructure Layer - Database)
    // ═════════════════════════════════════════════════════════════════════
    {
      provide: USER_REPOSITORY,
      useClass: UserRepository,
    },
    {
      provide: PRODUCT_REPOSITORY,
      useClass: ProductRepository,
    },
    {
      provide: DEVICE_REPOSITORY,
      useClass: DeviceRepository,
    },
    {
      provide: TRANSACTION_REPOSITORY,
      useClass: TransactionRepository,
    },

    // ═════════════════════════════════════════════════════════════════════
    // ADAPTERS (Infrastructure Layer - External Services)
    // ═════════════════════════════════════════════════════════════════════
    {
      provide: STOCK_CACHE_PORT,
      useClass: RedisStockCacheAdapter,
    },

    // Mocks temporales (reemplazar en semanas siguientes)
    MockPaymentGatewayProvider,
    MockDeviceGatewayProvider,
  ],
  exports: [PROCESS_ACCESS_USE_CASE],
})
export class AccessModule {}
