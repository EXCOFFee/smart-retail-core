/**
 * ============================================================================
 * SMART_RETAIL - Auth Controller
 * ============================================================================
 * Controlador HTTP para endpoints de autenticación.
 * 
 * ARQUITECTURA: Capa de INTERFACES 🟢 (http/controllers)
 * 
 * ENDPOINTS:
 * - POST /auth/login - Login con email y contraseña (público)
 * - POST /auth/register - Registro de nuevo usuario (público)
 * - POST /auth/refresh - Renovación de tokens (público)
 * - POST /auth/logout - Cierre de sesión (protegido)
 * - GET /auth/me - Perfil del usuario actual (protegido)
 * - POST /auth/change-password - Cambio de contraseña (protegido)
 * 
 * SEGURIDAD:
 * - Los endpoints públicos usan @Public() decorator
 * - Los endpoints protegidos requieren JWT válido
 * ============================================================================
 */

import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Logger,
    Post,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiConflictResponse,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { AuthService } from '@application/services/auth.service';
import { CurrentUser } from '@infrastructure/auth/decorators/current-user.decorator';
import { Public } from '@infrastructure/auth/decorators/public.decorator';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '@infrastructure/auth/strategies/jwt.strategy';
import {
    AuthResponseDto,
    ChangePasswordDto,
    LoginDto,
    LogoutDto,
    RefreshTokenDto,
    RegisterDto,
    UserProfileResponseDto,
} from '@interfaces/http/dto/auth.dto';

@ApiTags('Authentication')
@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Inicia sesión con email y contraseña.
   * 
   * @param dto - Credenciales de login
   * @returns Tokens y datos del usuario
   */
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login de usuario',
    description: 'Autentica un usuario con email y contraseña. Retorna tokens JWT.',
  })
  @ApiOkResponse({
    description: 'Login exitoso',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Credenciales inválidas',
  })
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    this.logger.log(`Login request for: ${dto.email}`);

    const result = await this.authService.login(dto.email, dto.password);

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      user: {
        id: result.user.id,
        email: result.user.email,
        fullName: result.user.fullName,
        role: result.user.role,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REGISTER
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Registra un nuevo usuario.
   * 
   * @param dto - Datos del nuevo usuario
   * @returns Tokens y datos del usuario creado
   */
  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registro de usuario',
    description: 'Crea una nueva cuenta de usuario. Retorna tokens JWT.',
  })
  @ApiOkResponse({
    description: 'Registro exitoso',
    type: AuthResponseDto,
  })
  @ApiConflictResponse({
    description: 'El email ya está registrado',
  })
  @ApiBadRequestResponse({
    description: 'Datos de registro inválidos',
  })
  async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    this.logger.log(`Register request for: ${dto.email}`);

    const result = await this.authService.register({
      email: dto.email,
      password: dto.password,
      fullName: dto.fullName,
      role: dto.role as 'consumer' | 'merchant' | 'operator' | 'admin',
      locationId: dto.locationId,
    });

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      user: {
        id: result.user.id,
        email: result.user.email,
        fullName: result.user.fullName,
        role: result.user.role,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REFRESH
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Renueva los tokens usando un Refresh Token.
   * 
   * @param dto - Refresh Token actual
   * @returns Nuevos tokens
   */
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Renovar tokens',
    description: 'Obtiene nuevos tokens usando un Refresh Token válido.',
  })
  @ApiOkResponse({
    description: 'Tokens renovados',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Refresh Token inválido o expirado',
  })
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    this.logger.debug('Token refresh request');

    const result = await this.authService.refreshToken(dto.refreshToken);

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      user: {
        id: result.user.id,
        email: result.user.email,
        fullName: result.user.fullName,
        role: result.user.role,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Cierra sesión, revocando tokens.
   * 
   * @param currentUser - Usuario autenticado
   * @param dto - Token específico a revocar (opcional)
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cerrar sesión',
    description: 'Revoca los tokens del usuario. Si se especifica un refreshToken, solo revoca ese token. De lo contrario, revoca todos.',
  })
  @ApiOkResponse({
    description: 'Sesión cerrada exitosamente',
  })
  @ApiUnauthorizedResponse({
    description: 'No autenticado',
  })
  async logout(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: LogoutDto,
  ): Promise<{ message: string }> {
    this.logger.log(`Logout request for user: ${currentUser.id}`);

    await this.authService.logout(currentUser.id, dto.refreshToken);

    return { message: 'Sesión cerrada exitosamente' };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET PROFILE (ME)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Obtiene el perfil del usuario actual.
   * 
   * @param currentUser - Usuario autenticado
   * @returns Perfil del usuario
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Perfil del usuario actual',
    description: 'Obtiene los datos del usuario autenticado.',
  })
  @ApiOkResponse({
    description: 'Perfil del usuario',
    type: UserProfileResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'No autenticado',
  })
  async getProfile(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UserProfileResponseDto> {
    this.logger.debug(`Profile request for user: ${currentUser.id}`);

    const profile = await this.authService.getProfile(currentUser.id);

    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role,
      walletBalanceCents: profile.walletBalanceCents,
      walletBalanceFormatted: profile.walletBalanceFormatted,
      locationId: profile.locationId,
      isActive: profile.isActive,
      lastLoginAt: profile.lastLoginAt,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CHANGE PASSWORD
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Cambia la contraseña del usuario actual.
   * 
   * @param currentUser - Usuario autenticado
   * @param dto - Contraseñas actual y nueva
   */
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cambiar contraseña',
    description: 'Cambia la contraseña del usuario autenticado. Revoca todos los tokens.',
  })
  @ApiOkResponse({
    description: 'Contraseña cambiada exitosamente',
  })
  @ApiUnauthorizedResponse({
    description: 'Contraseña actual incorrecta',
  })
  @ApiBadRequestResponse({
    description: 'La nueva contraseña debe ser diferente',
  })
  async changePassword(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    this.logger.log(`Password change request for user: ${currentUser.id}`);

    await this.authService.changePassword(
      currentUser.id,
      dto.currentPassword,
      dto.newPassword,
    );

    return { message: 'Contraseña cambiada exitosamente. Por favor, inicia sesión nuevamente.' };
  }
}
