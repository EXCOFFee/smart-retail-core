/**
 * ============================================================================
 * SMART_RETAIL - Device Repository (TypeORM Implementation)
 * ============================================================================
 * Implementación del puerto IDeviceRepository usando TypeORM.
 * 
 * ARQUITECTURA: Capa de INFRAESTRUCTURA 🔵 (adapters/database)
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IDeviceRepository } from '@application/ports/output/repositories.port';
import { Device, DeviceStatus, DeviceType } from '@domain/entities/device.entity';
import { DeviceOrmEntity, DeviceStatusOrm, DeviceTypeOrm } from '@infrastructure/database/entities/device.orm-entity';

@Injectable()
export class DeviceRepository implements IDeviceRepository {
  constructor(
    @InjectRepository(DeviceOrmEntity)
    private readonly deviceRepo: Repository<DeviceOrmEntity>,
  ) {}

  /**
   * Busca un dispositivo por ID y lo mapea a entidad de dominio.
   * 
   * @param id - UUID del dispositivo
   * @returns Dispositivo de dominio o null si no existe
   */
  async findById(id: string): Promise<Device | null> {
    const orm = await this.deviceRepo.findOne({ where: { id } });
    if (!orm) return null;
    return this.toDomain(orm);
  }

  /**
   * Busca un dispositivo por número de serie.
   * 
   * @param serialNumber - Número de serie del dispositivo
   * @returns Dispositivo de dominio o null si no existe
   */
  async findBySerialNumber(serialNumber: string): Promise<Device | null> {
    const orm = await this.deviceRepo.findOne({ where: { serialNumber } });
    if (!orm) return null;
    return this.toDomain(orm);
  }

  /**
   * Busca dispositivos por ubicación.
   * 
   * @param locationId - ID de la ubicación
   * @returns Lista de dispositivos en esa ubicación
   */
  async findByLocationId(locationId: string): Promise<Device[]> {
    const orms = await this.deviceRepo.find({
      where: { locationId },
      order: { name: 'ASC' },
    });
    return orms.map((orm: DeviceOrmEntity) => this.toDomain(orm));
  }

  /**
   * Busca dispositivos activos (online u offline recientemente).
   * 
   * @returns Lista de dispositivos activos
   */
  async findActive(): Promise<Device[]> {
    const orms = await this.deviceRepo.find({
      where: [
        { status: DeviceStatusOrm.ONLINE },
        { status: DeviceStatusOrm.OFFLINE },
      ],
      order: { locationId: 'ASC', name: 'ASC' },
    });
    return orms.map((orm: DeviceOrmEntity) => this.toDomain(orm));
  }

  /**
   * Persiste un dispositivo (crea o actualiza).
   * 
   * @param device - Entidad de dominio del dispositivo
   * @returns Dispositivo persistido
   */
  async save(device: Device): Promise<Device> {
    const orm = this.toOrm(device);
    const saved = await this.deviceRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Actualiza solo el estado de un dispositivo.
   * 
   * @param deviceId - ID del dispositivo
   * @param status - Nuevo estado
   */
  async updateStatus(deviceId: string, status: string): Promise<void> {
    const now = new Date();
    await this.deviceRepo.update(
      { id: deviceId },
      {
        status: status as DeviceStatusOrm,
        updatedAt: now,
      },
    );
  }

  /**
   * Registra el último heartbeat de un dispositivo.
   * 
   * @param deviceId - ID del dispositivo
   * @param timestamp - Timestamp del heartbeat
   */
  async updateHeartbeat(deviceId: string, timestamp: Date): Promise<void> {
    await this.deviceRepo.update(
      { id: deviceId },
      {
        lastHeartbeatAt: timestamp,
        status: DeviceStatusOrm.ONLINE,
        updatedAt: new Date(),
      },
    );
  }

  /**
   * Busca dispositivos sin heartbeat reciente.
   * 
   * @param thresholdMinutes - Minutos sin heartbeat para considerar stale
   * @returns Lista de dispositivos sin heartbeat reciente
   */
  async findStaleDevices(thresholdMinutes: number): Promise<Device[]> {
    const threshold = new Date();
    threshold.setMinutes(threshold.getMinutes() - thresholdMinutes);

    const orms = await this.deviceRepo
      .createQueryBuilder('device')
      .where('device.status = :status', { status: DeviceStatusOrm.ONLINE })
      .andWhere('(device.last_heartbeat_at < :threshold OR device.last_heartbeat_at IS NULL)', { threshold })
      .getMany();

    return orms.map((orm: DeviceOrmEntity) => this.toDomain(orm));
  }

  /**
   * Mapea entidad ORM a entidad de dominio.
   * 
   * @param orm - Entidad ORM
   * @returns Entidad de dominio
   */
  private toDomain(orm: DeviceOrmEntity): Device {
    return new Device({
      id: orm.id,
      serialNumber: orm.serialNumber,
      name: orm.name,
      type: orm.type as unknown as DeviceType,
      status: orm.status as unknown as DeviceStatus,
      locationId: orm.locationId,
      config: orm.config ?? undefined,
      lastHeartbeat: orm.lastHeartbeatAt ?? null,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  /**
   * Mapea entidad de dominio a entidad ORM.
   * 
   * @param domain - Entidad de dominio
   * @returns Entidad ORM
   */
  private toOrm(domain: Device): DeviceOrmEntity {
    const orm = new DeviceOrmEntity();
    orm.id = domain.id;
    orm.serialNumber = domain.serialNumber;
    orm.name = domain.name;
    orm.type = domain.type as unknown as DeviceTypeOrm;
    orm.status = domain.status as unknown as DeviceStatusOrm;
    orm.locationId = domain.locationId;
    orm.lastHeartbeatAt = domain.lastHeartbeat ?? null;
    orm.config = domain.config ?? {};
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    return orm;
  }
}
