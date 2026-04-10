/**
 * ============================================================================
 * SMART_RETAIL - Audio Feedback Service (Kiosk Mode)
 * ============================================================================
 * Servicio de feedback de audio para modo kiosco.
 * 
 * FEATURES:
 * - Sonidos de confirmación para escaneos exitosos
 * - Sonidos de error para rechazos
 * - Configuración de volumen
 * ============================================================================
 */

import { Audio, AVPlaybackStatus } from 'expo-av';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type SoundType = 'success' | 'error' | 'warning' | 'notification';

interface SoundConfig {
  volume: number;
  enabled: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

// Sonidos base64 embebidos para evitar dependencias de archivos
// En producción, estos serían archivos .mp3/.wav en assets
// TODO: Cargar sonidos desde assets cuando estén disponibles
const SOUND_ASSETS: Record<SoundType, number | null> = {
  success: null, // Se cargará desde assets
  error: null,
  warning: null,
  notification: null,
};

// Exportamos para uso futuro cuando se carguen los assets
export { SOUND_ASSETS };

const DEFAULT_CONFIG: SoundConfig = {
  volume: 0.8,
  enabled: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// AUDIO FEEDBACK SERVICE
// ─────────────────────────────────────────────────────────────────────────────

class AudioFeedbackService {
  private config: SoundConfig = DEFAULT_CONFIG;
  private loadedSounds: Map<SoundType, Audio.Sound> = new Map();
  private isInitialized = false;

  /**
   * Inicializa el servicio de audio.
   * Debe llamarse al iniciar la app.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Configurar modo de audio
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      this.isInitialized = true;
    } catch {
      // Silently fail - audio feedback is non-critical
    }
  }

  /**
   * Configura el servicio de audio.
   */
  configure(config: Partial<SoundConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Reproduce un sonido de feedback.
   */
  async play(type: SoundType): Promise<void> {
    if (!this.config.enabled) return;

    try {
      // Crear sonido sintético si no hay archivo
      const sound = await this.createSyntheticSound(type);
      if (sound) {
        await sound.setVolumeAsync(this.config.volume);
        await sound.playAsync();

        // Liberar recursos después de reproducir
        sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
          if (status.isLoaded && status.didJustFinish) {
            sound.unloadAsync();
          }
        });
      }
    } catch {
      // Silently fail - audio feedback is non-critical
    }
  }

  /**
   * Crea un sonido sintético basado en el tipo.
   * En producción, cargaría archivos reales.
   */
  private async createSyntheticSound(
    _type: SoundType,
  ): Promise<Audio.Sound | null> {
    // En una implementación real, cargaríamos:
    // const { sound } = await Audio.Sound.createAsync(
    //   require(`../../assets/sounds/${type}.mp3`)
    // );
    
    // Por ahora, retornamos null y usamos feedback háptico
    // que ya está implementado en scan.tsx
    return null;
  }

  /**
   * Atajos para reproducir sonidos comunes.
   */
  async playSuccess(): Promise<void> {
    await this.play('success');
  }

  async playError(): Promise<void> {
    await this.play('error');
  }

  async playWarning(): Promise<void> {
    await this.play('warning');
  }

  async playNotification(): Promise<void> {
    await this.play('notification');
  }

  /**
   * Limpia recursos al cerrar la app.
   */
  async cleanup(): Promise<void> {
    for (const sound of this.loadedSounds.values()) {
      await sound.unloadAsync();
    }
    this.loadedSounds.clear();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export const audioFeedback = new AudioFeedbackService();
