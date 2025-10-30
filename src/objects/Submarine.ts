import Phaser from 'phaser';
import { Ship } from './Ship';
import { Constants } from '../utils/Constants';
import { Settings } from '../utils/Settings';
import { TorpedoTypeI } from './TorpedoTypeI';
import { MainScene } from '../scenes/MainScene';
import { CoordUtils } from '../utils/CoordUtils';
import { UniversalLogger, LogLevel } from '../utils/UniversalLogger';

/**
 * Класс подводной лодки
 */
export class Submarine extends Ship {
  // Дополнительные свойства для подлодки
  public depth: number = 0;  // Глубина погружения
  public maxDepth: number = 300;  // Максимальная глубина
  public periscope: boolean = false;  // Поднят ли перископ
  
  /**
   * Конструктор
   * @param scene Сцена
   * @param x Начальная позиция X
   * @param y Начальная позиция Y
   * @param forces Принадлежность к силам (красные/белые)
   */
  constructor(scene: Phaser.Scene, x: number, y: number, forces: number = Constants.FORCES_WHITE) {
    super(scene, x, y, forces);
    
    // Увеличиваем максимальную скорость для подлодки
    this.maxVelocity = 40;
    
    // Уменьшаем размер для попадания
    this.sizeForHit = Settings.SHIP_HIT_SIZE * 0.8;
    
    // Увеличиваем запас торпед
    this.torpedoOnBoardI = 8;
    this.torpedoOnBoardII = 8;
    this.torpedoOnBoardIII = 8;
    
    console.log("Создаю подводную лодку с параметрами:");
    console.log("- underControl:", this.underControl);
    console.log("- forces:", forces === Constants.FORCES_RED ? "RED" : "WHITE");
    
    // Рисуем подводную лодку вместо обычного корабля
    this.drawVehicle();
  }
  
  /**
   * Возвращает цвет рубки в зависимости от принадлежности
   */
  protected getConningTowerColor(): number {
    return this.forces === Constants.FORCES_RED ? 0xcc0000 : 0xdddddd;
  }
  
  /**
   * Отрисовывает вражескую подводную лодку
   * (Используется для лодок под управлением ИИ)
   */
  private drawEnemySubmarine(graphics: Phaser.GameObjects.Graphics, centerX: number, centerY: number, mainColor: number): void {
    // Рисуем отличительную форму для вражеской подлодки
    const width = 20;
    const height = 30;
    
    // Основной корпус (прямоугольник с закругленным передним краем)
    graphics.fillStyle(mainColor, 1);
    graphics.lineStyle(1, 0x000000, 1);
    
    // Прямоугольник для корпуса
    graphics.fillRect(-width/2, -height/2, width, height);
    
    // Закругленная носовая часть
    graphics.fillCircle(0, -height/2, width/2);
    
    // Добавляем характерные детали вражеской подлодки
    // Рубка (перископ)
    graphics.fillStyle(0x333333, 1);
    graphics.fillRect(-width/4, -height/3, width/2, height/4);
    
    // Винты сзади
    graphics.fillStyle(0x666666, 1);
    graphics.fillCircle(-width/4, height/2, 3);
    graphics.fillCircle(width/4, height/2, 3);
  }
  
  /**
   * Переопределяем метод отрисовки подлодки
   * Использует методы Phaser 3 для графики и подход как при отрисовке порта
   */
  public drawVehicle(): void {
    console.log("drawVehicle вызван для подлодки, underControl =", this.underControl);
    
    // Определяем имя текстуры в зависимости от принадлежности и выбранности
    const selected = this.displaySelected ? "_selected" : "";
    const controlStatus = this.underControl ? "_player" : "_ai";
    const textureName = this.forces === Constants.FORCES_RED ? 
                       `submarine_red${selected}${controlStatus}` : 
                       `submarine_white${selected}${controlStatus}`;

    // Цвет зависит от принадлежности
    const mainColor = this.forces === Constants.FORCES_RED ? 
                     (this.underControl ? Constants.COLOR_LIGHT_RED : Constants.COLOR_DARK_RED) : 
                     (this.underControl ? Constants.COLOR_LIGHT_WHITE : Constants.COLOR_DARK_WHITE);

    // Создаем графику прямо через сцену
    const graphics = this.scene.add.graphics();
    
    // Очищаем графику
    graphics.clear();
    
    // Всегда рисуем детализированную подлодку
    // Масштабируем с оригинальной версии
    const scale = 3;
    
    // Базовые размеры 
    const size = this.underControl ? 200 : 150;
    const halfSize = size / 2;
    
    // Размеры текстуры - делаем квадратными для лучшего центрирования
    const textureSize = size * 3;
    
    // Центр текстуры 
    const centerX = textureSize / 2;
    const centerY = textureSize / 2;
    
    // Перемещаем начало координат в центр текстуры для рисования
    graphics.translateCanvas(centerX, centerY);
    
    if (this.underControl) {
      // Прямоугольник главного корпуса для лодки игрока
      graphics.fillStyle(mainColor, 1);
      graphics.lineStyle(1, 0x000000, 1);
      
      // Вытянутая форма для лодки игрока
      const width = size / 3;
      const height = size;
      const halfWidth = width / 2;
      const halfHeight = height / 2;
      
      // Рисуем прямоугольник центрированный относительно центра текстуры
      graphics.fillRect(-halfWidth, -halfHeight, width, height/2+35);
      // Скругленные углы для верхней частиs
      graphics.fillCircle(-halfWidth/2 + 15, -halfHeight, halfWidth);
      //graphics.fillCircle(halfWidth, -halfHeight, halfWidth/5);
      
      // Треугольный хвост
      graphics.beginPath();
      graphics.moveTo(-halfWidth, halfHeight/2-15);
      graphics.lineTo(0, halfHeight + width);
      graphics.lineTo(halfWidth, halfHeight/2-15);
      graphics.closePath();
      graphics.fillPath();
      
      // Рисуем перископ, если он поднят
      // if (this.periscope) {
      //   graphics.fillStyle(0x0f0f0f, 1);
      //   graphics.lineStyle(1, 0x0f0f0f, 1);
      //   const rh = height / 4;
      //   const rw = width / 3;
      //   graphics.fillEllipse(0, -halfHeight / 2, rw, rh);
      // }
      
      // Если подлодка выбрана, добавляем обводку
      if (this.displaySelected) {
        graphics.lineStyle(2, 0xFFFF00, 1); // Желтая обводка
        graphics.strokeRect(-halfWidth - 3, -halfHeight - 3, width + 6, height + 6);
      }
    } else {
      // Для лодки под управлением ИИ используем другую отрисовку
      this.drawEnemySubmarine(graphics, centerX, centerY, mainColor);
      
      // Если подлодка выбрана, добавляем обводку
      if (this.displaySelected) {
        graphics.lineStyle(2, 0xFFFF00, 1); // Желтая обводка
        graphics.strokeRect(-halfSize - 3, -halfSize - 3, size + 6, size + 6);
      }
    }
    
    console.log("Создаю текстуру:", textureName, "размером", textureSize, "x", textureSize);
    
    // Создаем текстуру из графики
    graphics.generateTexture(textureName, textureSize, textureSize);
    
    // Удаляем временную графику, чтобы не засорять память
    graphics.destroy();
    
    // Устанавливаем текстуру и размер спрайта
    this.setTexture(textureName);
    this.setDisplaySize(this.underControl ? 50 : 30, this.underControl ? 50 : 30);
    
    // Устанавливаем точку опоры (pivot) в центр спрайта
    this.setOrigin(0.5, 0.5);
  }
  
  /**
   * Устанавливает глубину погружения
   * @param newDepth Новая глубина
   */
  public setSubmDepth(newDepth: number): void {
    const oldDepth = this.depth;
    
    // Ограничиваем глубину допустимыми пределами
    this.depth = Phaser.Math.Clamp(newDepth, 0, this.maxDepth);
    
    // Если глубина 0, то устанавливаем перископ
    this.periscope = (this.depth === 0);
    
    // Логируем изменение глубины для подлодок под управлением игрока
    if (this.underControl && oldDepth !== this.depth) {
      UniversalLogger.log(
        `Player changed Submarine ${this.id} depth from ${oldDepth}m to ${this.depth}m`,
        `PLAYER_ACTION`,
        LogLevel.INFO,
        {
          action: 'setDepth',
          entityId: this.id,
          entityType: this.entityType,
          oldDepth: oldDepth,
          newDepth: this.depth,
          periscopeRaised: this.periscope,
          position: { x: this.x, y: this.y },
          direction: this.getDirection(),
          speed: this.getSpeed()
        }
      );
    }
    
    // Перерисовываем подлодку
    this.drawVehicle();
  }
  
  /**
   * Получает текущую глубину
   */
  public getDepth(): number {
    return this.depth;
  }
  
  /**
   * Поднимает перископ
   */
  public raisePeriscope(): void {
    if (this.depth <= 50) { // Перископ можно поднять только на малой глубине
      this.periscope = true;
      this.drawVehicle();
      
      // Логируем действие игрока
      if (this.underControl) {
        UniversalLogger.log(
          `Player raised periscope on Submarine ${this.id}`,
          `PLAYER_ACTION`,
          LogLevel.INFO,
          {
            action: 'raisePeriscope',
            entityId: this.id,
            entityType: this.entityType,
            depth: this.depth,
            position: { x: this.x, y: this.y }
          }
        );
      }
    }
  }
  
  /**
   * Опускает перископ
   */
  public lowerPeriscope(): void {
    this.periscope = false;
    this.drawVehicle();
    
    // Логируем действие игрока
    if (this.underControl) {
      UniversalLogger.log(
        `Player lowered periscope on Submarine ${this.id}`,
        `PLAYER_ACTION`,
        LogLevel.INFO,
        {
          action: 'lowerPeriscope',
          entityId: this.id,
          entityType: this.entityType,
          depth: this.depth,
          position: { x: this.x, y: this.y }
        }
      );
    }
  }
  
  /**
   * Переопределяем метод получения шума
   */
  public getNoiseStrength(): number {
    // Базовый шум от корабля (теперь получаем через getSourceNoiseLevel родителя)
    let sourceNoise = super.getSourceNoiseLevel();
    
    // Уменьшаем шум в зависимости от глубины
    // Чем глубже, тем тише
    // Коэффициент 0.7 означает, что на максимальной глубине шум будет 1 - 0.7 = 0.3 от исходного
    const depthFactor = 1 - (this.depth / this.maxDepth) * 0.7;
    
    // Дополнительные модификаторы, если перископ опущен и лодка на глубине
    // Например, если перископ опущен (т.е. глубина > 0), можно дополнительно снизить шум
    let periscopeFactor = 1.0;
    if (!this.periscope && this.depth > 0) {
      periscopeFactor = 0.8; // Снижаем шум на 20%, если перископ опущен и есть глубина
    }

    return sourceNoise * depthFactor * periscopeFactor;
  }
  
  /**
   * Запускает ИИ - шаг 1 (анализ ситуации)
   */
  public AI_step_I(): void {
    super.AI_step_I();
    
    // Дополнительная логика ИИ для подводной лодки
    // Например, регулировка глубины в зависимости от ситуации
    if (!this.underControl) {
      // Автоматическое управление глубиной для ИИ
      // - Погружение при обнаружении опасности
      // - Всплытие для атаки
      // Будет реализовано позже
    }
  }
  
  /**
   * Запускает ИИ - шаг 2 (принятие решений)
   */
  public AI_step_II(): void {
    super.AI_step_II();
    
    // Дополнительная логика ИИ для принятия решений
    // Будет реализовано позже
  }

  /**
   * Специальный метод для игрока для запуска торпеды типа I.
   * Вызывает MainScene.fireTorpedo, который обработает создание, регистрацию,
   * и добавление целевой точки для торпеды.
   * @param targetLogicalPoint Логические координаты цели (Phaser.Math.Vector2).
   */
  public fireTorpedoTypeIPlayer(targetLogicalPoint: Phaser.Math.Vector2): void {
    const mainScene = this.scene as MainScene;

    if (this.getTorpOnBoard(Constants.WEAPON_SELECT_TORP_I) > 0 && this.isWeaponReady(Constants.WEAPON_SELECT_TORP_I)) {
      // Конвертируем логические координаты цели в Phaser мировые координаты,
      // так как fireTorpedo ожидает их для расчета угла и для возможной передачи в _spawnAndRegisterTorpedo
      const targetPhaserX = CoordUtils.logicalToPhaserX(targetLogicalPoint.x);
      const targetPhaserY = CoordUtils.logicalToPhaserY(targetLogicalPoint.y);

      const torpedo = mainScene.fireTorpedo(this, Constants.WEAPON_SELECT_TORP_I, targetPhaserX, targetPhaserY);

      if (torpedo) {
        // Для TorpedoTypeI, после вызова fireTorpedo, нам нужно вручную добавить 
        // целевую точку игрока как WP_TYPE_TORPEDO_TARGET, 
        // так как _spawnAndRegisterTorpedo делает это только для TypeII (WP_TYPE_TARGET).
        // fireTorpedo вернет созданную торпеду.
        if (torpedo instanceof TorpedoTypeI) {
          torpedo.addWayPoint(targetLogicalPoint.x, targetLogicalPoint.y, Constants.WP_TYPE_TORPEDO_TARGET);
          torpedo.startMoveOnWP();
        }

        console.log(`Submarine fireTorpedoTypeIPlayer: Delegated Torpedo I launch to MainScene for logical (${targetLogicalPoint.x}, ${targetLogicalPoint.y})`);
        
        // Логируем запуск торпеды игроком
        UniversalLogger.log(
          `Player fired Torpedo Type I from Submarine ${this.id} to target (${targetLogicalPoint.x.toFixed(0)}, ${targetLogicalPoint.y.toFixed(0)})`,
          `PLAYER_ACTION`,
          LogLevel.INFO,
          {
            action: 'fireTorpedo',
            entityId: this.id,
            entityType: this.entityType,
            torpedoId: torpedo.id,
            weaponType: 'Torpedo Type I',
            targetPosition: { x: targetLogicalPoint.x, y: targetLogicalPoint.y },
            firePosition: { x: this.x, y: this.y },
            direction: this.getDirection(),
            depth: this.depth,
            torpedosRemaining: this.getTorpOnBoard(Constants.WEAPON_SELECT_TORP_I)
          }
        );
        
        if (mainScene.informer) {
          mainScene.informer.setCommand("Торпеда I запущена!");
        }
      } else {
        // mainScene.fireTorpedo вернет null, если запуск не удался (например, оружие не готово - хотя мы это проверили)
        // или если _spawnAndRegisterTorpedo не смог создать торпеду.
        // Сообщение об ошибке уже должно было быть установлено в mainScene.fireTorpedo или _spawnAndRegisterTorpedo.
        console.warn("Submarine fireTorpedoTypeIPlayer: MainScene.fireTorpedo reported failure.");
        // Дополнительное сообщение в информер, если нужно, но оно может дублировать сообщение из MainScene
        // if (mainScene.informer && !mainScene.informer.getCurrentCommand().includes("Оружие не готово")) { // Проверяем, чтобы не дублировать
            // mainScene.informer.setCommandAlarm("Не удалось запустить Торпеду I (из Submarine)");
        // }
      }
    } else {
      console.warn("Submarine fireTorpedoTypeIPlayer: Cannot fire Torpedo I - none available or not ready.");
      if (mainScene.informer) {
        mainScene.informer.setCommandAlarm("Торпеда I не готова!");
      }
    }
  }
} 