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

import { Logger, Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
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

// Infrastructure - Gateways reales (usados en modo 'live')
import { MercadoPagoAdapter } from '@infrastructure/adapters/payment/mercadopago.adapter';
import { DeviceGateway } from '@infrastructure/adapters/websocket/device.gateway';

// Ports (tokens + contratos)
import {
    DEVICE_GATEWAY_PORT,
    DeviceCommand,
    DeviceCommandResult,
    DeviceEventHandler,
    IDeviceGatewayPort,
} from '@application/ports/output/device-gateway.port';
import {
    ChargeRequest,
    ChargeResult,
    IPaymentGatewayPort,
    PAYMENT_GATEWAY_PORT,
    RefundResult,
} from '@application/ports/output/payment-gateway.port';
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
 * Espera `ms` milisegundos (para simular latencia en los mocks).
 */
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Doble en memoria del Payment Gateway.
 *
 * Se usa en desarrollo/tests para no depender de credenciales reales ni
 * cobrar dinero. En producción está PROHIBIDO (ver resolveGatewayMode).
 */
class MockPaymentGateway implements IPaymentGatewayPort {
  readonly gatewayName = 'MERCADOPAGO' as const;

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    await delay(100); // Simula latencia de pasarela
    return {
      success: true,
      externalId: `mock-${request.transactionId}`,
      status: 'approved',
      paymentMethod: 'mock_wallet',
      responseCode: 'APPROVED',
      responseMessage: 'Pago aprobado (mock)',
    };
  }

  async refund(externalId: string): Promise<RefundResult> {
    return {
      success: true,
      refundId: `refund-${externalId}`,
      status: 'approved',
      message: 'Refund processed (mock)',
    };
  }

  async getTransactionStatus(externalId: string): Promise<ChargeResult> {
    return {
      success: true,
      externalId,
      status: 'approved',
      paymentMethod: 'mock_wallet',
      responseCode: 'APPROVED',
      responseMessage: 'Estado consultado (mock)',
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

/**
 * Doble en memoria del Device Gateway (hardware IoT).
 *
 * En modo mock el hardware "siempre responde y abre". En producción se usa
 * el DeviceGateway real por WebSocket.
 */
class MockDeviceGateway implements IDeviceGatewayPort {
  async sendCommand(
    _deviceId: string,
    _command: DeviceCommand,
    _timeout?: number,
  ): Promise<DeviceCommandResult> {
    await delay(50); // Simula latencia de WebSocket
    return { acknowledged: true, connected: true, latencyMs: 50 };
  }

  async isDeviceConnected(_deviceId: string): Promise<boolean> {
    return true;
  }

  onDeviceEvent(_handler: DeviceEventHandler): void {
    // no-op en el mock
  }

  async openAndWaitConfirmation(
    _deviceId: string,
    _transactionId: string,
    _timeout: number,
  ): Promise<boolean> {
    await delay(100); // Simula ACK del hardware
    return true;
  }

  async forceDisconnect(_deviceId: string): Promise<void> {
    // no-op en el mock
  }
}

/**
 * Decide si usar gateways reales ('live') o mocks ('mock').
 *
 * Regla de seguridad: en producción NUNCA caemos a mocks en silencio, porque
 * la app parecería cobrar cuando en realidad no cobra. Por eso:
 * - production            → siempre 'live' (y se prohíbe 'mock' explícito).
 * - development/test      → 'mock' por default; 'live' solo si se pide.
 *
 * En 'live', cada adapter real valida sus credenciales en el constructor
 * (getOrThrow); si faltan, la app falla al arrancar en vez de mockear.
 */
type GatewayMode = 'live' | 'mock';

function resolveGatewayMode(config: ConfigService): GatewayMode {
  const nodeEnv = config.get<string>('NODE_ENV', 'development');
  const explicit = (config.get<string>('GATEWAY_MODE') ?? '').toLowerCase();

  if (nodeEnv === 'production') {
    if (explicit === 'mock') {
      throw new Error(
        'SECURITY: GATEWAY_MODE=mock no está permitido en producción. ' +
          'Configurá GATEWAY_MODE=live y las credenciales de la pasarela de pago.',
      );
    }
    return 'live';
  }

  return explicit === 'live' ? 'live' : 'mock';
}

/**
 * Provider del Payment Gateway seleccionado por entorno.
 */
const PaymentGatewayProvider: Provider = {
  provide: PAYMENT_GATEWAY_PORT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): IPaymentGatewayPort => {
    const logger = new Logger('PaymentGatewayFactory');
    if (resolveGatewayMode(config) === 'mock') {
      logger.warn('⚠️  PAYMENT gateway en modo MOCK: no se cobra dinero real.');
      return new MockPaymentGateway();
    }
    logger.log('PAYMENT gateway en modo LIVE: MercadoPago');
    // El constructor hace getOrThrow de las credenciales → fail-fast si faltan.
    return new MercadoPagoAdapter(config);
  },
};

/**
 * Provider del Device Gateway seleccionado por entorno.
 *
 * NOTA: en 'live' se instancia el DeviceGateway real. Para que el servidor
 * WebSocket quede totalmente enlazado como gateway de Nest (@WebSocketServer)
 * debe además registrarse como provider gestionado por Nest; hasta entonces,
 * sin dispositivos conectados el flujo rechaza de forma segura
 * (DeviceNotOperational) en lugar de simular una apertura.
 */
const DeviceGatewayProvider: Provider = {
  provide: DEVICE_GATEWAY_PORT,
  inject: [ConfigService, JwtService],
  useFactory: (
    config: ConfigService,
    jwtService: JwtService,
  ): IDeviceGatewayPort => {
    const logger = new Logger('DeviceGatewayFactory');
    if (resolveGatewayMode(config) === 'mock') {
      logger.warn('⚠️  DEVICE gateway en modo MOCK: el hardware siempre "abre".');
      return new MockDeviceGateway();
    }
    logger.log('DEVICE gateway en modo LIVE: WebSocket (Socket.io)');
    return new DeviceGateway(config, jwtService);
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

    // Gateways externos: reales en 'live', mocks en dev/test (ver GATEWAY_MODE)
    PaymentGatewayProvider,
    DeviceGatewayProvider,
  ],
  exports: [PROCESS_ACCESS_USE_CASE],
})
export class AccessModule {}
