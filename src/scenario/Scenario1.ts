import Phaser from 'phaser';
import { Scenario } from './Scenario';
import { Settings } from '../utils/Settings';
import { Constants } from '../utils/Constants';
import { Statistic } from '../utils/Statistic';
import { Vehicle } from '../objects/Vehicle';
import { Ship } from '../objects/Ship';
import { Submarine } from '../objects/Submarine';
import { MainScene } from '../scenes/MainScene';
import { Obstruction } from '../objects/Obstruction';
import { CoordUtils } from '../utils/CoordUtils';
import { AIStrategyFactory } from '../ai/strategies/AIStrategyFactory';

/**
 * Первый сценарий игры - выход из порта и уничтожение вражеского корабля
 */
export class Scenario1 extends Scenario {
  // Бонус за время выхода из порта
  protected maxTimeLeavePortSec: number = 1000;
  
  /**
   * Конструктор
   * @param scene Сцена игры
   */
  constructor(scene: MainScene) {
    super(scene, "Scenario1");
  }
  
  /**
   * Инициализация сценария
   */
  public override init(): void {
    super.init();
    
    console.log('Scenario1: init начат');
    
    // Устанавливаем стартовую логическую позицию для сценария (если нужно смещение от центра мира 0,0)
    // Если сценарий должен быть строго в центре, эти START_X/Y можно оставить 0, как в базовом классе.
    // Для примера, немного сместим стартовую область сценария влево-вверх от глобального центра.
    this.START_X = -Settings.SCREEN_WIDTH / 2; // Логическая X координата начала сценария
    this.START_Y = -Settings.SCREEN_HEIGHT / 2; // Логическая Y координата начала сценария
    this.startPosition.set(this.START_X, this.START_Y); // Обновляем startPosition из базового класса
        
    // Настраиваем бонусы
    this.bonusTimeGameSec = 5000;
    this.maxTimeLeavePortSec = 1000;
    
    // Задаем логические координаты для объектов относительно this.START_X, this.START_Y
    // или абсолютные логические координаты, если START_X/Y = 0.
    // Для примера, пусть координаты (40,20) и (1000,-100) будут логическими отн. центра мира.
    const playerLogicalX = 40;
    const playerLogicalY = 20;
    const enemyShipLogicalX = 1000;
    const enemyShipLogicalY = -100; // Оставим -100, если это было намеренно (например, за пределами видимости сначала)

    // Создаем подводную лодку игрока, используя преобразованные координаты
    const submarine = this.scene.createPlayerShip(
      CoordUtils.logicalToPhaserX(playerLogicalX),
      CoordUtils.logicalToPhaserY(playerLogicalY),
      Constants.FORCES_WHITE
    ) as Submarine;
    submarine.setName("L.A.");
    submarine.setDirection(90);
    
    // Создаем вражеский корабль "Kashin", используя преобразованные координаты
    const ship = this.scene.createEnemyShip(
      CoordUtils.logicalToPhaserX(enemyShipLogicalX),
      CoordUtils.logicalToPhaserY(enemyShipLogicalY),
      Constants.FORCES_RED
    );
    ship.setDirection(250);
    ship.setPower(Vehicle.POWER_3);
    ship.setName("Kashin");
    // Предполагаем, что у Ship есть метод setHealth
    if ('setHealth' in ship) {
      (ship as any).setHealth(1000);
    }
    
    // Назначаем стратегию торгового корабля кораблю "Kashin"
    AIStrategyFactory.assignStrategy('merchant_ship', ship, this.scene);
    console.log(`Scenario1: стратегия 'merchant_ship' назначена кораблю Kashin (ID: ${ship.id})`);
    
    // Создаем белую подводную лодку-охотник с AI DSL стратегией "Агрессивный охотник"
    const hunterSubLogicalX = 500;
    const hunterSubLogicalY = -200;
    const hunterSub = this.scene.createEnemyShip(
      CoordUtils.logicalToPhaserX(hunterSubLogicalX),
      CoordUtils.logicalToPhaserY(hunterSubLogicalY),
      Constants.FORCES_WHITE,
      true // isSubmarine = true
    );
    hunterSub.setDirection(270); // Направление на запад
    hunterSub.setPower(Vehicle.POWER_2);
    hunterSub.setName("Hunter");
    
    // Назначаем DSL стратегию "Агрессивный охотник" подводной лодке
    const aggressiveHunterDSL = `
strategy: "Агрессивный охотник"
description: "Атакует ближайшие цели"

ON ANALYZE:
  - FIND:
      best_target:
        type: ship
        range: 1500
        detection_zone: 2

ON ACTION:
  IF:
    condition: best_target IS_PRESENT AND weapon_I IS_READY
    actions:
      - Action:
          ATTACK:
            with: best_target
            torpedo: weapon_I
            predict_lead_time: 0
  ELSE IF:
    condition: best_target IS_PRESENT
    actions:
      - Action:
          CHASE:
            target: best_target
            distance: 500
            power: 6  // Увеличено для теста
            angle_offset: 0
            depth: 100
  ELSE:
    actions:
      - Action:
          PATROL:
            power: 3
`;
    AIStrategyFactory.assignStrategyFromDSL(aggressiveHunterDSL, hunterSub, this.scene);
    console.log(`Scenario1: DSL стратегия 'Агрессивный охотник' назначена подводной лодке Hunter (ID: ${hunterSub.id})`);
    
    console.log('Scenario1: создание кораблей завершено');
    
    // Генерируем карту
    this.genCoastData();
    this.genObstruction();
    this.genPortGate();
    
    console.log('Scenario1: генерация карты завершена');
    
    // Завершаем инициализацию
    this.initAfter();
    
    console.log('Scenario1: init завершен');
  }
  
  /**
   * Вычисляет счет для сценария
   * @param success Результат миссии
   */
  public override calcScore(success: number): number {
    // Вызываем базовый метод расчета
    let score = super.calcScore(success);
    
    // Добавляем бонус за быстрый выход из порта
    if (success === Scenario.MISSION_SUCCESS && Statistic.time_leave_port_sec !== 0) {
      score += Math.floor(this.maxTimeLeavePortSec / Statistic.time_leave_port_sec);
    }
    
    return score;
  }
  
  /**
   * Генерирует данные побережья для сценария
   */
  protected override genCoastData(): void {
    console.log('Scenario1: genCoastData начат');
    this.coastData = [];
    this.portLineData = [];
    
    // Добавляем точки побережья
    this.coastData.push(new Phaser.Math.Vector2(0, 0));
    this.coastData.push(new Phaser.Math.Vector2(0, 2));
    this.coastData.push(new Phaser.Math.Vector2(7, 2));
    this.coastData.push(new Phaser.Math.Vector2(14, 10));
    this.coastData.push(new Phaser.Math.Vector2(18, 10));
    this.coastData.push(new Phaser.Math.Vector2(18, 6));
    this.coastData.push(new Phaser.Math.Vector2(20, 6));
    this.coastData.push(new Phaser.Math.Vector2(20, 10));
    this.coastData.push(new Phaser.Math.Vector2(27, 10));
    this.coastData.push(new Phaser.Math.Vector2(29, 3));
    this.coastData.push(new Phaser.Math.Vector2(26, -3));
    this.coastData.push(new Phaser.Math.Vector2(17, -10));
    this.coastData.push(new Phaser.Math.Vector2(14, -10));
    this.coastData.push(new Phaser.Math.Vector2(14, -7));
    this.coastData.push(new Phaser.Math.Vector2(12, -6));
    this.coastData.push(new Phaser.Math.Vector2(11, -10));
    this.coastData.push(new Phaser.Math.Vector2(6, -8));
    this.coastData.push(new Phaser.Math.Vector2(5, -9));
    
    this.coastData.push(new Phaser.Math.Vector2(10, -12));
    this.coastData.push(new Phaser.Math.Vector2(18, -13));
    this.coastData.push(new Phaser.Math.Vector2(27, -8));
    this.coastData.push(new Phaser.Math.Vector2(34, -1));
    this.coastData.push(new Phaser.Math.Vector2(32, 14));
    this.coastData.push(new Phaser.Math.Vector2(-2, 14));
    this.coastData.push(new Phaser.Math.Vector2(-4, 5));
    this.coastData.push(new Phaser.Math.Vector2(-3, -2));
    
    this.coastData.push(new Phaser.Math.Vector2(3, -8));
    this.portLineData.push(new Phaser.Math.Vector2(3, -8));
    this.coastData.push(new Phaser.Math.Vector2(4, -7));
    this.portLineData.push(new Phaser.Math.Vector2(4, -7));
    
    this.portLineData.push(new Phaser.Math.Vector2(6, -8));
    this.portLineData.push(new Phaser.Math.Vector2(5, -9));
    
    this.coastData.push(new Phaser.Math.Vector2(1, -2));
    this.coastData.push(new Phaser.Math.Vector2(7, -2));
    this.coastData.push(new Phaser.Math.Vector2(10, -5));
    this.coastData.push(new Phaser.Math.Vector2(24, -1));
    this.coastData.push(new Phaser.Math.Vector2(24, 7));
    this.coastData.push(new Phaser.Math.Vector2(22, 7));
    this.coastData.push(new Phaser.Math.Vector2(22, 3));
    this.coastData.push(new Phaser.Math.Vector2(16, 3));
    this.coastData.push(new Phaser.Math.Vector2(16, 6));
    this.coastData.push(new Phaser.Math.Vector2(14, 6));
    this.coastData.push(new Phaser.Math.Vector2(14, 3));
    this.coastData.push(new Phaser.Math.Vector2(11, 3));
    this.coastData.push(new Phaser.Math.Vector2(6, 0));
    this.coastData.push(new Phaser.Math.Vector2(0, 0));
    
    console.log(`Scenario1: genCoastData завершен. Точек побережья: ${this.coastData.length}, точек порта: ${this.portLineData.length}`);
  }
  
  /**
   * Генерирует препятствия (берега)
   */
  public override genObstruction(): void {
    console.log('Scenario1: genObstruction начат');
    
    // Удаляем старое препятствие, если оно существует
    if (this.obstruction) {
      this.obstruction.destroy();
      this.obstruction = null;
    }
    
    // Создаем графику для препятствия
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(0xCD853F); // Цвет берега
    graphics.lineStyle(2, 0xFFFFFF); // Белый контур
    
    // Строим путь по точкам побережья
    const zoom = this.scene.getZoom();
    const koefCoast = Settings.koef_coast;
    
    console.log(`Scenario1: koefCoast=${koefCoast}`);
    
    // Начинаем рисовать
    graphics.beginPath();
    
    // Получаем первую точку (логическую, масштабированную koefCoast)
    const firstLogicalX = this.coastData[0].x * koefCoast;
    const firstLogicalY = this.coastData[0].y * koefCoast;
    // Преобразуем в Phaser-координаты для отрисовки
    const startPhaserX = CoordUtils.logicalToPhaserX(this.START_X + firstLogicalX); // Относительно логического старта сценария
    const startPhaserY = CoordUtils.logicalToPhaserY(this.START_Y + firstLogicalY); // Относительно логического старта сценария
    
    console.log(`Первая точка побережья (лог): ${firstLogicalX}, ${firstLogicalY} -> Phaser: ${startPhaserX}, ${startPhaserY}`);
    
    graphics.moveTo(startPhaserX, startPhaserY);
    
    // Добавляем все точки
    for (let i = 1; i < this.coastData.length; i++) {
      const logicalX = this.coastData[i].x * koefCoast;
      const logicalY = this.coastData[i].y * koefCoast;
      // Преобразуем в Phaser-координаты для отрисовки
      const phaserX = CoordUtils.logicalToPhaserX(this.START_X + logicalX); // Относительно логического старта сценария
      const phaserY = CoordUtils.logicalToPhaserY(this.START_Y + logicalY); // Относительно логического старта сценария
      graphics.lineTo(phaserX, phaserY);
      
      if (i % 10 === 0) {
        console.log(`Точка побережья ${i} (лог): ${logicalX}, ${logicalY} -> Phaser: ${phaserX}, ${phaserY}`);
      }
    }
    
    // Заканчиваем рисование
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
    
    // Устанавливаем позицию с учетом стартовой точки
    const x = this.START_X - 10;
    const y = this.START_Y - 10;
    graphics.x = x;
    graphics.y = y;
    
    console.log(`Scenario1: позиция графики x=${x}, y=${y}`);
    
    // Сохраняем созданную графику как препятствие
    this.obstruction = graphics;
    
    // Создаем объект препятствия и добавляем его в сцену
    const obst = new Obstruction(this.scene);
    
    // Вычисляем минимальные и максимальные координаты, чтобы задать размеры объекта
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const point of this.coastData) {
      if (point.x < minX) minX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.x > maxX) maxX = point.x;
      if (point.y > maxY) maxY = point.y;
    }
    
    // Вычисляем размеры
    const width = (maxX - minX) * koefCoast;
    const height = (maxY - minY) * koefCoast;
    
    console.log(`Размеры препятствия: minX=${minX}, minY=${minY}, maxX=${maxX}, maxY=${maxY}, width=${width}, height=${height}`);
    
    // Устанавливаем позицию и размеры
    obst.setPositionAndSize(x, y, width, height);
    
    // Добавляем препятствие в список препятствий сцены
    this.scene.addObstruction(obst);
    
    console.log('Scenario1: genObstruction завершен');
  }
  
  /**
   * Генерирует ворота порта
   */
  public override genPortGate(): void {
    console.log('Scenario1: genPortGate начат');
    
    // Удаляем старые ворота, если они существуют
    if (this.portGate) {
      this.portGate.destroy();
      this.portGate = null;
    }
    
    // Создаем графику для ворот порта
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(0x0000FF);
    
    // Устанавливаем прозрачность, сделаем более заметным
    graphics.alpha = 0.6; 
    
    // Строим путь по точкам линии порта
    const zoom = this.scene.getZoom();
    const koefCoast = Settings.koef_coast;
    
    console.log(`Порт - количество точек: ${this.portLineData.length}`);
    
    // Если нет точек для порта, просто выходим
    if (this.portLineData.length < 2) {
      console.log('Недостаточно точек для построения ворот порта');
      return;
    }
    
    // Начинаем рисовать
    graphics.beginPath();
    
    // Получаем первую точку
    const firstPoint = this.portLineData[0];
    const startX = zoom * (firstPoint.x * koefCoast);
    const startY = zoom * (firstPoint.y * koefCoast);
    
    console.log(`Первая точка порта: ${firstPoint.x}, ${firstPoint.y} -> ${startX}, ${startY}`);
    
    graphics.moveTo(startX, startY);
    
    // Добавляем все точки
    for (let i = 1; i < this.portLineData.length; i++) {
      const x = zoom * (this.portLineData[i].x * koefCoast);
      const y = zoom * (this.portLineData[i].y * koefCoast);
      graphics.lineTo(x, y);
      
      console.log(`Точка порта ${i}: ${this.portLineData[i].x}, ${this.portLineData[i].y} -> ${x}, ${y}`);
    }
    
    // Делаем линию толще
    graphics.lineStyle(4, 0xFF0000);
    graphics.strokePath();
    
    // Заканчиваем рисование
    graphics.closePath();
    graphics.fillPath();
    
    // Устанавливаем позицию с учетом стартовой точки
    const x = this.START_X - 10;
    const y = this.START_Y - 10;
    graphics.x = x;
    graphics.y = y;
    
    console.log(`Позиция ворот порта: x=${x}, y=${y}`);
    
    // Сохраняем ворота порта
    this.portGate = graphics;
    
    console.log('Scenario1: genPortGate завершен');
  }
  
  /**
   * Обновляет масштаб объектов
   */
  private updateScale(): void {
    // Обновление масштаба объектов при необходимости
    const zoom = this.scene.getZoom();
    
    if (this.obstruction) {
      // Обновляем масштаб препятствия
      // ...
    }
    
    if (this.portGate) {
      // Обновляем масштаб ворот порта
      // ...
    }
  }
  
  /**
   * Обработка окончания игры для этого конкретного сценария
   * @param success Результат миссии
   */
  public override gameOver(success: number): void {
    super.gameOver(success);
    
    const scoreText = `ИГРА ОКОНЧЕНА. Ваш счет: ${this.score} ${this.success}`;
    
    // Формируем текст с результатами
    this.comment = `Время: ${Statistic.time_game_sec} сек.`
      + `\n\nВыход из порта: ${Statistic.time_leave_port_sec} сек.`
      + `\nЯ выпустил торпед: ${Statistic.friend_fire_count}`
      + `\nВраг выпустил торпед: ${Statistic.enemy_fire_count}`
      + `\nВраг попал: ${Statistic.enemy_hit_count}`
      + `\nВраг попал в меня: ${Statistic.friend_hit_count}`
      + `\nВраг уничтожен: ${Statistic.enemy_destroyed}`
      + `\nСоюзники уничтожены: ${Statistic.friend_destroyed}`
      + `\n\nСЧЕТ: ${this.score}`;
      
    // Показываем результаты
    this.showGameOver(
      scoreText,
      "\n\n" + this.comment,
      "Нажмите любую клавишу"
    );
  }
  
  /**
   * Показывает цель миссии
   */
  public override showMissinGoal(): void {
    // Останавливаем игру
    // аналог main.stop() в ActionScript
    
    // Показываем цель миссии
    this.showMissionGoal(
      `${this.name} Ваша миссия:`,
      "\n\n" +
      "Покиньте порт как можно быстрее и"
      + "\n уничтожьте вражеский корабль."
      + "\n"
      + "\nS - старт"
      + "\nUp - увеличить мощность"
      + "\nDown - уменьшить мощность"
      + "\nLeft - руль влево"
      + "\nRight - руль вправо"
      + "\nSpace - выстрел торпедой"
      + "\nZ - увеличить масштаб"
      + "\nX - уменьшить масштаб"
      + "\nЛевая кнопка мыши + перемещение - сдвиг экрана"
      + "\nESC - выход",
      Settings.CURRENT_SRS
    );
  }
} 