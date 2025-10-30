import Phaser from 'phaser';
import { Vehicle } from './Vehicle';
import { Ship } from './Ship';
import { Constants } from '../utils/Constants';
import { Settings } from '../utils/Settings';
import { TorpedoParams } from './TorpedoParams';
import { Statistic } from '../utils/Statistic';
import { UniversalLogger, LogLevel } from '../utils/UniversalLogger';
import { AILogger } from '../utils/AILogger';

/**
 * Базовый класс торпеды
 */
export class Torpedo extends Vehicle {
  // Свойства торпеды
  protected weaponType: number = Constants.WEAPON_SELECT_UNKNOWN;
  protected damage: number = 0;
  protected executionDist: number = 0;
  protected maxTimeLifeSec: number = 0;
  protected params: TorpedoParams | null = null;
  public readonly entityType: string = 'Torpedo'; // Тип сущности для идентификации
  public firedByShipId: number | null = null; // ID корабля, который запустил торпеду
  
  /**
   * Конструктор
   * @param scene Сцена
   * @param x Начальная позиция X
   * @param y Начальная позиция Y
   * @param angle Начальный угол
   * @param params Параметры торпеды
   * @param forces Принадлежность к силам
   */
  constructor(
    scene: Phaser.Scene, 
    x: number, 
    y: number, 
    angle: number, 
    params: TorpedoParams, 
    forces: number = Constants.FORCES_WHITE
  ) {
    super(scene, x, y);
    
    // Устанавливаем параметры торпеды
    this.params = params;
    this.maxVelocity = params.maxVelocity;
    this.damage = params.damage;
    this.executionDist = params.executionDist;
    this.maxTimeLifeSec = params.lifeTimeSec;
    
    // Устанавливаем направление и скорость
    this.direction = angle;
    this.directionTarget = angle;
    this.power = Vehicle.POWER_6; // Торпеды всегда идут на полной скорости
    
    // Устанавливаем силы
    this.setForces(forces);
    
    // Увеличиваем статистику запуска торпед
    if (forces === Constants.FORCES_RED) {
      Statistic.enemy_fire_count++;
    } else {
      Statistic.friend_fire_count++;
    }
  }
  
  /**
   * Переопределяем метод отрисовки торпеды
   */
  protected drawVehicle(): void {
    // Создаем графику для торпеды
    const graphics = (this.scene.add as Phaser.GameObjects.GameObjectFactory).graphics();
    
    // Выбираем цвет в зависимости от принадлежности
    graphics.fillStyle(this.color, 1);
    
    // Рисуем форму торпеды (маленький прямоугольник)
    graphics.fillRect(-1.5, -3, 3, 6);
    
    // Генерируем текстуру
    graphics.generateTexture('torpedo', 6, 12);
    graphics.destroy();
    
    // Устанавливаем текстуру
    this.setTexture('torpedo');
  }
  
  /**
   * Обновление торпеды
   * @param time Текущее время
   * @param delta Прошедшее время
   */
  update(time: number, delta: number): void {
    super.update(time, delta);
    
    // Проверяем время жизни торпеды
    if (this.isTimeLifeEnd()) {
      // Логируем промах - торпеда уничтожена без попадания
      const weaponTypeName = this.getWeaponTypeName();
      UniversalLogger.log(
        `Torpedo expired without hitting target (lifeTime: ${this.maxTimeLifeSec}s)`,
        `TORPEDO_MISS`,
        LogLevel.INFO,
        {
          torpedoId: this.id,
          weaponType: weaponTypeName,
          firedByShipId: this.firedByShipId,
          distanceTraveled: this.timeLive / 1000 * this.maxVelocity,
          position: { x: this.x, y: this.y }
        }
      );
      this.destroy();
      return;
    }
    
    // Проверяем попадание в цели
    this.hitDetection();
  }
  
  /**
   * Проверяет, закончилось ли время жизни торпеды
   */
  protected isTimeLifeEnd(): boolean {
    if (this.timeLive > this.maxTimeLifeSec * 1000) {
      return true;
    }
    return false;
  }
  
  /**
   * Проверка на попадание в корабли
   */
  protected hitDetection(): void {
    // Определяем массив кораблей противоположной стороны
    let enemyShips: Ship[] = [];
    
    if (this.forces === Constants.FORCES_RED) {
      // Красная торпеда проверяет попадание в белые корабли
      const scene = this.scene as any;
      if (scene.getWhiteShips) {
        enemyShips = scene.getWhiteShips();
      }
    } else {
      // Белая торпеда проверяет попадание в красные корабли
      const scene = this.scene as any;
      if (scene.getRedShips) {
        enemyShips = scene.getRedShips();
      }
    }
    
    // Проверяем расстояние до каждого корабля
    for (const ship of enemyShips) {
      const dist = Phaser.Math.Distance.Between(
        this.position.x, this.position.y,
        ship.getPosition().x, ship.getPosition().y
      );
      
      // Если расстояние меньше размера корабля, засчитываем попадание
      if (dist < ship.getSizeForHit()) {
        // Сообщаем о попадании
        console.log(`Hit the target ${ship}`);
        
        const oldHealth = ship.getHealth();
        const weaponTypeName = this.getWeaponTypeName();
        
        // Логируем попадание ДО нанесения урона (чтобы записать старое здоровье)
        UniversalLogger.log(
          `Torpedo hit target Ship ${ship.id} for ${this.damage} damage`,
          `TORPEDO_HIT`,
          LogLevel.INFO,
          {
            torpedoId: this.id,
            targetShipId: ship.id,
            weaponType: weaponTypeName,
            firedByShipId: this.firedByShipId,
            damage: this.damage,
            targetHealthBefore: oldHealth,
            distance: dist.toFixed(2),
            targetPosition: { x: ship.x, y: ship.y },
            torpedoPosition: { x: this.x, y: this.y }
          }
        );
        
        // Наносим урон кораблю (там тоже будет логирование изменения здоровья)
        ship.hasHit(this.damage, this.firedByShipId);
        
        // Увеличиваем статистику попаданий
        if (this.forces === Constants.FORCES_RED) {
          Statistic.friend_hit_count++;
        } else {
          Statistic.enemy_hit_count++;
        }
        
        // Уничтожаем торпеду
        this.destroy();
        break;
      }
    }
  }
  
  /**
   * Получает тип оружия
   */
  public getWeaponType(): number {
    return this.weaponType;
  }
  
  /**
   * Получает имя типа оружия для логирования
   */
  private getWeaponTypeName(): string {
    switch (this.weaponType) {
      case Constants.WEAPON_SELECT_TORP_I:
        return 'Torpedo I';
      case Constants.WEAPON_SELECT_TORP_II:
        return 'Torpedo II';
      case Constants.WEAPON_SELECT_TORP_III:
        return 'Torpedo III';
      default:
        return 'Unknown';
    }
  }
  
  /**
   * Получает максимальное время жизни торпеды в секундах
   */
  public getMaxTimeLifeSec(): number {
    return this.maxTimeLifeSec;
  }
  
  /**
   * Запускает ИИ - шаг 1 (анализ ситуации)
   */
  public AI_step_I(): void {
    // Базовая реализация - торпеда движется прямо
    // Будет переопределено в наследниках для самонаводящихся торпед
  }
  
  /**
   * Запускает ИИ - шаг 2 (принятие решений)
   */
  public AI_step_II(): void {
    // Базовая реализация - торпеда движется прямо
    // Будет переопределено в наследниках для самонаводящихся торпед
  }
} 