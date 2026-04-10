/**
 * ============================================================================
 * SMART_RETAIL - Device Controller
 * ============================================================================
 * Controlador HTTP para endpoints de gestión de dispositivos.
 * 
 * ARQUITECTURA: Capa de INTERFACES 🟢 (http/controllers)
 * 
 * Endpoints:
 * - POST /devices/provision - Alta de nuevo dispositivo (CU-10)
 * - GET /devices - Lista de dispositivos
 * - GET /devices/:id - Detalle de dispositivo
 * - PATCH /devices/:id/status - Cambiar estado (mantenimiento, etc.)
 * 
 * Seguridad:
 * - Todos los endpoints requieren autenticación JWT
 * - Solo admins pueden acceder (verificado en Guard)
 * ============================================================================
 */

import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Inject,
    Logger,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiConflictResponse,
    ApiCreatedResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { v4 as uuidv4 } from 'uuid';

import {
    DEVICE_PROVISION_USE_CASE,
    IDeviceProvisionUseCase,
} from '@application/ports/input/device-provision.use-case';
import {
    DEVICE_REPOSITORY,
    IDeviceRepository,
} from '@application/ports/output/repositories.port';
import { DeviceType } from '@domain/entities/device.entity';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import { ErrorResponseDto } from '@interfaces/http/dto/access-response.dto';
import {
    DeviceListItemDto,
    DeviceListResponseDto,
    DeviceProvisionRequestDto,
    DeviceProvisionResponseDto,
    DeviceTypeDto,
} from '@interfaces/http/dto/device.dto';

@ApiTags('Devices')
@ApiBearerAuth()
@Controller('devices')
@UseGuards(JwtAuthGuard)
export class DeviceController {
  private readonly logger = new Logger(DeviceController.name);

  constructor(
    @Inject(DEVICE_PROVISION_USE_CASE)
    private readonly deviceProvisionUseCase: IDeviceProvisionUseCase,
    @Inject(DEVICE_REPOSITORY)
    private readonly deviceRepository: IDeviceRepository,
  ) {}

  /**
   * Provisiona un nuevo dispositivo IoT (CU-10).
   * 
   * Este endpoint genera credenciales únicas (API Key + Secret)
   * que el dispositivo usará para autenticarse vía WebSocket.
   * 
   * @param dto - Datos del dispositivo a provisionar
   * @param req - Request con usuario autenticado
   * @returns Dispositivo creado con credenciales
   */
  @Post('provision')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Provisionar nuevo dispositivo (CU-10)',
    description: `
Alta de nuevo dispositivo IoT en el sistema.

**Flujo:**
1. Admin ingresa datos del dispositivo
2. Sistema valida que no exista duplicado por serialNumber
3. Sistema genera credenciales únicas (API Key + Secret)
4. Sistema retorna credenciales en texto plano (ÚNICA VEZ)

**⚠️ IMPORTANTE:** El secret solo se muestra una vez. 
El admin DEBE copiarlo inmediatamente.
    `,
  })
  @ApiCreatedResponse({
    description: 'Dispositivo provisionado exitosamente',
    type: DeviceProvisionResponseDto,
  })
  @ApiConflictResponse({
    description: 'Ya existe un dispositivo con ese número de serie',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Token JWT inválido o expirado',
    type: ErrorResponseDto,
  })
  async provision(
    @Body() dto: DeviceProvisionRequestDto,
  ): Promise<DeviceProvisionResponseDto> {
    const traceId = uuidv4();

    this.logger.log('Solicitud de provisioning recibida', {
      traceId,
      serialNumber: dto.serialNumber,
      type: dto.type,
      locationId: dto.locationId,
    });

    // Mapear DTO enum a dominio enum
    const deviceType = this.mapDeviceType(dto.type);

    // Ejecutar use case
    // TODO: Obtener provisionedBy del token JWT (@CurrentUser decorator)
    const result = await this.deviceProvisionUseCase.execute({
      serialNumber: dto.serialNumber,
      name: dto.name,
      type: deviceType,
      locationId: dto.locationId,
      config: dto.config,
      provisionedBy: 'admin', // Temporal hasta implementar @CurrentUser
    });

    // Mapear a response DTO
    return {
      deviceId: result.device.id,
      serialNumber: result.device.serialNumber,
      name: result.device.name,
      status: result.device.status,
      locationId: result.device.locationId,
      apiKey: result.apiKey,
      secret: result.secret,
      provisionedAt: result.provisionedAt.toISOString(),
      warning: 'IMPORTANTE: Guarde las credenciales inmediatamente. El secret no se mostrará nuevamente.',
    };
  }

  /**
   * Lista todos los dispositivos.
   * 
   * @param locationId - Filtrar por ubicación (opcional)
   * @returns Lista de dispositivos
   */
  @Get()
  @ApiOperation({
    summary: 'Listar dispositivos',
    description: 'Obtiene la lista de todos los dispositivos registrados.',
  })
  @ApiQuery({
    name: 'locationId',
    required: false,
    description: 'Filtrar por ID de ubicación',
  })
  @ApiOkResponse({
    description: 'Lista de dispositivos',
    type: DeviceListResponseDto,
  })
  async list(
    @Query('locationId') locationId?: string,
  ): Promise<DeviceListResponseDto> {
    let devices;

    if (locationId) {
      devices = await this.deviceRepository.findByLocationId(locationId);
    } else {
      devices = await this.deviceRepository.findActive();
    }

    const items: DeviceListItemDto[] = devices.map((device) => ({
      id: device.id,
      serialNumber: device.serialNumber,
      name: device.name,
      type: device.type as unknown as DeviceTypeDto,
      status: device.status,
      locationId: device.locationId,
      lastHeartbeat: device.lastHeartbeat?.toISOString() ?? null,
      createdAt: device.createdAt.toISOString(),
    }));

    return {
      devices: items,
      total: items.length,
    };
  }

  /**
   * Obtiene el detalle de un dispositivo.
   * 
   * @param id - ID del dispositivo
   * @returns Detalle del dispositivo
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalle de dispositivo',
    description: 'Obtiene información detallada de un dispositivo específico.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del dispositivo',
  })
  @ApiOkResponse({
    description: 'Detalle del dispositivo',
    type: DeviceListItemDto,
  })
  async getById(@Param('id') id: string): Promise<DeviceListItemDto> {
    const device = await this.deviceRepository.findById(id);

    if (!device) {
      // Será manejado por GlobalExceptionFilter
      throw new Error(`Dispositivo no encontrado: ${id}`);
    }

    return {
      id: device.id,
      serialNumber: device.serialNumber,
      name: device.name,
      type: device.type as unknown as DeviceTypeDto,
      status: device.status,
      locationId: device.locationId,
      lastHeartbeat: device.lastHeartbeat?.toISOString() ?? null,
      createdAt: device.createdAt.toISOString(),
    };
  }

  /**
   * Cambia el estado de un dispositivo (CU-12, CU-20).
   * 
   * @param id - ID del dispositivo
   * @param status - Nuevo estado
   */
  @Patch(':id/status')
  @ApiOperation({
    summary: 'Cambiar estado del dispositivo',
    description: `
Permite cambiar el estado de un dispositivo:
- MAINTENANCE: Modo mantenimiento (CU-12)
- COMPROMISED: Dispositivo robado/comprometido (CU-20)
- OFFLINE: Volver a estado normal (espera heartbeat)
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'ID del dispositivo',
  })
  @ApiQuery({
    name: 'status',
    description: 'Nuevo estado',
    enum: ['MAINTENANCE', 'COMPROMISED', 'OFFLINE'],
  })
  @ApiOkResponse({
    description: 'Estado actualizado',
  })
  async updateStatus(
    @Param('id') id: string,
    @Query('status') status: 'MAINTENANCE' | 'COMPROMISED' | 'OFFLINE',
  ): Promise<{ success: boolean; message: string }> {
    const device = await this.deviceRepository.findById(id);

    if (!device) {
      throw new Error(`Dispositivo no encontrado: ${id}`);
    }

    await this.deviceRepository.updateStatus(id, status);

    this.logger.log('Estado de dispositivo actualizado', {
      deviceId: id,
      previousStatus: device.status,
      newStatus: status,
    });

    return {
      success: true,
      message: `Dispositivo ${id} actualizado a estado ${status}`,
    };
  }

  /**
   * Mapea enum del DTO al enum de dominio.
   */
  private mapDeviceType(dtoType: DeviceTypeDto): DeviceType {
    const mapping: Record<DeviceTypeDto, DeviceType> = {
      [DeviceTypeDto.TURNSTILE]: DeviceType.TURNSTILE,
      [DeviceTypeDto.LOCKER]: DeviceType.LOCKER,
      [DeviceTypeDto.DOOR]: DeviceType.DOOR,
      [DeviceTypeDto.KIOSK]: DeviceType.KIOSK,
    };
    return mapping[dtoType];
  }
}
