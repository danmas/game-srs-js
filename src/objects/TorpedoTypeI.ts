import Phaser from 'phaser';
import { Torpedo } from './Torpedo';
import { Constants } from '../utils/Constants';
import { TorpedoParams } from './TorpedoParams';
import { Vehicle } from './Vehicle';

/**
 * Торпеда Тип I - обычная прямоидущая торпеда,
 * но для игрока сначала идет к точке, потом прямо.
 */
export class TorpedoTypeI extends Torpedo {
  private hasReachedPlayerTargetPoint: boolean = false;

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
    this.weaponType = Constants.WEAPON_SELECT_TORP_I;
  }
  
  /**
   * Переопределяем метод отрисовки торпеды типа I
   */
  protected drawVehicle(): void {
    // Создаем графику для торпеды
    const graphics = (this.scene.add as Phaser.GameObjects.GameObjectFactory).graphics();
    
    // Выбираем цвет в зависимости от принадлежности
    graphics.fillStyle(this.color, 1);
    
    // Рисуем форму торпеды (тонкий прямоугольник)
    graphics.fillRect(-1.5, -4, 3, 8);
    
    // Генерируем текстуру
    graphics.generateTexture('torpedo_type_i', 6, 12);
    graphics.destroy();
    
    // Устанавливаем текстуру
    this.setTexture('torpedo_type_i');
  }
  
  /**
   * Торпеда типа I движется прямо без наведения, если не управляется игроком к первой точке.
   */
  public AI_step_I(): void {
    // Если достигла точки игрока, или не имела ее, то просто движется прямо.
    // Логика движения к WP обрабатывается в Vehicle.updateMoveOnWayPoint
  }
  
  /**
   * Торпеда типа I не меняет направление сама по себе, если не управляется к WP.
   */
  public AI_step_II(): void {
    // Нет изменений в направлении, если нет WP.
  }

  /**
   * Вызывается при достижении КАЖДОЙ путевой точки в маршруте.
   */
  protected override onWayPointReached(pointType: number, isLastPoint: boolean): void {
    super.onWayPointReached(pointType, isLastPoint); // Базовая логика (логирование, удаление графики WP)

    if (pointType === Constants.WP_TYPE_TORPEDO_TARGET) {
      console.log(`TorpedoTypeI ${this.id} reached PLAYER TARGET point.`);
      this.hasReachedPlayerTargetPoint = true;
      this.clearWayPoints(); // Больше не следуем точкам
      // Убедимся, что она продолжит движение прямо по текущему курсу
      this.moveState = Vehicle.ST_COMMAND_MOVING; // Состояние "двигаться по команде" (т.е. прямо)
      this.setRudder(Vehicle.RUDER_0); // Руль прямо
      this.isMovingOnWayPoint = false; // Явно указываем, что движение по WP завершено
    }
  }

  /**
   * Вызывается при достижении ПОСЛЕДНЕЙ точки всего маршрута ИЛИ если маршрут прерван.
   */
  protected override onWayPointSequenceFinished(): void {
    if (!this.hasReachedPlayerTargetPoint) {
      // Если точка игрока не была достигнута (например, WP удалили до достижения),
      // то торпеда останавливается, как обычная торпеда, завершившая маршрут.
      console.log(`TorpedoTypeI ${this.id} finished WP sequence WITHOUT reaching player target. Stopping.`);
      super.onWayPointSequenceFinished(); // Это остановит торпеду (установит POWER_0 и т.д.)
    } else {
      // Если точка игрока была достигнута, торпеда должна продолжать движение прямо.
      // В этом случае onWayPointSequenceFinished не должен останавливать ее.
      // Базовый Vehicle.onWayPointSequenceFinished() может остановить ее или очистить WP,
      // поэтому мы не вызываем super здесь, если цель игрока достигнута.
      console.log(`TorpedoTypeI ${this.id} 'finished' WP sequence AFTER reaching player target. Continuing straight.`);
      // Флаг isMovingOnWayPoint уже должен быть false из onWayPointReached.
      // moveState установлен в ST_COMMAND_MOVING.
    }
  }
} 