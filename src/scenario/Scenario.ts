import Phaser from 'phaser';
import { Settings } from '../utils/Settings';
import { Constants } from '../utils/Constants';
import { Statistic } from '../utils/Statistic';
import { Obstruction } from '../objects/Obstruction';
import { MainScene } from '../scenes/MainScene';

/**
 * Базовый класс для сценариев игры
 */
export class Scenario {
  // Константы для состояний показа результатов
  protected static readonly SHOW_UNKNOWN: number = 0;
  protected static readonly SHOW_RESULT: number = 1;
  protected static readonly SHOW_ENTER_NAME: number = 2;
  protected static readonly SHOW_SCORE: number = 3;
  protected static readonly SHOW_TOPLIST: number = 4;
  protected static readonly SHOW_CONTINUE: number = 5;
  
  // Константы для состояний игры
  public static readonly GAME_CONTINUE: number = 1;
  public static readonly MISSION_SUCCESS: number = 2;
  public static readonly MISSION_FAILED: number = 3;
  
  // Константы для клавиш
  protected static readonly F2: number = 113;
  protected static readonly ENTER: number = 13;
  protected static readonly STATE_ENTER_PLAYER_NAME: number = 122; // F11
  
  // Ссылка на основную сцену
  protected scene: MainScene;
  
  // Графические объекты
  protected obstruction: Phaser.GameObjects.Graphics | null = null;
  protected portGate: Phaser.GameObjects.Graphics | null = null;
  
  // Данные для карты
  protected coastData: Phaser.Math.Vector2[] = [];
  protected portLineData: Phaser.Math.Vector2[] = [];
  
  // Стартовая позиция (теперь логические координаты, 0,0 - центр мира по умолчанию)
  protected START_X: number = 0;
  protected START_Y: number = 0;
  protected startPosition: Phaser.Math.Vector2; // Будет хранить логические координаты
  
  // Данные для счета
  protected name: string = "";
  protected scoreName: string = "";
  protected score: number = 0;
  protected success: string = "";
  protected comment: string = "";
  protected inputTextState: number = 0;
  
  // Состояние отображения
  protected state: number = Scenario.SHOW_UNKNOWN;
  
  // Имя игрока
  protected playerName: string = "Unknown";
  
  // Время для бонусов
  protected bonusTimeGameSec: number = 10000; // Бонус за время при успешной миссии
  protected sessionId: string = "-";
  
  /**
   * Конструктор
   * @param scene Сцена игры
   * @param name Название сценария
   */
  constructor(scene: MainScene, name: string) {
    this.scene = scene;
    this.name = name;
    this.scoreName = name;
    // startPosition инициализируется логическими START_X, START_Y
    this.startPosition = new Phaser.Math.Vector2(this.START_X, this.START_Y);
  }
  
  /**
   * Инициализация сценария
   */
  public init(): void {
    // Устанавливаем имя игрока в информер
    if (this.scene.informer) {
      this.scene.informer.setPlayerName(this.playerName);
    }
    this.writeSession();
  }
  
  /**
   * Последующая инициализация (должна вызываться в дочерних сценариях)
   */
  protected initAfter(): void {
    this.startPosition = new Phaser.Math.Vector2(this.START_X, this.START_Y);
  }
  
  /**
   * Получает стартовую позицию
   */
  public getStartPosition(): Phaser.Math.Vector2 {
    return this.startPosition.clone();
  }
  
  /**
   * Очистка ресурсов сценария
   */
  public clean(): void {
    this.obstruction = null;
    this.portGate = null;
    
    this.coastData = [];
    this.portLineData = [];
    
    // Сбрасываем на логический центр
    this.START_X = 0;
    this.START_Y = 0;
    if (this.startPosition) { // Обновляем и startPosition, если она уже создана
        this.startPosition.set(this.START_X, this.START_Y);
    }
    
    this.name = "";
    this.score = 0;
    this.success = "";
    this.comment = "";
    this.inputTextState = 0;
    
    this.state = Scenario.SHOW_UNKNOWN;
  }
  
  /**
   * Устанавливает имя игрока
   * @param name Имя игрока
   */
  public setPlayerName(name: string): void {
    this.playerName = name;
    if (this.scene.informer) {
      this.scene.informer.setPlayerName(name);
    }
  }
  
  /**
   * Получает имя игрока
   */
  public getPlayerName(): string {
    return this.playerName;
  }
  
  /**
   * Обработчик нажатия клавиш
   * @param event Событие клавиатуры
   */
  protected handleKeyDown(event: KeyboardEvent): void {
    // Выход из игры по ESC
    if (event.keyCode === 27) {
      console.log("ESC - выход из игры");
      // В JS нет прямого аналога fscommand, нужно добавить свой обработчик выхода
    } 
    // Ввод имени игрока
    else if (event.keyCode === Scenario.STATE_ENTER_PLAYER_NAME) {
      this.enterPlayerName();
    } 
    // Обработка Enter
    else if (event.keyCode === Scenario.ENTER) {
      if (this.inputTextState === Scenario.STATE_ENTER_PLAYER_NAME) {
        // Здесь должна быть обработка ввода имени
        this.inputTextState = 0;
      } else {
        this.nextSlide();
      }
    } 
    // Другие клавиши - для перелистывания слайдов
    else {
      if (this.inputTextState !== Scenario.STATE_ENTER_PLAYER_NAME) {
        this.nextSlide();
      }
    }
  }
  
  /**
   * Запрашивает ввод имени игрока
   */
  protected enterPlayerName(): void {
    // Здесь должен быть код для отображения поля ввода имени
    this.inputTextState = Scenario.STATE_ENTER_PLAYER_NAME;
  }
  
  /**
   * Обработчик нажатия мыши
   */
  protected handleMouseDown(): void {
    this.nextSlide();
  }
  
  /**
   * Переход к следующему слайду
   */
  protected nextSlide(): void {
    if (this.inputTextState !== 0) {
      if (this.scene.informer) {
        this.scene.informer.setCommandAlarm("Введите ваше имя.");
      }
      return;
    }
    
    if (this.state === Scenario.SHOW_RESULT) {
      if (Settings.WEB_ENABLE) {
        if (this.playerName === "Unknown") {
          this.enterPlayerName();
        }
      }
      this.state = Scenario.SHOW_ENTER_NAME;
    } else if (this.state === Scenario.SHOW_ENTER_NAME) {
      this.state = Scenario.SHOW_SCORE;
      this.showScore();
    } else if (this.state === Scenario.SHOW_SCORE) {
      this.state = Scenario.SHOW_TOPLIST;
      this.showTopList();
    } else if (this.state === Scenario.SHOW_TOPLIST) {
      this.state = Scenario.SHOW_CONTINUE;
      this.showContinue();
    }
  }
  
  /**
   * Генерирует данные побережья
   * Должно быть переопределено в дочерних классах
   */
  protected genCoastData(): void {
    // Базовая реализация пуста
  }
  
  /**
   * Генерирует препятствия (берега)
   * Должно быть переопределено в дочерних классах
   */
  public genObstruction(): void {
    // Базовая реализация пуста
  }
  
  /**
   * Генерирует ворота порта
   * Должно быть переопределено в дочерних классах
   */
  public genPortGate(): void {
    // Базовая реализация пуста
  }
  
  /**
   * Проверяет условия окончания игры
   */
  public checkGameOver(): number {
    // Если все вражеские корабли уничтожены - победа
    if (this.scene.getRedShips().length === 0) {
      return Scenario.MISSION_SUCCESS;
    }
    
    // Если корабль игрока уничтожен - поражение
    if (this.scene.getMyShip() === null) {
      return Scenario.MISSION_FAILED;
    }
    
    // В остальных случаях - игра продолжается
    return Scenario.GAME_CONTINUE;
  }
  
  /**
   * Обработка окончания игры
   * @param success Результат миссии (успех/провал)
   */
  public gameOver(success: number): void {
    if (success === Scenario.MISSION_SUCCESS) {
      this.success = "Успех";
    } else {
      this.success = "Миссия провалена";
    }
    
    this.calcScore(success);
    this.state = Scenario.SHOW_RESULT;
    
    // Добавляем обработчики событий для интерфейса результатов
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    this.scene.input.on('pointerdown', this.handleMouseDown, this);
  }
  
  /**
   * Вычисляет минимальный счет
   */
  protected getMinimalScore(): number {
    return 0;
  }
  
  /**
   * Записывает сессию (для онлайн-возможностей)
   */
  protected writeSession(): void {
    // В JavaScript-версии нужно реализовать свой аналог
    if (Settings.WEB_ENABLE) {
      // Здесь будет код для сохранения результатов онлайн
    }
  }
  
  /**
   * Вычисляет счет
   * @param success Результат миссии
   */
  public calcScore(success: number): number {
    // Базовое вычисление счета
    if (success === Scenario.MISSION_SUCCESS) {
      this.score = 1000;
      
      // Бонус за время прохождения
      if (Statistic.time_game_sec > 0) {
        this.score += Math.floor(this.bonusTimeGameSec / Statistic.time_game_sec);
      }
      
      // Бонус за уничтожение врагов
      this.score += Statistic.enemy_destroyed * 300;
    } else {
      // При провале счет меньше
      this.score = 100;
      this.score += Statistic.enemy_destroyed * 100; // Меньший бонус за врагов
    }
    
    return this.score;
  }
  
  /**
   * Показывает счет
   */
  protected showScore(): void {
    // Должно быть реализовано в подклассах
  }
  
  /**
   * Показывает топ-лист
   */
  protected showTopList(): void {
    // Должно быть реализовано в подклассах
  }
  
  /**
   * Показывает экран продолжения
   */
  protected showContinue(): void {
    // Должно быть реализовано в подклассах
  }
  
  /**
   * Показывает результаты игры
   * @param header Заголовок
   * @param content Основной текст
   * @param footer Подвал
   */
  protected showGameOver(header: string, content: string, footer: string): void {
    if (this.scene.informer) {
      this.scene.informer.showInfoPanel(header, content, footer);
    }
  }
  
  /**
   * Показывает цель миссии
   * @param header Заголовок
   * @param content Описание миссии
   * @param footer Подвал
   */
  public showMissionGoal(header: string, content: string, footer: string): void {
    if (this.scene.informer) {
      this.scene.informer.showInfoPanel(header, content, footer);
    }
  }
  
  /**
   * Показывает цель текущей миссии
   * Должно быть переопределено в дочерних классах
   */
  public showMissinGoal(): void {
    // Базовая реализация пуста
  }
  
  /**
   * Скрывает цель миссии
   */
  public hideMissionGoal(): void {
    if (this.scene.informer) {
      this.scene.informer.hideInfoPanel();
    }
  }
} 