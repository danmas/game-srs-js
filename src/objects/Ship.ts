import Phaser from 'phaser';
import { Vehicle } from './Vehicle';
import { Constants } from '../utils/Constants';
import { Settings } from '../utils/Settings';
import { TorpedoParams } from './TorpedoParams';
import { Torpedo } from './Torpedo';
import { MainScene } from '../scenes/MainScene';
import { AIWeaponControl } from '../ai/AIWeaponControl';
import { AIStrategyFactory } from '../ai/strategies/AIStrategyFactory';
import { UniversalLogger, LogLevel } from '../utils/UniversalLogger';
import { AILogger } from '../utils/AILogger';

/**
 * Класс корабля - базовый класс для всех кораблей и подводных лодок
 */
export class Ship extends Vehicle {
  // Свойства
  protected sizeForHit: number = Settings.SHIP_HIT_SIZE;
  protected health: number = 1000;
  protected isConvoyShip: boolean = false;
  protected torpedoOnBoardI: number = 5;
  protected torpedoOnBoardII: number = 5;
  protected torpedoOnBoardIII: number = 5;
  protected torpedoReloadTimeMs: number = 15000;
  protected timeLastTorpedoFire: number = 0;
  
  // Параметры торпед
  protected torpedoParamsI: TorpedoParams | null = null;
  protected torpedoParamsII: TorpedoParams | null = null;
  protected torpedoParamsIII: TorpedoParams | null = null;
  
  // Время перезарядки оружия
  protected reloadTimeTorp1: number = 0;
  protected reloadTimeTorp2: number = 0;
  protected reloadTimeTorp3: number = 0;
  
  // Компонент для управления оружием ИИ
  private aiWeaponControl: AIWeaponControl | null = null;
  
  /**
   * Конструктор
   * @param scene Сцена
   * @param x Начальная позиция X
   * @param y Начальная позиция Y
   * @param forces Принадлежность (0 - red, 1 - white)
   */
  constructor(scene: Phaser.Scene, x: number, y: number, forces: number = Constants.FORCES_WHITE) {
    super(scene, x, y);
    
    // Устанавливаем принадлежность
    this.setForces(forces);
    
    // Устанавливаем базовую шумность для надводного корабля
    this.intrinsicNoisiness = 1.5; // Корабли немного шумнее базового Vehicle
    
    // Устанавливаем пониженную маневренность для кораблей (70%)
    this.manevr_prc = 70;
    
    // Инициализируем оружие
    this.initTorpedoParams();
    
    // Создаем интерактивность (возможность клика)
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', this.onClick, this);
    
    // Рисуем корабль только если это обычный корабль, а не подводная лодка
    if (this.constructor === Ship) {
      this.drawShip();
    }
    
    // Показываем начальное положение руля, если корабль под управлением
    if (this.underControl) {
      this.showRudder();
    } else {
      // Если корабль не под управлением игрока, создаем ему контроллер оружия ИИ
      this.aiWeaponControl = new AIWeaponControl(this, scene as MainScene);
      
      // Назначаем стратегию ИИ по умолчанию
      this.aiStrategy = AIStrategyFactory.getDefaultStrategy(this, scene as MainScene);
      UniversalLogger.log(`Ship ${this.id} initialized with AI strategy: ${this.aiStrategy?.name}, Active: ${this.active}`, 'SHIP_INIT', LogLevel.INFO);
    }
  }
  
  /**
   * Инициализирует параметры торпед
   */
  protected initTorpedoParams(): void {
    // В будущем здесь будет загрузка из хранилища
    this.torpedoParamsI = {
      maxVelocity: Settings.TRP_I_MAX_VELOCITY,
      lifeTimeSec: Settings.TRP_I_LIFE_TIME_SEC,
      maneuvering: Settings.TRP_I_MANEVR_PRC,
      reloadTimeSec: Settings.TRP_I_TIME_RELOAD_SEC,
      damage: Settings.TRP_I_DAMEGE,
      executionDist: Settings.TRP_I_DIST_EXECUTION
    };
    
    this.torpedoParamsII = {
      maxVelocity: Settings.TRP_II_MAX_VELOCITY,
      lifeTimeSec: Settings.TRP_II_LIFE_TIME_SEC,
      maneuvering: Settings.TRP_II_MANEVR_PRC,
      reloadTimeSec: Settings.TRP_II_TIME_RELOAD_SEC,
      damage: Settings.TRP_II_DAMEGE,
      executionDist: Settings.TRP_II_DIST_EXECUTION
    };
    
    this.torpedoParamsIII = {
      maxVelocity: Settings.TRP_III_MAX_VELOCITY,
      lifeTimeSec: Settings.TRP_III_LIFE_TIME_SEC,
      maneuvering: Settings.TRP_III_MANEVR_PRC,
      reloadTimeSec: Settings.TRP_III_TIME_RELOAD_SEC,
      damage: Settings.TRP_III_DAMEGE,
      executionDist: Settings.TRP_III_DIST_EXECUTION,
      targetAcceptDist: Settings.TRP_III_TRG_ACCEPT_DIST
    };
  }
  
  /**
   * Обрабатывает клик по кораблю
   */
  protected onClick(): void {
    // Визуально выделяем корабль
    this.setSelected(true);

    // Сообщаем главной сцене, что этот корабль теперь выбран для информера
    const mainScene = this.scene as MainScene; // Используем явное приведение типа, если MainScene импортирована
    if (mainScene && typeof mainScene.setSelectedVehicleForInformer === 'function') {
      mainScene.setSelectedVehicleForInformer(this);
    }
  }
  
  /**
   * Создание визуального представления корабля
   * Использует методы Phaser 3 для графики: fillStyle, fillCircle, strokeLine, strokeCircle
   * Создает спрайт через add.graphics как для порта
   */
  protected drawShip(): void {
    if (!this.scene || !this.active) { // Если сцена не существует или объект неактивен, ничего не делаем
      return;
    }
    // Определяем имя текстуры в зависимости от принадлежности
    const textureName = this.forces === Constants.FORCES_RED ? `ship_red_${this.id}` : `ship_white_${this.id}`;
    
    // Цвет зависит от принадлежности
    const mainColor = this.forces === Constants.FORCES_RED ? 
                     (this.underControl ? Constants.COLOR_LIGHT_RED : Constants.COLOR_DARK_RED) : 
                     (this.underControl ? Constants.COLOR_LIGHT_WHITE : Constants.COLOR_DARK_WHITE);
    const borderColor = 0x000000;
    
    // Создаем графику прямо через сцену
    const graphics = this.scene.add.graphics();
    
    // Очищаем графику
    graphics.clear();
    
    // Рисуем корабль: кружок с линией направления
    const radius = 10;
    const lineWidth = 2; // Толщина обводки и линии направления
    const lineLength = radius * 1.5; // Длина линии направления

    // Тело корабля (круг)
    graphics.fillStyle(mainColor, 1);
    const textureSize = (radius + lineWidth * 2) * 2 + lineLength * 2;
    const centerX = textureSize / 2;
    const centerY = textureSize / 2;
    graphics.fillCircle(centerX, centerY, radius);
    graphics.lineStyle(lineWidth, borderColor, 1);
    graphics.strokeCircle(centerX, centerY, radius);

    // Линия направления (используем this.rotation, так как Vehicle его устанавливает в радианах)
    // this.angle - в градусах, this.rotation - в радианах. Vehicle использует rotation.
    graphics.moveTo(centerX, centerY);
    graphics.lineTo(centerX + lineLength * Math.cos(this.rotation), 
                    centerY + lineLength * Math.sin(this.rotation));
    
    // Если корабль выбран, добавляем дополнительную отметку (желтый круг)
    if (this.displaySelected) {
      graphics.lineStyle(lineWidth, 0xFFFF00, 1); // Желтый цвет для выделения
      graphics.strokeCircle(centerX, centerY, radius + lineWidth * 2); // Чуть больший круг для выделения
    }
    
    // Создаем текстуру из графики
    // Увеличим размер генерируемой текстуры, чтобы вместить линию и выделение
    graphics.generateTexture(textureName, textureSize, textureSize);
    
    // Удаляем временную графику
    graphics.destroy();
    
    // Устанавливаем текстуру и размер
    this.setTexture(textureName);
    // Устанавливаем размер отображения спрайта. Можно сделать его чуть больше, чем сам корабль.
    this.setDisplaySize(40, 40); // Масштабируем для адекватного размера на экране
  }
  
  /**
   * Обновление состояния корабля
   * @param time Текущее время
   * @param delta Прошедшее время с последнего обновления
   */
  override update(time: number, delta: number): void {
    super.update(time, delta);
    
    // Обновляем время перезарядки оружия
    this.updateWeaponReload(delta);
  }
  
  /**
   * Обновление времени перезарядки оружия
   * @param delta Прошедшее время в мс
   */
  protected updateWeaponReload(delta: number): void {
    // Перезарядка торпед
    if (this.reloadTimeTorp1 > 0) {
      this.reloadTimeTorp1 -= delta;
      if (this.reloadTimeTorp1 < 0) this.reloadTimeTorp1 = 0;
    }
    
    if (this.reloadTimeTorp2 > 0) {
      this.reloadTimeTorp2 -= delta;
      if (this.reloadTimeTorp2 < 0) this.reloadTimeTorp2 = 0;
    }
    
    if (this.reloadTimeTorp3 > 0) {
      this.reloadTimeTorp3 -= delta;
      if (this.reloadTimeTorp3 < 0) this.reloadTimeTorp3 = 0;
    }
  }
  
  /**
   * Проверяет готовность оружия
   * @param weaponType Тип оружия
   */
  public isWeaponReady(weaponType: number): boolean {
    // Проверяем тип оружия
    switch (weaponType) {
      case Constants.WEAPON_SELECT_TORP_I:
        // Проверяем наличие и время перезарядки
        return this.torpedoOnBoardI > 0 && this.reloadTimeTorp1 <= 0;
      
      case Constants.WEAPON_SELECT_TORP_II:
        return this.torpedoOnBoardII > 0 && this.reloadTimeTorp2 <= 0;
      
      case Constants.WEAPON_SELECT_TORP_III:
        return this.torpedoOnBoardIII > 0 && this.reloadTimeTorp3 <= 0;
      
      default:
        return false;
    }
  }
  
  /**
   * Получает количество торпед на борту
   * @param weaponType Тип оружия
   */
  public getTorpOnBoard(weaponType: number): number {
    switch (weaponType) {
      case Constants.WEAPON_SELECT_TORP_I:
        return this.torpedoOnBoardI;
      
      case Constants.WEAPON_SELECT_TORP_II:
        return this.torpedoOnBoardII;
      
      case Constants.WEAPON_SELECT_TORP_III:
        return this.torpedoOnBoardIII;
      
      default:
        return 0;
    }
  }
  
  /**
   * Уменьшает количество торпед на борту
   * @param weaponType Тип оружия
   */
  public decrementTorpCount(weaponType: number): void {
    switch (weaponType) {
      case Constants.WEAPON_SELECT_TORP_I:
        if (this.torpedoOnBoardI > 0) {
          this.torpedoOnBoardI--;
          if (this.torpedoParamsI) {
            this.reloadTimeTorp1 = this.torpedoParamsI.reloadTimeSec * 1000;
          }
        }
        break;
      case Constants.WEAPON_SELECT_TORP_II:
        if (this.torpedoOnBoardII > 0) {
          this.torpedoOnBoardII--;
          if (this.torpedoParamsII) {
            this.reloadTimeTorp2 = this.torpedoParamsII.reloadTimeSec * 1000;
          }
        }
        break;
      case Constants.WEAPON_SELECT_TORP_III:
        if (this.torpedoOnBoardIII > 0) {
          this.torpedoOnBoardIII--;
          if (this.torpedoParamsIII) {
            this.reloadTimeTorp3 = this.torpedoParamsIII.reloadTimeSec * 1000;
          }
        }
        break;
    }
  }
  
  /**
   * Обрабатывает попадание в корабль
   * @param damage Нанесенный урон
   * @param attackerId ID корабля, который нанес урон (если известен)
   */
  public hasHit(damage: number, attackerId?: number | null): void {
    const oldHealth = this.health;
    const oldMaxVelocity = this.maxVelocity;
    const wasDestroyed = this.health <= damage;
    
    // Уменьшаем здоровье
    this.health -= damage;
    
    // Увеличиваем время перезарядки торпед
    this.torpedoReloadTimeMs *= Settings.HIT_TIME_RELOAD_INCREASE;
    
    // Уменьшаем скорость
    this.maxVelocity /= Settings.HIT_SHIP_SPEED_DECREASE;
    
    // Логируем изменение здоровья
    const strategyName = this.aiStrategy?.name || 'Unknown';
    UniversalLogger.log(
      `Ship ${this.id} received ${damage} damage (${oldHealth} -> ${this.health})`,
      `SHIP_DAMAGE`,
      wasDestroyed ? LogLevel.ERROR : LogLevel.WARN,
      {
        shipId: this.id,
        attackerId: attackerId || null,
        damage: damage,
        healthBefore: oldHealth,
        healthAfter: this.health,
        maxVelocityBefore: oldMaxVelocity,
        maxVelocityAfter: this.maxVelocity,
        strategy: strategyName,
        position: { x: this.x, y: this.y }
      }
    );
    
    // Проверяем, не уничтожен ли корабль
    if (this.health <= 0) {
      // Логируем уничтожение корабля
      UniversalLogger.log(
        `Ship ${this.id} destroyed`,
        `SHIP_DESTROYED`,
        LogLevel.ERROR,
        {
          shipId: this.id,
          finalHealth: this.health,
          attackerId: attackerId || null,
          strategy: strategyName,
          position: { x: this.x, y: this.y }
        }
      );
      
      // Логируем через AILogger для стратегии
      if (this.aiStrategy) {
        AILogger.log(
          this,
          strategyName,
          "Ship Destroyed",
          `Ship destroyed by ${damage} damage. Final health: ${this.health}`,
          LogLevel.ERROR,
          {
            attackerId: attackerId || null,
            finalHealth: this.health
          }
        );
      }
      
      this.destroy();
    }
  }
  
  /**
   * Проверяет, является ли корабль конвоем
   */
  public isConvoy(): boolean {
    return this.isConvoyShip;
  }
  
  /**
   * Получает размер корабля для определения попадания
   */
  public getSizeForHit(): number {
    return this.sizeForHit;
  }
  
  /**
   * Получает текущее здоровье корабля
   */
  public getHealth(): number {
    return this.health;
  }
  
  /**
   * Запускает ИИ - шаг 1 (анализ ситуации)
   * Делегирует выполнение базовому классу, который использует aiStrategy
   */
  public AI_step_I(): void {
    // Вызываем базовую реализацию, которая использует aiStrategy
    super.AI_step_I();
    
    // Для совместимости со старым кодом: если нет стратегии, используем старую логику
    if (!this.aiStrategy) {
      // Пример: если здоровье низкое, пытаемся уйти
      if (this.health < 200 && this.power < Vehicle.POWER_4) {
        this.setPower(Vehicle.POWER_4);
      }
    }
  }
  
  /**
   * Запускает ИИ - шаг 2 (принятие решений)
   * Делегирует выполнение базовому классу, который использует aiStrategy
   */
  public AI_step_II(): void {
    // Если неактивен или под контролем игрока, ничего не делаем
    if (!this.active || this.underControl) {
      return;
    }
    
    // Вызываем базовую реализацию, которая использует aiStrategy
    super.AI_step_II();
    
    // Для совместимости со старым кодом: если нет стратегии, используем старую логику
    if (!this.aiStrategy) {
      // Если корабль не в конвое, он может пытаться атаковать
      if (!this.isConvoyShip && this.aiWeaponControl) {
        this.aiWeaponControl.evaluateAndFire();
      }
    }
    
    // Если у корабля есть путь и он не движется по нему, запускаем движение
    // (эта логика может быть более сложной в зависимости от состояния ИИ)
    if (this.wayPoints.length > 0 && !this.isMovingOnWayPoint && this.moveState !== Vehicle.ST_WP_SEARCH_TARGET) {
      // Если мы не в режиме поиска цели по WP (который сам управляет стартом/стопом WP)
      // this.startMoveOnWP(); // Раскомментировать, если нужно авто-начало движения по WP
    }
    
    // Пример: если нет точек маршрута и не ищет цель, корабль может просто стоять или патрулировать
    if (this.wayPoints.length === 0 && this.moveState === Vehicle.ST_MOVE_UNKNOWN) {
        // this.setPower(Vehicle.POWER_0); // Например, остановить
        // или this.generateRandomWayPoint(Constants.WP_TYPE_PATROL_AREA); // Начать патрулирование
    }
  }
  
  /**
   * Переопределяем обработчик достижения точки маршрута из Vehicle
   * @param pointType Тип достигнутой точки
   * @param isLastPoint Является ли точка последней
   */
  protected override onWayPointReached(pointType: number, isLastPoint: boolean): void {
    super.onWayPointReached(pointType, isLastPoint); // Вызываем базовую реализацию (для логирования)
    console.log(`Ship ${this.id} reached WP type: ${pointType}, isLast: ${isLastPoint}. Current AI state: ${this.moveState}`);

    if (this.moveState === Vehicle.ST_WP_SEARCH_TARGET) {
      if (pointType === Constants.WP_TYPE_SEARCH) {
        // Достигли точки поиска. Можно, например, постоять немного или изменить направление поиска.
        // В AS здесь был вызов this.stop(), this.target_locked = false и т.д.
        // Пока просто остановим движение по WP, если это была последняя точка поиска
        if (isLastPoint) {
          console.log(`AI ${this.id}: Search WP sequence finished.`);
          // this.stopMoveOnWayPoint(); // ST_WP_FINISHED будет установлен в onWayPointSequenceFinished
        } else {
          // Если это не последняя точка в серии поисковых точек, просто продолжаем
        }
      }
    } else if (this.moveState === Vehicle.ST_WP_CONVOY_MOVING) {
      if (pointType === Constants.WP_TYPE_CONVOY) {
        if (isLastPoint) {
          console.log(`AI ${this.id}: Convoy WP sequence finished. Holding position or awaiting new orders.`);
          // this.setPower(Vehicle.POWER_0); // Например, остановиться
          // this.stopMoveOnWayPoint();
        }
      }
    } else if (this.moveState === Vehicle.ST_WP_TORP_DEFENCE_MOVING) {
        if (pointType === Constants.WP_TYPE_MANEUVER) {
            if (isLastPoint) {
                console.log(`AI ${this.id}: Maneuver WP sequence finished. Assessing situation.`);
                // После маневра можно вернуться к предыдущей задаче или переоценить обстановку
                // this.moveState = Vehicle.ST_MOVE_UNKNOWN; // Сбросить состояние маневра
                // this.stopMoveOnWayPoint();
            }
        }
    }
    // Другие реакции на типы точек и состояния AI...
  }

  /**
   * Переопределяем обработчик завершения всей последовательности путевых точек
   */
  protected override onWayPointSequenceFinished(): void {
    super.onWayPointSequenceFinished(); // Вызываем базовую реализацию (установка флагов, руля)
    console.log(`Ship ${this.id} finished WP sequence. AI state was: ${this.moveState}`);

    // В зависимости от состояния AI, решаем, что делать дальше
    if (this.moveState === Vehicle.ST_WP_SEARCH_TARGET) {
      // Последовательность поиска завершена, генерируем новую точку поиска (или серию точек)
      // this.generateRandomWayPoint(Constants.WP_TYPE_SEARCH); // Начнет новую последовательность
      // Либо переходим в другое состояние, если цель найдена или время вышло
      this.moveState = Vehicle.ST_MOVE_UNKNOWN; // Пример: сброс в общее состояние
      console.log(`AI ${this.id}: Search sequence complete. Resetting AI state.`);
    } else if (this.moveState === Vehicle.ST_WP_CONVOY_MOVING) {
      // Завершили движение по точкам конвоя. Возможно, ждем новых указаний или занимаем позицию.
      this.setPower(Vehicle.POWER_0); // Например, остановиться
      this.moveState = Vehicle.ST_MOVE_UNKNOWN; // Сброс
      console.log(`AI ${this.id}: Convoy sequence complete. Holding or resetting AI state.`);
    } else if (this.moveState === Vehicle.ST_WP_TORP_DEFENCE_MOVING) {
        this.moveState = Vehicle.ST_MOVE_UNKNOWN; // Маневр завершен, сбрасываем состояние
        console.log(`AI ${this.id}: Maneuver sequence complete. Resetting AI state.`);
    }
    // Если мы просто двигались по команде (ST_WP_MOVING), то базовая реализация уже все сделала (остановила движение).
  }

  /**
   * Генерирует случайную путевую точку и начинает движение к ней.
   * Используется для простого AI поведения, например, для поиска.
   * @param wpType Тип создаваемой путевой точки.
   */
  private generateRandomWayPoint(wpType: number = Constants.WP_TYPE_SEARCH): void {
    const margin = 200; // Отступ от границ мира
    const randomX = Phaser.Math.Between(margin - Settings.GAME_WORLD_WIDTH / 2, Settings.GAME_WORLD_WIDTH / 2 - margin);
    const randomY = Phaser.Math.Between(margin - Settings.GAME_WORLD_HEIGHT / 2, Settings.GAME_WORLD_HEIGHT / 2 - margin);

    this.clearWayPoints(); // Очищаем предыдущие точки
    this.addWayPoint(randomX, randomY, wpType);
    
    // Устанавливаем мощность для движения, если корабль не движется уже достаточно быстро
    if (this.getPower() < Vehicle.POWER_3) {
        this.setPower(Vehicle.POWER_4); // Средняя мощность для движения к точке
    }
    this.startMoveOnWP();
  }
  
  /**
   * Получает уровень шума корабля.
   * Этот метод теперь соответствует новой системе, унаследованной от Vehicle.
   * Если у Ship есть специфические модификаторы к "конечной силе шума",
   * их можно добавить здесь, вызвав super.getNoiseStrength() или this.getSourceNoiseLevel().
   * В данном случае, предполагаем, что Ship не добавляет таких модификаторов,
   * поэтому он может либо наследовать getNoiseStrength от Vehicle,
   * либо для ясности явно вызывать this.getSourceNoiseLevel().
   */
  public override getNoiseStrength(): number {
    // Для корабля просто возвращаем его уровень шума у источника.
    // Специфические модификаторы (если есть) должны быть в getSourceNoiseLevel()
    // или, если они влияют на конечную силу, добавлены здесь.
    // Сейчас Ship не имеет таких, так что это эквивалентно наследованию от Vehicle,
    // если Vehicle.getNoiseStrength() возвращает this.getSourceNoiseLevel().
    return this.getSourceNoiseLevel(); 
  }
} 