import { DetectionState } from '../utils/DetectionState';
import { Vehicle } from '../objects/Vehicle';

export interface PerceivedTargetInfo {
  targetVehicle: Vehicle;                     // Сам объект цели
  detectionState: DetectionState;             // Текущее состояние обнаружения
  previousDetectionState: DetectionState;     // Предыдущее состояние для отслеживания изменений
  lastZone1PingTime: number;                  // Время последнего "пинга" для Зоны 1
  displayPositionLogical: Phaser.Math.Vector2; // Текущая "видимая" позиция для Зоны 1 (в логических координатах)
                                              // Для Зон 2 и 3 это будут истинные координаты
} 