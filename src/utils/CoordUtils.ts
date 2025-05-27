import { Settings } from './Settings';

/**
 * Утилиты для преобразования координат между логической системой (центр мира = 0,0)
 * и системой координат Phaser (левый верхний угол мира = 0,0).
 */
export class CoordUtils {
  private static get worldCenterX(): number {
    return Settings.GAME_WORLD_WIDTH / 2;
  }

  private static get worldCenterY(): number {
    return Settings.GAME_WORLD_HEIGHT / 2;
  }

  /**
   * Преобразует логическую X-координату в X-координату Phaser.
   * @param logicalX Логическая X-координата (0 в центре мира).
   * @returns X-координата в системе Phaser.
   */
  public static logicalToPhaserX(logicalX: number): number {
    return logicalX + CoordUtils.worldCenterX;
  }

  /**
   * Преобразует логическую Y-координату в Y-координату Phaser.
   * @param logicalY Логическая Y-координата (0 в центре мира).
   * @returns Y-координата в системе Phaser.
   */
  public static logicalToPhaserY(logicalY: number): number {
    return logicalY + CoordUtils.worldCenterY;
  }

  /**
   * Преобразует X-координату Phaser в логическую X-координату.
   * @param phaserX X-координата в системе Phaser.
   * @returns Логическая X-координата (0 в центре мира).
   */
  public static phaserToLogicalX(phaserX: number): number {
    return phaserX - CoordUtils.worldCenterX;
  }

  /**
   * Преобразует Y-координату Phaser в логическую Y-координату.
   * @param phaserY Y-координата в системе Phaser.
   * @returns Логическая Y-координата (0 в центре мира).
   */
  public static phaserToLogicalY(phaserY: number): number {
    return phaserY - CoordUtils.worldCenterY;
  }

  /**
   * Преобразует логические координаты (Vector2) в координаты Phaser (Vector2).
   * @param logicalPoint Точка с логическими координатами (x,y), где (0,0) - центр мира.
   * @returns Точка с координатами в системе Phaser.
   */
  public static logicalToPhaser(logicalPoint: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(
      logicalPoint.x + CoordUtils.worldCenterX,
      logicalPoint.y + CoordUtils.worldCenterY
    );
  }

  /**
   * Преобразует координаты Phaser (Vector2) в логические координаты (Vector2).
   * @param phaserPoint Точка с координатами Phaser (x,y).
   * @returns Точка с логическими координатами, где (0,0) - центр мира.
   */
  public static phaserToLogical(phaserPoint: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(
      phaserPoint.x - CoordUtils.worldCenterX,
      phaserPoint.y - CoordUtils.worldCenterY
    );
  }
} 