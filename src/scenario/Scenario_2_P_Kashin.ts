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
 * Второй сценарий игры -  уничтожение вражеского корабля
 */
export class Scenario_2 extends Scenario {
  // Бонус за время выхода из порта
  protected maxTimeLeavePortSec: number = 1000;
  
  /**
   * Конструктор
   * @param scene Сцена игры
   */
  constructor(scene: MainScene) {
    super(scene, "Scenari_2");
  }
  
  /**
   * Инициализация сценария
   */
  public override init(): void {
    super.init();
    
    console.log('Scenari_2: init начат');
    
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
    // AIStrategyFactory.assignStrategy('merchant_ship', ship, this.scene);
    // console.log(`Scenario1: стратегия 'merchant_ship' назначена кораблю Kashin (ID: ${ship.id})`);
        // Назначаем DSL стратегию "Торговый корабль" кораблю "Kashin" из файла
    // Стратегия загружается из файла src/ai/dsl/strategies/merchant_ship.yaml
    // Если стратегия уже загружена через preloadStrategies(), используем синхронный метод
    if (AIStrategyFactory.assignStrategy('merchant_ship', ship, this.scene)) {
      console.log(`Scenario_test_1: DSL стратегия 'merchant_ship' назначена кораблю Kashin (ID: ${ship.id})`);
    } else {
      // Если не загружена, загружаем асинхронно
      AIStrategyFactory.assignDSLStrategy('merchant_ship', ship, this.scene).then(success => {
        if (success) {
          console.log(`Scenario_test_1: DSL стратегия 'merchant_ship' назначена кораблю Kashin (ID: ${ship.id})`);
        } else {
          console.warn(`Scenario_test_1: Не удалось назначить DSL стратегию 'merchant_ship' кораблю Kashin`);
        }
      });
    }

    console.log('Scenario_2: создание кораблей завершено');
    
    // Генерируем карту
    this.genCoastData();
    this.genObstruction();
    this.genPortGate();
    
    console.log('Scenario_2: генерация карты завершена');
    
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