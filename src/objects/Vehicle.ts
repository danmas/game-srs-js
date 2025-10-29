import Phaser from 'phaser';
import { Constants } from '../utils/Constants';
import { Settings } from '../utils/Settings';
import { CoordUtils } from '../utils/CoordUtils';
import { MainScene } from '../scenes/MainScene';
import { DetectionState } from '../utils/DetectionState';
import { PerceivedTargetInfo } from '../interfaces/PerceivedTargetInfo';
import { PhysicsUtils } from '../utils/PhysicsUtils';
import { Informer } from '../utils/Informer';
import { Ship } from './Ship';
import { AIStrategy, AIWorldContext } from '../ai/strategies/AIStrategy';
import { UniversalLogger, LogLevel, LogContext } from '../utils/UniversalLogger';

/**
 * Базовый класс для всех движущихся объектов
 */
export interface WayPointData {
  point: Phaser.Math.Vector2;
  type: number;
  graphics?: Phaser.GameObjects.Graphics;
}

export interface LogState {
  lastLoggedState: {
    [key: string]: any;  // Хранит последнее состояние для каждого типа лога
  };
  lastLogTime: {
    [key: string]: number;  // Хранит время последнего лога для каждого типа
  };
  logCounter: {
    [key: string]: number;  // Счетчик для логирования каждые N тиков
  };
}

export class Vehicle extends Phaser.GameObjects.Sprite {
  // Стратегия ИИ для этого объекта
  public aiStrategy: AIStrategy | null = null;
  
  // Состояние логирования для дросселирования
  public logState: LogState = {
    lastLoggedState: {},
    lastLogTime: {},
    logCounter: {}
  };
  // Константы для уровней мощности
  static readonly POWER_0: number = 0;
  static readonly POWER_1: number = 1;
  static readonly POWER_2: number = 2;
  static readonly POWER_3: number = 3;
  static readonly POWER_4: number = 4;
  static readonly POWER_5: number = 5;
  static readonly POWER_6: number = 6;
  
  // Константы для состояний движения
  static readonly ST_MOVE_UNKNOWN: number = 0;
  static readonly ST_WP_MOVING: number = 1;
  static readonly ST_COMMAND_MOVING: number = 2;
  static readonly ST_WP_SEARCH_TARGET: number = 3;
  static readonly ST_WP_TORP_DEFENCE_MOVING: number = 4;
  static readonly ST_WP_FINISHED: number = 5;
  static readonly ST_WP_CONVOY_MOVING: number = 6; // Добавлено состояние для движения в конвое
  
  // Константы для положения руля
  static readonly RUDER_RIGHT_15: number = -3;
  static readonly RUDER_RIGHT_10: number = -2;
  static readonly RUDER_RIGHT_5: number = -1;
  static readonly RUDER_0: number = 0;
  static readonly RUDER_LEFT_5: number = 1;
  static readonly RUDER_LEFT_10: number = 2;
  static readonly RUDER_LEFT_15: number = 3;
  
  // Константы для отображения WayPoint
  static readonly WAY_POINT_COLOR: number = 0x00FF00; // Зеленый для обычных WP
  static readonly TORPEDO_WAY_POINT_COLOR: number = 0x0000FF; // Синий для WP торпед
  static readonly WAY_POINT_RADIUS: number = 8; // Уменьшил радиус для лучшего вида
  static readonly TORPEDO_WP_CROSS_SIZE: number = 8; // Размер крестика для WP торпед
  static readonly WAYPOINT_CLICK_DELETE_THRESHOLD: number = 15; 
  static readonly ANGLE_PRECISION_FOR_WP: number = 5; 
  
  // Статический счетчик для уникальных ID
  private static nextId: number = 0;

  // Свойства объекта
  public readonly id: number; // Уникальный идентификатор объекта
  public readonly entityType: string = 'Vehicle'; // Тип сущности, по умолчанию 'Vehicle'
  protected position: Phaser.Math.Vector2;
  protected velocity: Phaser.Math.Vector2;
  protected direction: number = 0;
  protected directionTarget: number = 0;
  protected power: number = Vehicle.POWER_0;
  protected rudder: number = Vehicle.RUDER_0; // Положение руля
  protected maxVelocity: number = 30;
  protected color: number = 0xFFFFFF;
  protected forces: number = Constants.FORCES_WHITE;
  protected timeLive: number = 0;
  protected underControl: boolean = false;
  protected displaySelected: boolean = false;
  protected moveState: number = Vehicle.ST_MOVE_UNKNOWN;
  protected wayPoints: WayPointData[] = [];
  protected currentWayPointIndex: number = -1;
  public isMovingOnWayPoint: boolean = false;
  protected arrivalThreshold: number = 30; // Дистанция для регистрации прибытия к точке (WAY_POINT_SIZE в AS был 30)
  
  // Маневренность в процентах (100 - торпеды и катера, 50-80 - корабли)
  protected manevr_prc: number = 100;
  
  // Базовая шумность объекта, может переопределяться в дочерних классах
  public intrinsicNoisiness: number = 1.0;

  // Графика для отображения кругов шума
  private noiseCirclesGraphics: Phaser.GameObjects.Graphics | null = null;

  // Пороговые значения и стили для отображения кругов шума (на основе AS-версии)
  // Красные оттенки для врагов
  private static readonly NOISE_DISPLAY_THRESHOLDS_RED = [
    // ПОРЯДОК ВАЖЕН ДЛЯ ОТРИСОВКИ, ЧТОБЫ БОЛЬШИЕ КРУГИ НЕ ПЕРЕКРЫВАЛИ МЕНЬШИЕ, ЕСЛИ БУДЕТ ЗАЛИВКА
    // НО ТАК КАК У НАС ТОЛЬКО ЛИНИИ, ПОРЯДОК НЕ СТОЛЬ КРИТИЧЕН.
    // ДЛЯ СООТВЕТСТВИЯ С AS, ГДЕ СНАЧАЛА РИСУЕТСЯ ДЛЯ 0.2, ПОТОМ 0.5, ПОТОМ 0.8:
    { threshold: 0.8, color: 0xFF0000, alphaLine: 1.0, lineThickness: 2 }, // Темно-красный (пример)
    { threshold: 0.5, color: 0xFF6347, alphaLine: 1.0, lineThickness: 2 }, // Средне-красный (томатный - пример)
    { threshold: 0.2, color: 0xFFA07A, alphaLine: 1.0, lineThickness: 2 }  // Светло-красный (светло-лососевый - пример)
  ];
  
  // Синие оттенки для игрока
  private static readonly NOISE_DISPLAY_THRESHOLDS_BLUE = [
    { threshold: 0.8, color: 0x000080, alphaLine: 1.0, lineThickness: 2 }, // Темно-синий
    { threshold: 0.5, color: 0x1E90FF, alphaLine: 1.0, lineThickness: 2 }, // Средне-синий (DodgerBlue)
    { threshold: 0.2, color: 0x87CEFA, alphaLine: 1.0, lineThickness: 2 }  // Светло-синий (LightSkyBlue)
  ];
  
  // Ссылка на AS массив для обратной совместимости
  private static readonly NOISE_DISPLAY_THRESHOLDS_AS = Vehicle.NOISE_DISPLAY_THRESHOLDS_RED;

  // Новые поля для сенсоров и отображения
  public perceivedTargets: Map<number, PerceivedTargetInfo>;
  private truePhaserPosition: Phaser.Math.Vector2;
  public textInfo: Phaser.GameObjects.Text | null = null;
  private lastKnownPlayerShipForSensorMessages: Ship | null = null; // Для предотвращения дублирования сообщений
  public isPositionOverriddenBySensorEffect: boolean = false; // <--- ВОЗВРАЩАЕМ ФЛАГ

  /**
   * Конструктор
   * @param scene Сцена, к которой принадлежит объект
   * @param x Начальная позиция X
   * @param y Начальная позиция Y
   * @param texture Текстура спрайта
   */
  constructor(scene: Phaser.Scene, x: number, y: number, texture?: string) {
    super(scene, x, y, texture || 'vehicle');
    this.position = new Phaser.Math.Vector2(x, y);
    this.velocity = new Phaser.Math.Vector2(0, 0);
    this.id = Vehicle.nextId++; // Присваиваем уникальный ID и инкрементируем счетчик
    
    // Инициализация новых полей
    this.perceivedTargets = new Map<number, PerceivedTargetInfo>();
    this.truePhaserPosition = new Phaser.Math.Vector2(this.position.x, this.position.y);

    // Добавление в сцену
    (scene.add as Phaser.GameObjects.GameObjectFactory).existing(this);
    
    // Создание текстового поля для информации
    this.textInfo = scene.add.text(this.x, this.y - this.displayHeight / 2 - 10, `ID: ${this.id}`, {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#ffffff',
      align: 'center'
    });
    this.textInfo.setOrigin(0.5, 1);
    this.textInfo.setDepth(this.depth + 1); // Выше спрайта
    this.textInfo.setVisible(false); // По умолчанию скрыто, будет управляться логикой сенсоров

    // Если нет текстуры, рисуем стандартную фигуру
    if (!texture) {
      this.drawVehicle();
    }

    // Инициализация графики для кругов шума
    this.noiseCirclesGraphics = this.scene.add.graphics(); // x, y будут установлены в update
    this.noiseCirclesGraphics.setDepth(this.depth - 1); // Рисуем под основным спрайтом Vehicle
  }
  
  /**
   * Рисует стандартную фигуру для объекта
   */
  protected drawVehicle(): void {
    if (!this.scene || !this.active) { // Если сцена не существует или объект неактивен, ничего не делаем
      return;
    }
    // Создаем графику для отрисовки
    const graphics = (this.scene.add as Phaser.GameObjects.GameObjectFactory).graphics();
    
    // Очищаем графику
    graphics.clear();
    
    // Рисуем более заметный объект (треугольник)
    graphics.fillStyle(this.color, 1);
    graphics.lineStyle(2, 0x000000, 1);
    
    // Треугольник для обозначения направления движения
    graphics.beginPath();
    graphics.moveTo(0, -20);    // Вершина (нос)
    graphics.lineTo(-15, 15);   // Левый нижний угол (корма)
    graphics.lineTo(15, 15);    // Правый нижний угол (корма)
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
    
    // Создаем текстуру из графики
    const textureName = 'vehicle' + this.forces; // Разные текстуры для разных сторон
    graphics.generateTexture(textureName, 40, 40);
    graphics.destroy();
    
    // Устанавливаем текстуру
    this.setTexture(textureName);
    this.setDisplaySize(40, 40);
  }
  
  /**
   * Обновляет позицию и состояние объекта
   * @param time Текущее время
   * @param delta Прошедшее с последнего обновления время в мс
   */
  update(time: number, delta: number): void {
    this.timeLive += delta;
    
    if (this.isMovingOnWayPoint) {
      this.updateMoveOnWayPoint(delta);
    }
    
    this.updatePhysics(delta);
    
    let logMsg = `Vehicle [${this.id}] update: `;
    if (!this.isPositionOverriddenBySensorEffect) {
        this.setPosition(this.position.x, this.position.y); 
        logMsg += `NOT overridden. Set pos to PHYS (${this.position.x.toFixed(0)}, ${this.position.y.toFixed(0)}). Sprite is now at (${this.x.toFixed(0)}, ${this.y.toFixed(0)}).`;
    } else {
        logMsg += `OVERRIDDEN by sensor. Sprite pos REMAINS (${this.x.toFixed(0)}, ${this.y.toFixed(0)}). True phys still (${this.position.x.toFixed(0)}, ${this.position.y.toFixed(0)}).`;
    }

    this.setRotation(Phaser.Math.DegToRad(this.direction));

    if (this.textInfo) { 
        if (this.textInfo.visible) { 
            this.textInfo.setPosition(this.x, this.y - this.displayHeight / 2 - 10);
        }
    }

    if (Settings.DEBUG) { 
        console.log(logMsg + ` Visible: ${this.visible}, EntityType: ${this.entityType}, OverriddenFlagValueAtEndOfVehicleUpdate: ${this.isPositionOverriddenBySensorEffect}`);
    }

    if (this.noiseCirclesGraphics) {
      const mainScene = this.scene as MainScene;
      const isMethodAvailable = mainScene && typeof mainScene.isDebugPanelActive === 'function';
      const debugPanelIsActive = isMethodAvailable && mainScene.isDebugPanelActive();
      const showAllNoiseCirclesInDebug = Settings.DEBUG && debugPanelIsActive;
      
      const shouldShowForEntityType = this.entityType !== 'Torpedo';
      const finalShouldShowCircles = (this.displaySelected || showAllNoiseCirclesInDebug) && shouldShowForEntityType;

      if (finalShouldShowCircles) {
        this.updateNoiseCircles(); 
        this.noiseCirclesGraphics.x = this.truePhaserPosition.x;
        this.noiseCirclesGraphics.y = this.truePhaserPosition.y;
        this.noiseCirclesGraphics.visible = true;
      } else {
        this.noiseCirclesGraphics.visible = false;
      }
    }
  }
  
  /**
   * Обновляет физику объекта
   * @param delta Прошедшее время в мс
   */
  protected updatePhysics(delta: number): void {
    const deltaSeconds = delta / 1000;
    
    // Обновление направления на основе положения руля, если руль не в нейтральном положении
    if (this.rudder !== Vehicle.RUDER_0) {
      const turnFactor = this.rudder * this.getAlphaR() * this.velocity.length();
      this.direction -= delta * turnFactor;
      this.direction = (this.direction + 360) % 360;
      this.directionTarget = this.direction;
    }
    else if (this.direction !== this.directionTarget) {
      let diff = this.directionTarget - this.direction;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      let turnRate = this.power * (Settings.alfa_r_0 + Settings.alfa_r_30);
      if (Math.abs(diff) <= turnRate * deltaSeconds) {
        this.direction = this.directionTarget;
      } else {
        this.direction += Math.sign(diff) * turnRate * deltaSeconds;
      }
      this.direction = (this.direction + 360) % 360;
    }
    
    // Обновление скорости в зависимости от мощности
    const targetSpeed = this.power * this.maxVelocity / Vehicle.POWER_6;
    let currentSpeed = this.velocity.length(); 
    const inertiaFactor = Settings.alfa_v * 1000; 

    if (Math.abs(currentSpeed - targetSpeed) > 0.01) {
        const speedChange = (targetSpeed - currentSpeed) * inertiaFactor * deltaSeconds;
        currentSpeed = Math.max(0, currentSpeed + speedChange);
    } else if (targetSpeed > 0 && currentSpeed < targetSpeed) {
        currentSpeed = targetSpeed; 
    }
    
    if (currentSpeed < 0.01 && targetSpeed > 0.01) {
        currentSpeed = targetSpeed * 0.1; 
    }

    // Устанавливаем вектор скорости в соответствии с this.direction и currentSpeed
    if (currentSpeed > 0) {
        this.velocity.setTo(0, -currentSpeed); // Направляем вверх (0 градусов) и масштабируем
        this.velocity.rotate(Phaser.Math.DegToRad(this.direction)); // Поворачиваем по текущему курсу корабля
    } else {
        this.velocity.setTo(0, 0); // Если скорости нет, обнуляем вектор
    }

    // Обновление позиции на основе скорости и направления
    this.position.x += this.velocity.x * deltaSeconds;
    this.position.y += this.velocity.y * deltaSeconds;

    // truePhaserPosition всегда отражает актуальную физическую позицию this.position
    this.truePhaserPosition.set(this.position.x, this.position.y);
  }
  
  /**
   * Получает коэффициент поворота в зависимости от скорости
   * Аналог getAlphaR из ActionScript версии
   */
  protected getAlphaR(): number {
    const vel = this.velocity.length();
    // Базовая формула из ActionScript:
    // ar = (Settings.alfa_r_30 - Settings.alfa_r_0) / (100.*Settings.koef_v) * vel + Settings.alfa_r_0;
    const ar = (Settings.alfa_r_30 - Settings.alfa_r_0) / (100 * Settings.koef_v) * vel + Settings.alfa_r_0;
    
    // Учитываем маневренность как в оригинальной AS-версии
    return ar * this.manevr_prc / 100;
  }
  
  /**
   * Добавляет точку маршрута
   * @param logicalX Координата X
   * @param logicalY Координата Y
   * @param type Тип точки маршрута
   */
  public addWayPoint(logicalX: number, logicalY: number, type: number = Constants.WP_TYPE_MOVE): void {
    const phaserPoint = new Phaser.Math.Vector2(
        CoordUtils.logicalToPhaserX(logicalX),
        CoordUtils.logicalToPhaserY(logicalY)
    );

    const wpGraphics = this.scene.add.graphics({ x: phaserPoint.x, y: phaserPoint.y });
    wpGraphics.setDepth(Constants.DEPTH_WAYPOINT !== undefined ? Constants.DEPTH_WAYPOINT : 90); 

    const isTorpedoWPStyle = (this.entityType === 'Torpedo') || 
                        type === Constants.WP_TYPE_TARGET || 
                        type === Constants.WP_TYPE_TORPEDO_TARGET;

    if (isTorpedoWPStyle) {
        // console.log(`[Vehicle.addWayPoint] Drawing TORPEDO waypoint for entity ID: ${this.id}, type: ${this.entityType}`); // УДАЛЯЕМ ОТЛАДКУ
        const size = Vehicle.TORPEDO_WP_CROSS_SIZE;
        wpGraphics.lineStyle(2, Vehicle.TORPEDO_WAY_POINT_COLOR, 1);
        wpGraphics.beginPath();
        wpGraphics.moveTo(-size, 0);
        wpGraphics.lineTo(size, 0);
        wpGraphics.moveTo(0, -size);
        wpGraphics.lineTo(0, size);
        wpGraphics.strokePath();
    } else {
        // console.log(`[Vehicle.addWayPoint] Drawing REGULAR waypoint for entity ID: ${this.id}, type: ${this.entityType}`); // УДАЛЯЕМ ОТЛАДКУ
        const radius = Vehicle.WAY_POINT_RADIUS;
        wpGraphics.fillStyle(Vehicle.WAY_POINT_COLOR, 0.2);
        wpGraphics.fillCircle(0, 0, radius); 
        wpGraphics.lineStyle(1.5, Vehicle.WAY_POINT_COLOR, 0.9);
        wpGraphics.strokeCircle(0, 0, radius); 
    }

    const newWayPoint: WayPointData = {
        point: new Phaser.Math.Vector2(logicalX, logicalY), 
        type: type,
        graphics: wpGraphics
    };

    this.wayPoints.push(newWayPoint);

    if (this.currentWayPointIndex === -1 && this.wayPoints.length > 0) {
        this.currentWayPointIndex = 0;
    }
    
    if (wpGraphics) {
        if (this.entityType === 'Torpedo') {
            wpGraphics.setVisible(true); // WP, принадлежащие торпеде, всегда видимы
        } else {
            wpGraphics.setVisible(this.displaySelected); // WP других юнитов зависят от выбора
        }
    }
  }
  
  /**
   * Начинает движение по текущему маршруту из путевых точек.
   * Устанавливает мощность по умолчанию, если не было иной логики.
   */
  public startMoveOnWP(): void {
    if (this.wayPoints.length > 0) {
      this.currentWayPointIndex = 0;
      this.isMovingOnWayPoint = true;
      this.moveState = Vehicle.ST_WP_MOVING; // Устанавливаем состояние движения по WP
      
      // Включаем двигатель, если начинаем движение по WP и мощность была нулевая
      if (this.power === Vehicle.POWER_0) {
        this.setPower(Vehicle.POWER_4); // Например, на средний ход
        console.log(`${this.constructor.name} ${this.id} starting WP sequence. Set POWER_4 as default.`);
      }

      console.log(`${this.constructor.name} ${this.id} starting WP sequence. First target:`, this.wayPoints[this.currentWayPointIndex].point);
    } else {
      this.isMovingOnWayPoint = false;
      this.moveState = Vehicle.ST_MOVE_UNKNOWN; // или ST_WP_FINISHED, если это более подходяще
    }

    // Если это корабль игрока и он под контролем, и есть точки, включаем лампочку WP
    // Если точек нет (например, был вызван clearWayPoints, а затем startMoveOnWP без точек), то гасим.
    if (this.underControl && this.scene instanceof MainScene) {
      const mainScene = this.scene as MainScene;
      if (mainScene.informer) {
        mainScene.informer.panelLampOff(Constants.LAMP_WP);
      }
    }
  }
  
  /**
   * Немедленно останавливает движение по маршруту и очищает все путевые точки.
   */
  public stopMoveOnWayPoint(): void {
    this.isMovingOnWayPoint = false;
    this.currentWayPointIndex = -1;
    this.moveState = Vehicle.ST_WP_FINISHED; // Состояние: завершено движение по WP
    this.setRudder(Vehicle.RUDER_0); // Сбрасываем руль в нейтральное положение
    // this.clearWayPoints(); // Не очищаем здесь, чтобы можно было возобновить или проанализировать маршрут
    // Очистка должна быть явной через clearWayPoints() или при добавлении нового маршрута
    this.onWayPointSequenceFinished(); // Уведомляем, что вся последовательность завершена (или прервана)
    console.log(`${this.constructor.name} ${this.id} stopped WP sequence.`);
  }
  
  /**
   * Очищает все путевые точки из маршрута.
   * Также удаляет их визуальное представление, если оно было.
   */
  public clearWayPoints(): void {
    for (const wp of this.wayPoints) {
        if (wp.graphics) {
            wp.graphics.destroy(); // Уничтожаем графику каждой точки
        }
    }
    this.wayPoints = [];
    this.currentWayPointIndex = -1;
    this.isMovingOnWayPoint = false;
    // this.moveState = Vehicle.ST_COMMAND_MOVING; // Оставляем как было, или ST_MOVE_UNKNOWN
    // Если есть специфичная логика остановки (например, сброс руля), ее нужно добавить
    // this.setRudder(Vehicle.RUDER_0);
    // Скрываем все WP, т.к. их больше нет (на случай если selected остался true)
    // this.hideWayPoints(); // Не нужно, т.к. массив пуст
  }
  
  /**
   * Проверяет, есть ли у объекта заданные путевые точки.
   * @returns true, если есть хотя бы одна путевая точка.
   */
  public hasWayPoints(): boolean {
    return this.wayPoints.length > 0;
  }
  
  /**
   * Возвращает копию массива путевых точек.
   * Это сделано для того, чтобы внешний код не мог напрямую изменять внутренний массив.
   */
  public getWayPoints(): WayPointData[] {
    return [...this.wayPoints]; // Возвращаем копию
  }
  
  /**
   * Удаляет конкретную путевую точку по ее индексу.
   * @param index Индекс удаляемой точки в массиве wayPoints.
   */
  public removeSpecificWayPoint(index: number): void {
    if (index >= 0 && index < this.wayPoints.length) {
        const removedWpArray = this.wayPoints.splice(index, 1);
        if (removedWpArray.length > 0 && removedWpArray[0].graphics) {
            removedWpArray[0].graphics.destroy(); // Уничтожаем графику удаленной точки
        }

        // Корректируем currentWayPointIndex
        if (this.wayPoints.length === 0) {
            this.currentWayPointIndex = -1;
            this.stopMoveOnWayPoint(); // Останавливаемся, если нет больше точек
        } else if (this.currentWayPointIndex > index) {
            this.currentWayPointIndex--; // Если удалили точку перед текущей
        } else if (this.currentWayPointIndex === index) {
            // Если удалили текущую точку, и это была не последняя, переходим к следующей (которая теперь на том же индексе)
            // Если это была последняя, currentWayPointIndex станет >= wayPoints.length
            if (this.currentWayPointIndex >= this.wayPoints.length) {
                // Достигли конца нового, укороченного списка
                this.onWayPointSequenceFinished(); // Может вызвать stopMoveOnWayPoint
                 if (this.wayPoints.length === 0) { // Если после onWayPointSequenceFinished точек не осталось
                    this.stopMoveOnWayPoint();
                } else {
                    // Если onWayPointSequenceFinished мог добавить новые точки (например, в циклических маршрутах)
                    // то нужно убедиться, что currentWayPointIndex валиден.
                    // Для простоты, если мы не уверены, что делать, можно просто остановиться или перейти к первой.
                    // Пока оставим так, onWayPointSequenceFinished должен корректно обработать.
                    // Если же он не остановил, а точек нет, то остановим здесь
                    if (this.wayPoints.length === 0) this.stopMoveOnWayPoint();
                    else if (this.currentWayPointIndex >= this.wayPoints.length) this.currentWayPointIndex = 0; // На всякий случай
                }
            } else {
                 // Движение продолжится к точке, которая теперь находится по адресу this.currentWayPointIndex
                 // Возможно, нужно обновить направление this.setDirectionToCurrentWayPoint();
            }
        }
        // Если this.currentWayPointIndex < index, то удаление не влияет на текущую цель.

        if (this.wayPoints.length === 0 && this.isMovingOnWayPoint) {
             this.stopMoveOnWayPoint();
             // this.onWayPointSequenceFinished(); // stopMoveOnWayPoint может уже это сделать, или onWayPointReached
        }
        // Обновляем видимость оставшихся WP, если объект выбран
        if(this.displaySelected) {
            this.showWayPoints(); 
        } else {
            this.hideWayPoints();
        }

    } else {
        console.warn(`Попытка удалить WP с неверным индексом: ${index}`);
    }
  }
  
  /**
   * Вызывается при достижении КАЖДОЙ путевой точки в маршруте.
   * @param pointType Тип достигнутой точки (из Constants.WP_*).
   * @param isLastPoint Является ли эта точка последней в маршруте.
   */
  protected onWayPointReached(pointType: number, isLastPoint: boolean): void {
    console.log(`Vehicle ${this.id} reached WP type: ${pointType}, isLast: ${isLastPoint}. Current AI state: ${this.moveState}`);

    // Удаляем графику достигнутой точки, если она была
    if (this.currentWayPointIndex >= 0 && this.currentWayPointIndex < this.wayPoints.length) {
      const reachedWpData = this.wayPoints[this.currentWayPointIndex];
      if (reachedWpData && reachedWpData.graphics) {
        reachedWpData.graphics.destroy();
        reachedWpData.graphics = undefined; // Убираем ссылку
      }
    }

    if (this.moveState === Vehicle.ST_WP_SEARCH_TARGET) {
      // ... existing code ...
    }
  }
  
  /**
   * Вызывается при достижении ПОСЛЕДНЕЙ точки всего маршрута.
   * Завершает движение по путевым точкам.
   */
  protected onWayPointSequenceFinished(): void {
    // Базовая реализация: остановка движения по точкам
    console.log(`${this.constructor.name} ${this.id} WP sequence finished.`);
    this.isMovingOnWayPoint = false;
    // Не сбрасываем currentWayPointIndex здесь, он может быть полезен для анализа последней точки.
    // Он сбросится при следующем clearWayPoints или startMoveOnWP.
    
    if (this.moveState === Vehicle.ST_WP_MOVING) {
        this.moveState = Vehicle.ST_WP_FINISHED;
    }
    this.setRudder(Vehicle.RUDER_0);

    // Очищаем все путевые точки, так как маршрут завершен.
    // Это также позаботится об уничтожении графики оставшихся точек (если они почему-то остались).
    this.clearWayPoints();

    // Дочерние классы могут переопределить это для специфического поведения (например, начать новый поиск)
    // Важно: если они переопределяют, они должны вызывать super.onWayPointSequenceFinished() ПОСЛЕ своей логики,
    // или самостоятельно вызывать clearWayPoints(), если не вызывают super.
  }
  
  /**
   * Обновляет движение объекта к текущей путевой точке.
   * Включает логику поворота и переключения на следующую точку.
   * @param delta Время, прошедшее с последнего обновления, в миллисекундах.
   */
  protected updateMoveOnWayPoint(delta: number): void {
    if (!this.isMovingOnWayPoint || this.currentWayPointIndex < 0 || this.currentWayPointIndex >= this.wayPoints.length) {
      this.isMovingOnWayPoint = false;
      if (this.moveState === Vehicle.ST_WP_MOVING) { // Если мы активно двигались по WP
          this.moveState = Vehicle.ST_WP_FINISHED;
          // Не вызываем onWayPointSequenceFinished здесь, так как это условие может быть выходом из-за некорректных данных,
          // а не нормальным завершением последовательности.
          // onWayPointSequenceFinished вызывается при фактическом достижении последней точки.
          if (this.wayPoints.length === 0 && this.underControl && this.scene instanceof MainScene) {
            const mainScene = this.scene as MainScene;
            if (mainScene.informer) {
              mainScene.informer.panelLampOff(Constants.LAMP_WP);
            }
          }
      }
      return;
    }

    const currentWpData = this.wayPoints[this.currentWayPointIndex];
    const targetLogicalPos = currentWpData.point;

    // Конвертируем логические координаты цели в Phaser координаты для расчета дистанции и угла
    const targetPhaserPos = new Phaser.Math.Vector2(
        CoordUtils.logicalToPhaserX(targetLogicalPos.x),
        CoordUtils.logicalToPhaserY(targetLogicalPos.y)
    );

    const distanceToTarget = Phaser.Math.Distance.Between(this.x, this.y, targetPhaserPos.x, targetPhaserPos.y);

    // Проверка достижения точки
    if (distanceToTarget <= this.arrivalThreshold) {
      const isLastPoint = this.currentWayPointIndex === this.wayPoints.length - 1;
      this.onWayPointReached(currentWpData.type, isLastPoint);

      if (isLastPoint) {
        this.onWayPointSequenceFinished(); // Вызываем обработчик завершения всей последовательности
        this.isMovingOnWayPoint = false; // Останавливаем движение по WP
        this.moveState = Vehicle.ST_WP_FINISHED;
        // Не сбрасываем currentWayPointIndex, чтобы можно было понять, на какой точке остановились
        return;
      } else {
        this.currentWayPointIndex++;
        // console.log(`${this.constructor.name} ${this.id} reached WP, next target:`, this.wayPoints[this.currentWayPointIndex].point);
        // Цель изменилась, пересчитываем для текущего кадра
        // (или можно оставить поворот на следующий кадр, как было бы в реальности)
        // Для более плавной реакции, пересчитаем targetPhaserPos для логики руления ниже
        const nextWpData = this.wayPoints[this.currentWayPointIndex];
        const nextTargetLogicalPos = nextWpData.point;
        targetPhaserPos.set(
            CoordUtils.logicalToPhaserX(nextTargetLogicalPos.x),
            CoordUtils.logicalToPhaserY(nextTargetLogicalPos.y)
        );
        // console.log(`${this.constructor.name} ${this.id} advancing to WP index ${this.currentWayPointIndex}`);

      }
    }

    // Логика руления для достижения текущей targetPhaserPos
    // Угол направления в градусах (0 - вверх, 90 - вправо, 180 - вниз, 270 - влево)
    // this.direction уже в градусах и соответствует этой конвенции.

    // Рассчитываем угол к текущей цели (targetPhaserPos)
    const angleToTargetRad = Phaser.Math.Angle.Between(this.x, this.y, targetPhaserPos.x, targetPhaserPos.y);
    // Phaser.Math.Angle.Between возвращает угол в радианах, где 0 вправо.
    // Нам нужен угол, где 0 - вверх, и в градусах.
    // Сначала конвертируем в градусы:
    let angleToTargetDeg = Phaser.Math.RadToDeg(angleToTargetRad);
    // Теперь приводим к нашей системе координат (0 = вверх):
    // Угол из Angle.Between: 0 вправо, 90 вниз, 180 влево, -90 вверх (или 270)
    // Наша система: 0 вверх, 90 вправо, 180 вниз, 270 влево
    // Преобразование: naš_ugol = (phaser_ugol + 90) % 360
    angleToTargetDeg = (angleToTargetDeg + 90 + 360) % 360;


    // Кратчайший угол поворота
    const diffAngle = Phaser.Math.Angle.ShortestBetween(this.direction, angleToTargetDeg); // оба угла в градусах

    if (Math.abs(diffAngle) > Settings.ANGLE_PRECISION_FOR_WP) {
      // Необходимо повернуть
      // diffAngle > 0: ShortestBetween говорит: повернуть ПРОТИВ ЧАСОВОЙ (ВЛЕВО) для достижения цели.
      // В нашей updatePhysics: this.direction -= rudder * K. Если rudder > 0 (LEFT), то direction УМЕНЬШАЕТСЯ (ВПРАВО).
      // Значит, если diffAngle > 0 (нужно влево), нам нужен rudder < 0 (RIGHT).
      if (diffAngle > 0) { // Требуется поворот ВЛЕВО (против часовой, this.direction должен УВЕЛИЧИТЬСЯ)
        // Для увеличения this.direction, this.rudder должен быть ОТРИЦАТЕЛЬНЫМ (RUDER_RIGHT)
        if (Math.abs(diffAngle) > 45) this.setRudder(Vehicle.RUDER_RIGHT_15);
        else if (Math.abs(diffAngle) > 20) this.setRudder(Vehicle.RUDER_RIGHT_10);
        else this.setRudder(Vehicle.RUDER_RIGHT_5);
      } else { // diffAngle < 0: Требуется поворот ВПРАВО (по часовой, this.direction должен УМЕНЬШИТЬСЯ)
        // Для уменьшения this.direction, this.rudder должен быть ПОЛОЖИТЕЛЬНЫМ (RUDER_LEFT)
        if (Math.abs(diffAngle) > 45) this.setRudder(Vehicle.RUDER_LEFT_15);
        else if (Math.abs(diffAngle) > 20) this.setRudder(Vehicle.RUDER_LEFT_10);
        else this.setRudder(Vehicle.RUDER_LEFT_5);
      }
    } else {
      // Курс в пределах допустимой точности, руль прямо
      this.setRudder(Vehicle.RUDER_0);
    }

    // Физика (включая поворот от руля и движение вперед) будет обновлена в self.updatePhysics(delta)
    // который вызывается в Vehicle.update() после updateMoveOnWayPoint.
  }
  
  /**
   * Устанавливает мощность/скорость движения
   * @param newPower Новый уровень мощности
   */
  public setPower(newPower: number): void {
    if (newPower >= Vehicle.POWER_0 && newPower <= Vehicle.POWER_6) {
      this.power = newPower;
    }
  }
  
  /**
   * Устанавливает направление движения (курс)
   * @param newDirection Новое направление в градусах (0-359)
   */
  public setDirection(newDirection: number): void {
    this.directionTarget = ((newDirection % 360) + 360) % 360;
  }
  
  /**
   * Устанавливает максимальную скорость
   * @param newMaxVelocity Новая максимальная скорость
   */
  public setMaxVelocity(newMaxVelocity: number): void {
    this.maxVelocity = newMaxVelocity;
  }
  
  /**
   * Получает текущую позицию
   */
  public getPosition(): Phaser.Math.Vector2 {
    return this.position.clone();
  }
  
  /**
   * Получает текущую скорость в виде вектора
   */
  public getVelocity(): Phaser.Math.Vector2 {
    return this.velocity.clone();
  }
  
  /**
   * Получает скорость объекта
   */
  public getSpeed(): number {
    return this.velocity.length();
  }
  
  /**
   * Получает текущее направление (курс)
   */
  public getDirection(): number {
    return this.direction;
  }
  
  /**
   * Получает время жизни объекта в миллисекундах
   */
  public getTimeLiveMs(): number {
    return this.timeLive;
  }
  
  /**
   * Получает принадлежность к силам
   */
  public getForces(): number {
    return this.forces;
  }
  
  /**
   * Устанавливает принадлежность к силам
   * @param newForces Новая принадлежность к силам
   */
  public setForces(newForces: number): void {
    this.forces = newForces;
    
    // Устанавливаем цвет в зависимости от принадлежности
    if (this.forces === Constants.FORCES_RED) {
      this.color = Constants.COLOR_LIGHT_RED;
    } else {
      this.color = Constants.COLOR_LIGHT_WHITE;
    }
  }
  
  /**
   * Устанавливает отметку выбора объекта
   * @param selected Выбран ли объект
   */
  public setSelected(selected: boolean): void {
    this.displaySelected = selected;
    
    // Убираем отладочные комментарии
    // НЕЗАВИСИМО от того, selected торпеда или нет, ее WP должны быть видны, если они ЕСТЬ...
    // и т.д.

    if (this.displaySelected) {
        this.showWayPoints();
        if (this.noiseCirclesGraphics) {
          this.noiseCirclesGraphics.x = this.x;
          this.noiseCirclesGraphics.y = this.y;
          this.updateNoiseCircles(); 
          this.noiseCirclesGraphics.visible = true;
        }
    } else {
        // Убираем отладочные комментарии
        // Если объект не выбран, скрываем его обычные WP...
        this.hideWayPoints();
        if (this.noiseCirclesGraphics) {
            this.noiseCirclesGraphics.visible = false;
      }
    }
  }
  
  /**
   * Проверяет, выбран ли объект
   */
  public isSelected(): boolean {
    return this.displaySelected;
  }
  
  /**
   * Устанавливает ручное управление объектом
   * @param control Включено ли ручное управление
   */
  public setUnderControl(control: boolean): void {
    this.underControl = control;
  }
  
  /**
   * Проверяет, находится ли объект под ручным управлением
   */
  public isUnderControl(): boolean {
    return this.underControl;
  }
  
  /**
   * Проверяет столкновение с другим объектом
   * @param other Другой объект для проверки столкновения
   */
  public testCollision(other: Vehicle): boolean {
    const distance = Phaser.Math.Distance.Between(
      this.position.x, this.position.y,
      other.position.x, other.position.y
    );
    
    // Примитивная проверка столкновения по расстоянию
    return distance < 15;
  }
  
  /**
   * Переопределяем destroy, чтобы уничтожить и графику кругов
   */
  destroy(removeFromScene?: boolean): void { // Используем параметр как в GameObject.destroy
    if (this.textInfo) {
      this.textInfo.destroy();
      this.textInfo = null;
    }
    if (this.noiseCirclesGraphics) {
      this.noiseCirclesGraphics.destroy(removeFromScene); // Передаем тот же параметр
      this.noiseCirclesGraphics = null;
    }
    super.destroy(removeFromScene); // Передаем тот же параметр
  }
  
  /**
   * Получает мощность/скорость движения
   * @returns Текущий уровень мощности
   */
  public getPower(): number {
    return this.power;
  }
  
  /**
   * Устанавливает положение руля
   * @param newRudder Новое положение руля
   */
  public setRudder(newRudder: number): void {
    if (newRudder >= Vehicle.RUDER_RIGHT_15 && newRudder <= Vehicle.RUDER_LEFT_15) {
      this.rudder = newRudder;
    }
    
    // Обновляем интерфейс, если корабль под контролем
    if (this.underControl) {
      this.showRudder();
    }
  }
  
  /**
   * Отображает текущее положение руля в интерфейсе
   */
  protected showRudder(): void {
    // Получаем доступ к информеру через сцену как MainScene
    const mainScene = this.scene as any;
    const informer = mainScene.informer;
    if (!informer) {
      console.warn("Informer not available in showRudder");
      return;
    }
    
    // console.log(`Setting rudder display to: ${this.rudder}`);
    // console.log(`Тип информера: ${typeof informer}`);
    // console.log(`Информер имеет метод setRudder: ${informer && typeof informer.setRudder === 'function'}`);
    
    switch (this.rudder) {
      case Vehicle.RUDER_0:
        // console.log('Устанавливаем руль в положение 0');
        informer.setCommand("Прямо по курсу!");
        informer.setRudder("0");
        break;
        
      case Vehicle.RUDER_LEFT_5:
        // console.log('Устанавливаем руль в положение L 5');
        informer.setCommand("Руль 5 градусов влево.");
        informer.setRudder("L 5");
        break;
        
      case Vehicle.RUDER_LEFT_10:
        // console.log('Устанавливаем руль в положение L 10');
        informer.setCommand("Руль 10 градусов влево.");
        informer.setRudder("L 10");
        break;
        
      case Vehicle.RUDER_LEFT_15:
        // console.log('Устанавливаем руль в положение L 15');
        informer.setCommand("Руль 15 градусов влево.");
        informer.setRudder("L 15");
        break;
        
      case Vehicle.RUDER_RIGHT_5:
        // console.log('Устанавливаем руль в положение R 5');
        informer.setCommand("Руль 5 градусов вправо.");
        informer.setRudder("R 5");
        break;
        
      case Vehicle.RUDER_RIGHT_10:
        // console.log('Устанавливаем руль в положение R 10');
        informer.setCommand("Руль 10 градусов вправо.");
        informer.setRudder("R 10");
        break;
        
      case Vehicle.RUDER_RIGHT_15:
        // console.log('Устанавливаем руль в положение R 15');
        informer.setCommand("Руль 15 градусов вправо.");
        informer.setRudder("R 15");
        break;
        
      default:
        console.warn(`Unknown rudder value: ${this.rudder}`);
        informer.setRudder("?");
        break;
    }
  }
  
  /**
   * Получает текущее положение руля
   */
  public getRudder(): number {
    return this.rudder;
  }

  /**
   * Возвращает коэффициент мощности для расчета шума.
   * @returns Коэффициент, зависящий от текущей мощности двигателя.
   */
  protected getPowerFactorForNoise(): number {
    const absPower = Math.abs(this.power);
    // Значения подобраны на основе анализа calcNoise из VehicleMoving.as
    // где для POWER_0 был 0.05, для POWER_1 0.2, для POWER_2 1.0,
    // а для остальных, похоже, использовалось само значение мощности (или его модуль).
    // Для отрицательных мощностей (реверс) шум должен быть аналогичен.
    if (absPower === Vehicle.POWER_0) return 0.05;
    if (absPower === Vehicle.POWER_1) return 0.2;
    if (absPower === Vehicle.POWER_2) return 1.0;
    if (absPower === Vehicle.POWER_3) return 3.0;
    if (absPower === Vehicle.POWER_4) return 4.0;
    if (absPower === Vehicle.POWER_5) return 5.0;
    if (absPower === Vehicle.POWER_6) return 6.0;
    return 0; // На всякий случай, если мощность будет вне диапазона
  }

  /**
   * Рассчитывает базовый уровень шума, производимого объектом у источника,
   * до учета затухания с расстоянием и специфических модификаторов (например, глубины для подлодок).
   * Теперь также учитывает текущую скорость относительно максимальной для данной мощности.
   * @returns Базовый уровень шума у источника.
   */
  public getSourceNoiseLevel(): number {
    const noisy = this.intrinsicNoisiness; 
    const powerSettingFactor = this.getPowerFactorForNoise(); 

    if (this.getSpeed() < 0.1 && this.power === Vehicle.POWER_0) {
      return (3 * noisy * 1000000 * 0.05) / 36; // Минимальный шум для POWER_0 и стоянки
    }

    // Максимальная скорость для текущей *установки* мощности (может быть 0, если мощность POWER_0)
    const maxSpeedForCurrentPowerSetting = (this.power === Vehicle.POWER_0) ? 0 : (this.power / Vehicle.POWER_6) * this.maxVelocity;

    let speedRatio = 0;
    if (maxSpeedForCurrentPowerSetting > 0.1) {
      // Рассчитываем долю текущей скорости от максимальной для данной мощности
      speedRatio = Phaser.Math.Clamp(this.getSpeed() / maxSpeedForCurrentPowerSetting, 0, 1);
    } else if (this.power > Vehicle.POWER_0 && this.getSpeed() > 0.1) {
      // Если мощность задана (не P0), но макс. скорость для нее почти 0 (напр. P1), а корабль еще движется.
      // В этом случае, пусть шум будет основан на powerSettingFactor, так как он уже мал для низких мощностей.
      speedRatio = 1.0; 
    } else if (this.power === Vehicle.POWER_0 && this.getSpeed() > 0.1) {
      // Если мощность P0, но корабль еще движется по инерции, шум должен быть минимальным
      speedRatio = 0; // Это приведет к использованию Math.max(0, 0.05) ниже, что даст шум POWER_0
    }
    
    // Итоговый фактор, учитывающий и настройку мощности, и фактическую скорость.
    const scaledPowerFactor = powerSettingFactor * speedRatio;
    
    // Гарантируем минимальный шум работающего двигателя (эквивалент POWER_0), если мощность не 0, 
    // но scaledPowerFactor оказался меньше из-за очень низкой скорости.
    // Если мощность POWER_0, то scaledPowerFactor будет 0, и Math.max возьмет 0.05.
    // Если мощность > POWER_0 и scaledPowerFactor > 0.05, возьмется scaledPowerFactor.
    // Если мощность > POWER_0 и scaledPowerFactor < 0.05 (очень медленно едет), возьмется 0.05.
    const finalNoiseFactor = (this.power > Vehicle.POWER_0) ? Math.max(scaledPowerFactor, 0.05) : (this.getSpeed() < 0.1 ? 0.05 : scaledPowerFactor) ;

    return (3 * noisy * 1000000 * finalNoiseFactor) / 36;
  }

  /**
   * Возвращает конечную "силу" шума объекта, которую будут "слышать" другие.
   * Этот метод может быть переопределен в дочерних классах (например, Submarine)
   * для добавления специфических модификаторов (глубина, состояние перископа и т.д.).
   * @returns Эффективная сила шума объекта.
   */
  public getNoiseStrength(): number {
    // По умолчанию просто возвращаем базовый уровень шума от источника.
    // Дочерние классы могут добавить сюда свои модификаторы.
    return this.getSourceNoiseLevel();
  }

  /**
   * Обновляет и перерисовывает круги визуализации шума.
   * Теперь выбирает цветовую схему в зависимости от типа корабля (игрок/враг)
   */
  protected updateNoiseCircles(): void {
    if (!this.noiseCirclesGraphics) return;
    this.noiseCirclesGraphics.clear();

    const sourceNoiseOutput = this.getNoiseStrength();

    if (sourceNoiseOutput <= 0) {
        return;
    }

    // Определяем, какую цветовую схему использовать
    // Если это корабль игрока (underControl == true), используем синие оттенки
    // В противном случае используем красные оттенки
    const thresholds = this.underControl ? 
                       Vehicle.NOISE_DISPLAY_THRESHOLDS_BLUE : 
                       Vehicle.NOISE_DISPLAY_THRESHOLDS_RED;

    for (const T of thresholds) {
      if (T.threshold <= 0) continue;

      const radiusSquared = sourceNoiseOutput / T.threshold;
      if (radiusSquared <= 0) continue;

      let radius = Math.sqrt(radiusSquared);
      const maxDisplayRadius = Settings.SCREEN_WIDTH * 2; 

      if (radius > 0 && radius <= maxDisplayRadius) {
        this.noiseCirclesGraphics.lineStyle(T.lineThickness, T.color, T.alphaLine);
        this.noiseCirclesGraphics.strokeCircle(0, 0, radius);
      }
    }
  }

  // Метод setRotation уже есть в Phaser.GameObjects.Sprite, используем другое имя для нашего метода setSpriteRotation
  public setSpriteRotation(radians: number): void {
    super.setRotation(radians);
  }

  public showWayPoints(): void {
    for (const wpData of this.wayPoints) {
        if (wpData.graphics) {
            wpData.graphics.setVisible(true); // При выборе все WP текущего объекта становятся видимы
        }
    }
  }

  public hideWayPoints(): void {
    for (const wpData of this.wayPoints) {
        if (wpData.graphics) {
            if (this.entityType === 'Torpedo') {
                // WP, принадлежащие торпеде, остаются видимыми
            } else {
                wpData.graphics.setVisible(false); // Скрываем WP для не-торпед
            }
        }
    }
  }

  public getTruePositionBeforeSensorEffects(): Phaser.Math.Vector2 {
    return this.truePhaserPosition;
  }

  /**
   * Обновляет состояние обнаруженных целей на основе сенсорных данных.
   * @param allVehicles Массив всех Vehicle на сцене для проверки.
   * @param gameTime Текущее игровое время.
   * @param informer Инстанс Informer для вывода сообщений.
   */
  public updateSensors(allVehicles: Vehicle[], gameTime: number, informer: Informer | null): void {
    if (!this.active) {
      this.perceivedTargets.clear();
      return;
    }

    const mainScene = this.scene as MainScene;
    const currentTickPlayerShip = mainScene.getMyShip(); // Получаем myShip из сцены
    let newMessages: string[] = [];

    for (const otherVehicle of allVehicles) {
      if (!otherVehicle.active || otherVehicle === this || otherVehicle.getForces() === this.getForces()) {
        if (this.perceivedTargets.has(otherVehicle.id)) {
            this.perceivedTargets.delete(otherVehicle.id);
        }
        // Союзники и сам корабль всегда полностью видимы (если активны)
        // Их видимость будет управляться в updateTargetVisuals
        continue;
      }

      const sourceNoise = otherVehicle.getNoiseStrength();
      const distance = Phaser.Math.Distance.Between(this.x, this.y, otherVehicle.x, otherVehicle.y);
      const receivedNoise = PhysicsUtils.getReceivedNoiseLevel(otherVehicle, this.getPosition());
      let newDetectionState = DetectionState.NO_CONTACT;

      // Debug log
      UniversalLogger.log(
        `Sensor check: ${this.id} -> ${otherVehicle.id}. Dist: ${distance.toFixed(0)}. SourceNoise: ${sourceNoise.toFixed(0)}. ReceivedNoise: ${receivedNoise.toFixed(4)}. Thresholds (Z1/Z2/Z3): ${Settings.NOISE_THRESHOLD_ZONE_1_UNCERTAIN}/${Settings.NOISE_THRESHOLD_ZONE_2_LOCALIZED}/${Settings.NOISE_THRESHOLD_ZONE_3_IDENTIFIED}`,
        `SENSOR_${this.id}`,
        LogLevel.DEBUG
      );

      if (receivedNoise >= Settings.NOISE_THRESHOLD_ZONE_3_IDENTIFIED) {
        newDetectionState = DetectionState.ZONE_3_IDENTIFIED;
      } else if (receivedNoise >= Settings.NOISE_THRESHOLD_ZONE_2_LOCALIZED) {
        newDetectionState = DetectionState.ZONE_2_LOCALIZED;
      } else if (receivedNoise >= Settings.NOISE_THRESHOLD_ZONE_1_UNCERTAIN) {
        newDetectionState = DetectionState.ZONE_1_UNCERTAIN;
      }

      let currentInfo = this.perceivedTargets.get(otherVehicle.id);

      if (newDetectionState === DetectionState.NO_CONTACT) {
        if (currentInfo) {
          if (currentInfo.detectionState !== DetectionState.NO_CONTACT && this === (currentTickPlayerShip as Vehicle | null)) {
            newMessages.push(`Контакт с целью ${otherVehicle.id} (${otherVehicle.entityType}) потерян.`);
          }
          this.perceivedTargets.delete(otherVehicle.id);
        }
        continue;
      }

      const targetLogicalPos = CoordUtils.phaserToLogical(otherVehicle.getTruePositionBeforeSensorEffects());

      if (!currentInfo) {
        currentInfo = {
          targetVehicle: otherVehicle,
          detectionState: DetectionState.NO_CONTACT,
          previousDetectionState: DetectionState.NO_CONTACT,
          lastZone1PingTime: gameTime, // Инициализируем, чтобы первый "прыжок" мог случиться сразу
          displayPositionLogical: new Phaser.Math.Vector2(targetLogicalPos.x, targetLogicalPos.y),
        };
        this.perceivedTargets.set(otherVehicle.id, currentInfo);
      }

      currentInfo.previousDetectionState = currentInfo.detectionState;
      currentInfo.detectionState = newDetectionState;

      if (this === (currentTickPlayerShip as Vehicle | null) && currentInfo.detectionState !== currentInfo.previousDetectionState) {
        let message = `Цель ${otherVehicle.id} (${otherVehicle.entityType}): `;
        switch (newDetectionState) {
          case DetectionState.ZONE_1_UNCERTAIN: message += "обнаружена в неопределенной области (Зона 1)."; break;
          case DetectionState.ZONE_2_LOCALIZED: message += "координаты уточнены (Зона 2)."; break;
          case DetectionState.ZONE_3_IDENTIFIED: message += "полностью идентифицирована (Зона 3)."; break;
        }
        if (newDetectionState < currentInfo.previousDetectionState) {
             if (newDetectionState === DetectionState.ZONE_1_UNCERTAIN && currentInfo.previousDetectionState > DetectionState.ZONE_1_UNCERTAIN) {
                 message = `Цель ${otherVehicle.id} (${otherVehicle.entityType}): контакт ухудшился до Зоны 1.`;
             } else if (newDetectionState === DetectionState.ZONE_2_LOCALIZED && currentInfo.previousDetectionState > DetectionState.ZONE_2_LOCALIZED) {
                 message = `Цель ${otherVehicle.id} (${otherVehicle.entityType}): контакт ухудшился до Зоны 2.`;
             }
        }
        newMessages.push(message);
      }

      if (newDetectionState === DetectionState.ZONE_1_UNCERTAIN) {
        currentInfo.displayPositionLogical.x = targetLogicalPos.x; 
        currentInfo.displayPositionLogical.y = targetLogicalPos.y;

        if (gameTime - currentInfo.lastZone1PingTime >= Settings.ZONE_1_PING_INTERVAL_MS) {
          const offsetX = (Math.random() - 0.5) * 2 * Settings.ZONE_1_DISPLACEMENT_DELTA_LOGICAL;
          const offsetY = (Math.random() - 0.5) * 2 * Settings.ZONE_1_DISPLACEMENT_DELTA_LOGICAL;
          currentInfo.displayPositionLogical.x += offsetX;
          currentInfo.displayPositionLogical.y += offsetY;
          currentInfo.lastZone1PingTime = gameTime;
        }
      } else {
        currentInfo.displayPositionLogical.x = targetLogicalPos.x;
        currentInfo.displayPositionLogical.y = targetLogicalPos.y;
      }
    }

    const currentTargetIdsOnScene = allVehicles.filter(v => v.active && v !== this && v.getForces() !== this.getForces()).map(v => v.id);
    for (const id of this.perceivedTargets.keys()) {
        if (!currentTargetIdsOnScene.includes(id)) {
            const lostTargetInfo = this.perceivedTargets.get(id);
            if (lostTargetInfo && lostTargetInfo.detectionState !== DetectionState.NO_CONTACT && this === (currentTickPlayerShip as Vehicle | null)) {
                 newMessages.push(`Контакт с целью ${id} (ранее ${lostTargetInfo.targetVehicle.entityType}) полностью потерян (уничтожен?).`);
            }
            this.perceivedTargets.delete(id);
        }
    }
    
    if (informer && newMessages.length > 0 && this === (currentTickPlayerShip as Vehicle | null)) {
        const displayMessage = newMessages.slice(0, 2).join(' | ');
        informer.setCommand(displayMessage);
    }
    this.lastKnownPlayerShipForSensorMessages = currentTickPlayerShip;
  }
  
  /**
   * Запускает ИИ - шаг 1 (анализ ситуации)
   * Вызывается из MainScene.slowLoop
   */
  public AI_step_I(): void {
    if (!this.active || !this.aiStrategy) return;
    
    UniversalLogger.debug(`AI_step_I called for ${this.entityType} ${this.id}`, 'AI_STEP_I');
    
    // Подготовка контекста для ИИ
    const context: AIWorldContext = {
      perceivedTargets: this.perceivedTargets,
      scene: this.scene as MainScene,
      gameTime: this.scene.time.now
    };
    
    // Делегируем управление стратегии
    this.aiStrategy.analyzeStep(this, context);
  }
  
  /**
   * Запускает ИИ - шаг 2 (принятие решений)
   * Вызывается из MainScene.slowLoop
   */
  public AI_step_II(): void {
    if (!this.active || !this.aiStrategy) return;
    
    UniversalLogger.debug(`AI_step_II called for ${this.entityType} ${this.id}`, 'AI_STEP_II');
    
    // Подготовка контекста для ИИ
    const context: AIWorldContext = {
      perceivedTargets: this.perceivedTargets,
      scene: this.scene as MainScene,
      gameTime: this.scene.time.now
    };
    
    // Делегируем управление стратегии
    this.aiStrategy.actionStep(this, context);
  }
  
  /**
   * Геттеры для доступа к защищенным свойствам из стратегий ИИ
   */
  public getMoveState(): number {
    return this.moveState;
  }
  
  // Метод getPowerLevel удален, так как уже есть getPower()
  
  // Метод getWayPoints удален, так как уже есть реализация выше
  
  public getIsMovingOnWayPoint(): boolean {
    return this.isMovingOnWayPoint;
  }
  
  /**
   * Устанавливает состояние движения
   * @param state Новое состояние движения
   */
  public setMoveState(state: number): void {
    this.moveState = state;
  }
  
  /**
   * Логирует сообщение с проверкой изменения состояния
   * @param key Ключ для идентификации типа лога
   * @param message Сообщение для логирования
   * @param state Текущее состояние для сравнения с предыдущим
   * @param tag Тег для категоризации
   * @param level Уровень логирования
   * @param context Дополнительный контекст
   * @returns true если лог был отправлен, false если был пропущен
   */
  logIfStateChanged(
    key: string, 
    message: string, 
    state: any, 
    tag: string = 'VEHICLE', 
    level: LogLevel = LogLevel.INFO,
    context?: LogContext
  ): boolean {
    // Если состояние не изменилось, не логируем
    let stateStr, lastStateStr;
    
    try {
      stateStr = JSON.stringify(state);
      const lastState = this.logState.lastLoggedState[key];
      if (lastState !== undefined) {
        lastStateStr = JSON.stringify(lastState);
        if (stateStr === lastStateStr) {
          return false;
        }
      }
    } catch (e) {
      // Если JSON.stringify выбросил ошибку из-за циклической ссылки, 
      // считаем что состояние изменилось, чтобы обработать его.
      console.warn(`Circular reference detected in logIfStateChanged for key ${key}:`, e);
    }
    
    // Обновляем последнее состояние
    try {
      // Безопасное клонирование состояния
      if (stateStr) {
        this.logState.lastLoggedState[key] = JSON.parse(stateStr);
      } else {
        // Если stringification не удалась выше, создаём простую копию без глубоких ссылок
        this.logState.lastLoggedState[key] = {
          _simplified: true,
          _timestamp: Date.now()
        };
      }
    } catch (e) {
      console.warn(`Failed to update state for key ${key}:`, e);
      // В крайнем случае просто создаём метку времени
      this.logState.lastLoggedState[key] = { _timestamp: Date.now() };
    }
    
    // Добавляем идентификатор объекта в контекст
    const fullContext = {
      ...(context || {}),
      entityId: this.id,
      entityType: this.entityType
    };
    
    UniversalLogger.log(message, `${tag}_${this.entityType}${this.id}`, level, fullContext);
    return true;
  }
  
  /**
   * Логирует сообщение с ограничением по времени
   * @param key Ключ для идентификации типа лога
   * @param message Сообщение для логирования
   * @param minInterval Минимальный интервал между логами в мс
   * @param tag Тег для категоризации
   * @param level Уровень логирования
   * @param context Дополнительный контекст
   * @returns true если лог был отправлен, false если был пропущен
   */
  logWithTimeThrottle(
    key: string, 
    message: string, 
    minInterval: number = 1000,
    tag: string = 'VEHICLE', 
    level: LogLevel = LogLevel.INFO,
    context?: LogContext
  ): boolean {
    const now = Date.now();
    const lastTime = this.logState.lastLogTime[key] || 0;
    
    // Если прошло недостаточно времени, пропускаем
    if (now - lastTime < minInterval) {
      return false;
    }
    
    // Обновляем время последнего лога
    this.logState.lastLogTime[key] = now;
    
    // Добавляем идентификатор объекта в контекст
    const fullContext = {
      ...(context || {}),
      entityId: this.id,
      entityType: this.entityType
    };
    
    UniversalLogger.log(message, `${tag}_${this.entityType}${this.id}`, level, fullContext);
    return true;
  }
  
  /**
   * Логирует сообщение каждые N вызовов
   * @param key Ключ для идентификации типа лога
   * @param message Сообщение для логирования
   * @param everyNth Частота логирования (каждый N-й вызов)
   * @param tag Тег для категоризации
   * @param level Уровень логирования
   * @param context Дополнительный контекст
   * @returns true если лог был отправлен, false если был пропущен
   */
  logEveryNthCall(
    key: string, 
    message: string, 
    everyNth: number = 5,
    tag: string = 'VEHICLE', 
    level: LogLevel = LogLevel.INFO,
    context?: LogContext
  ): boolean {
    // Увеличиваем счетчик вызовов
    this.logState.logCounter[key] = (this.logState.logCounter[key] || 0) + 1;
    
    // Логируем только каждый N-й вызов
    if (this.logState.logCounter[key] % everyNth !== 0) {
      return false;
    }
    
    // Добавляем идентификатор объекта и счетчик в контекст
    const fullContext = {
      ...(context || {}),
      entityId: this.id,
      entityType: this.entityType,
      callCount: this.logState.logCounter[key]
    };
    
    UniversalLogger.log(message, `${tag}_${this.entityType}${this.id}`, level, fullContext);
    return true;
  }
}