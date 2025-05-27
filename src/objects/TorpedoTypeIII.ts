import Phaser from 'phaser';
import { Torpedo } from './Torpedo';
import { Vehicle } from './Vehicle';
import { Ship } from './Ship';
import { Constants } from '../utils/Constants';
import { Settings } from '../utils/Settings';
import { TorpedoParams } from './TorpedoParams';
import { PhysicsUtils } from '../utils/PhysicsUtils';
import { MainScene } from '../scenes/MainScene';
import { CoordUtils } from '../utils/CoordUtils';

/**
 * Торпеда Тип III - самонаводящаяся торпеда, ищущая цели по шуму
 */
export class TorpedoTypeIII extends Torpedo {
  // Свойства самонаводящейся торпеды
  protected targetAcceptDist: number = 0;
  protected targetShip: Ship | null = null;
  protected searchTimeMs: number = 0;
  protected noiseDetectionRange: number = 0;
  
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
    super(scene, x, y, angle, params, forces);
    
    // Устанавливаем тип торпеды
    this.weaponType = Constants.WEAPON_SELECT_TORP_III;
    
    // Устанавливаем параметры самонаведения
    if (params.targetAcceptDist) {
      this.targetAcceptDist = params.targetAcceptDist;
    } else {
      this.targetAcceptDist = Settings.TRP_III_TRG_ACCEPT_DIST;
    }
    
    // Инициализируем поиск
    this.searchTimeMs = 0;
    this.noiseDetectionRange = this.maxVelocity * Settings.NOISE_THRESHOLD_ZONE_1_UNCERTAIN;
  }
  
  /**
   * Переопределяем метод отрисовки самонаводящейся торпеды
   */
  protected drawVehicle(): void {
    // Создаем графику для торпеды
    const graphics = (this.scene.add as Phaser.GameObjects.GameObjectFactory).graphics();
    
    // Выбираем цвет в зависимости от принадлежности
    graphics.fillStyle(this.color, 1);
    
    // Рисуем форму торпеды (заостренная форма)
    graphics.beginPath();
    graphics.moveTo(0, -5);      // Нос
    graphics.lineTo(2, -2);      // Правый борт (нос)
    graphics.lineTo(2, 4);       // Правый борт (корма)
    graphics.lineTo(-2, 4);      // Корма
    graphics.lineTo(-2, -2);     // Левый борт (корма)
    graphics.closePath();
    graphics.fill();
    
    // Добавляем "сенсоры" шума
    graphics.fillStyle(0xCCCCCC, 1);
    graphics.fillRect(-3, -1, 1, 2);
    graphics.fillRect(2, -1, 1, 2);
    
    // Генерируем текстуру
    graphics.generateTexture('torpedo_type_iii', 8, 14);
    graphics.destroy();
    
    // Устанавливаем текстуру
    this.setTexture('torpedo_type_iii');
  }
  
  /**
   * Находит ближайший корабль противника с наибольшим шумом
   */
  private findNoisestEnemyShip(): Ship | null {
    // Определяем массив кораблей противоположной стороны
    let enemyShips: Ship[] = [];
    
    if (this.forces === Constants.FORCES_RED) {
      // Красная торпеда ищет белые корабли
      const scene = this.scene as any;
      if (scene.getWhiteShips) {
        enemyShips = scene.getWhiteShips();
      }
    } else {
      // Белая торпеда ищет красные корабли
      const scene = this.scene as any;
      if (scene.getRedShips) {
        enemyShips = scene.getRedShips();
      }
    }
    
    // Если нет кораблей, выходим
    if (enemyShips.length === 0) {
      return null;
    }
    
    // Находим корабль с максимальным шумом в пределах дистанции
    let maxNoiseShip: Ship | null = null;
    let maxNoise = 0;
    
    for (const ship of enemyShips) {
      // Вычисляем расстояние до корабля
      const dist = Phaser.Math.Distance.Between(
        this.position.x, this.position.y,
        ship.getPosition().x, ship.getPosition().y
      );
      
      // Если корабль в пределах диапазона обнаружения
      if (dist < this.noiseDetectionRange) {
        // Получаем уровень шума корабля с учетом расстояния
        const noise = PhysicsUtils.getReceivedNoiseLevel(ship, this.getPosition());
        
        // Если шум выше максимального, запоминаем корабль
        if (noise > maxNoise) {
          maxNoise = noise;
          maxNoiseShip = ship;
        }
      }
    }
    
    return maxNoiseShip;
  }
  
  /**
   * Торпеда типа III ищет цели по шуму
   */
  public AI_step_I(): void {
    // Увеличиваем время поиска
    this.searchTimeMs += Settings.SLOW_LOOP_INTERVAL_MS;
    
    // Каждые 3 секунды обновляем поиск цели
    if (this.searchTimeMs >= 3000) {
      this.searchTimeMs = 0;
      
      // Если у нас нет цели или она находится слишком далеко
      if (!this.targetShip) {
        // Ищем новую цель
        this.targetShip = this.findNoisestEnemyShip();
      } else {
        // Проверяем, не ушла ли цель слишком далеко
        const dist = Phaser.Math.Distance.Between(
          this.position.x, this.position.y,
          this.targetShip.getPosition().x, this.targetShip.getPosition().y
        );
        
        // Если цель слишком далеко, ищем новую
        if (dist > this.noiseDetectionRange) {
          this.targetShip = this.findNoisestEnemyShip();
        }
      }
    }
  }
  
  /**
   * Торпеда типа III меняет направление на цель
   */
  public AI_step_II(): void {
    if (!this.active || this.moveState === Vehicle.ST_WP_MOVING) {
        return; // Уже движется к цели по WP или неактивна
    }

    let closestEnemy: Ship | null = null;
    let minDistance = Infinity;
    const mainScene = this.scene as MainScene;

    // Определяем, какие корабли являются вражескими
    const enemyShips = this.getForces() === Constants.FORCES_WHITE ? mainScene.getRedShips() : mainScene.getWhiteShips();

    for (const enemy of enemyShips) {
      if (!enemy.active) continue;

      // Проверяем, видимо ли цель для самонаводящейся торпеды
      // Используем порог для Зоны 1 как минимальный для "замечания" цели
      const noiseReceivedByTorpedo = PhysicsUtils.getReceivedNoiseLevel(enemy, this.getPosition());
      // Исправление для строки ~51
      if (noiseReceivedByTorpedo < Settings.NOISE_THRESHOLD_ZONE_1_UNCERTAIN) { 
        continue; // Цель слишком тихая или далеко, чтобы торпеда ее "увидела"
      }

      const distance = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
      if (distance < minDistance && distance < this.targetAcceptDist) {
        minDistance = distance;
        closestEnemy = enemy;
      }
    }

    if (closestEnemy) {
      // Нашлись на цель, устанавливаем ее как WP
      this.clearWayPoints(); 
      const targetLogicalPos = CoordUtils.phaserToLogical(closestEnemy.getPosition());
      this.addWayPoint(targetLogicalPos.x, targetLogicalPos.y, Constants.WP_TYPE_TORPEDO_TARGET);
      this.startMoveOnWP(); 
      this.moveState = Vehicle.ST_WP_MOVING; // Указываем, что движемся к цели
      // console.log(`TorpedoTypeIII ${this.id} found target ${closestEnemy.id} at ${minDistance.toFixed(0)} units. Heading to WP.`);
    } else {
      // Цель не найдена (или вышла из радиуса), продолжаем движение по прямой или по последнему курсу
      if (this.moveState === Vehicle.ST_WP_MOVING) {
        // Если ранее двигались к цели, но потеряли ее, останавливаем движение по WP
        // и продолжаем по последнему курсу.
        this.stopMoveOnWayPoint(); // Это сбросит isMovingOnWayPoint и rudder
        // this.moveState = Vehicle.ST_COMMAND_MOVING; // или ST_MOVE_UNKNOWN
      }
      // Если this.power == 0, а должен двигаться прямо, то нужно дать ему тягу
      if (this.getPower() === Vehicle.POWER_0) {
        this.setPower(Vehicle.POWER_4); // Средний ход для продолжения поиска
      }
    }
  }
} 