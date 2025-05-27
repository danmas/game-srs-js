import Phaser from 'phaser';
import { Vehicle } from '../objects/Vehicle';
import { Settings } from './Settings'; // Может понадобиться для порогов слышимости

/**
 * Утилиты для физических расчетов, связанных с объектами игры.
 */
export class PhysicsUtils {

  /**
   * Рассчитывает уровень шума, принимаемый слушателем от источника.
   * @param sourceVehicle Объект-источник шума.
   * @param listenerPosition Позиция слушателя.
   * @returns Уровень шума, достигающий слушателя.
   */
  static getReceivedNoiseLevel(sourceVehicle: Vehicle, listenerPosition: Phaser.Math.Vector2): number {
    // Получаем эффективную силу шума от источника (уже может быть модифицирована подлодкой: глубина, перископ)
    const sourceNoiseOutput = sourceVehicle.getNoiseStrength();
    const distance = Phaser.Math.Distance.BetweenPoints(sourceVehicle.getPosition(), listenerPosition);

    if (distance < 1) { // Избегаем деления на ноль или слишком большого значения на малых дистанциях
      // Можно вернуть sourceNoiseOutput или какое-то максимальное значение, если очень близко
      return sourceNoiseOutput; 
    }
    // Шум затухает пропорционально квадрату расстояния (стандартная модель для звука в среде)
    // Формула из AS: ns = 3.*_noisy * 1000000.*pw / 36. / (_dist * _dist);
    // где (3.*_noisy * 1000000.*pw / 36.) это sourceNoiseOutput
    return sourceNoiseOutput / (distance * distance);
  }

  /**
   * Рассчитывает дистанцию, на которой шум от источника достигнет заданного порогового значения.
   * @param sourceVehicle Объект-источник шума.
   * @param targetNoiseThreshold Пороговое значение шума для обнаружения.
   * @returns Дистанция в игровых единицах.
   */
  static getDetectionDistanceForNoise(sourceVehicle: Vehicle, targetNoiseThreshold: number): number {
    const sourceNoiseOutput = sourceVehicle.getNoiseStrength();

    if (targetNoiseThreshold <= 0) {
      // Если порог нулевой или отрицательный, то любой шум будет слышен "бесконечно далеко"
      // (в практическом смысле, на максимальной дальности сенсоров или карты)
      // Либо можно вернуть очень большое число или специальное значение, если нужно.
      return Settings.MAX_DETECTION_RANGE || 10000; // Пример использования константы
    }
    if (sourceNoiseOutput <= 0) {
      // Если источник не шумит, его нельзя обнаружить по шуму.
      return 0;
    }

    // Формула обратная к getReceivedNoiseLevel: dist = sqrt(sourceOutput / noiseThreshold)
    return Math.sqrt(sourceNoiseOutput / targetNoiseThreshold);
  }
} 