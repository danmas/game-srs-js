import Phaser from 'phaser';
import { Constants } from './Constants';
import { Settings } from './Settings';
import { Lamp } from './Lamp';

/**
 * Класс информационной панели
 * Управляет всеми элементами пользовательского интерфейса
 */
export class Informer {
  // Константы для индексов полей
  private readonly SPD: number = 0;
  private readonly POW: number = 1;
  private readonly RUD: number = 2;
  private readonly DIR: number = 3;
  private readonly ZOM: number = 4;
  private readonly NUMB_FIELDS: number = 5;
  
  // Константы для стилей полей
  private readonly COMMAND_HEIGHT: number = 22;
  private readonly COMMAND_WIDTH: number = 900;
  private readonly COMMAND_COLOR: number = 0xFFFFFF;
  
  private readonly LBL_WIDTH: number = 50;
  private readonly FIELD_HEIGHT: number = 22; // высота поля
  private readonly FIELD_WIDTH: number = 60; // ширина поля
  private readonly FIELD_TEXT_SIZE: number = 20; // размер шрифта для основных полей
  private readonly FIELD_TEXT_COLOR: string = '#ffffff'; // цвет шрифта для основных полей
  private readonly FIELD_TEXT_BGCOLOR: string = '#1E90FF'; // цвет фона для основных полей
  private readonly FIELD_ALPHA: number = 0.8; // прозрачность полей
  
  // Поля справа (NOISE)
  private readonly R_LBL_WIDTH: number = 150; // ширина меток справа
  private readonly R_FIELD_WIDTH: number = 100; // ширина полей справа
  private readonly R_FIELD_HEIGHT: number = 22; // высота полей справа
  private readonly R_FIELD_TEXT_SIZE: number = 20; // размер шрифта для полей справа
  private readonly R_FIELD_TEXT_COLOR: string = '#ffff00'; // цвет шрифта для полей справа
  private readonly R_FIELD_TEXT_BGCOLOR: string = '#1E90FF';  
  private readonly R_ALPHA: number = 0.8;
  
  // Отладочная панель
  private readonly TF_FIELD_HEIGHT: number = 200; // высота поля справа
  private readonly TF_FIELD_WIDTH: number = 300; // ширина поля справа
  private readonly TF_FIELD_TEXT_SIZE: number = 15; // размер шрифта для поля справа
  private readonly TF_FIELD_TEXT_COLOR: string = '#ffff00'; // цвет шрифта для поля справа
  private readonly TF_FIELD_TEXT_BGCOLOR: string = '#1E90FF'; // цвет фона для поля справа
  private readonly TF_FIELD_ALPHA: number = 0.8; // прозрачность поля справа
  
  private readonly TF_MAX_LINES = 20; // Максимальное количество строк в панели отладки
  private readonly DEBUG_PANEL_DEPTH = 101; // Глубина для панели отладки (выше других UI)
  
  // Ссылка на сцену
  private scene: Phaser.Scene;
  
  // Камера для отображения UI
  private uiCamera: Phaser.Cameras.Scene2D.Camera | null = null;
  
  // Основные текстовые поля
  public playerNameText: Phaser.GameObjects.Text | null = null;
  public timeText: Phaser.GameObjects.Text | null = null;
  public commandText: Phaser.GameObjects.Text | null = null;
  public traceText: Phaser.GameObjects.Text | null = null;
  
  // Массивы полей и индикаторов
  private fields: Phaser.GameObjects.Text[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  private rightFields: Phaser.GameObjects.Text[] = [];
  private rightLabels: Phaser.GameObjects.Text[] = [];
  private lamps: Lamp[] = [];
  
  // Информационные панели
  private infoPanelHeader: Phaser.GameObjects.Text | null = null;
  private infoPanelText: Phaser.GameObjects.Text | null = null;
  private infoPanelFooter: Phaser.GameObjects.Text | null = null;
  
  // Счетчик сообщений
  private msgCount: number = 1;
  
  /**
   * Устанавливает камеру для отображения UI
   * @param camera Камера для UI-элементов
   */
  public setCamera(camera: Phaser.Cameras.Scene2D.Camera): void {
    this.uiCamera = camera;
    
    // Добавляем все существующие элементы UI в камеру
    this.addElementsToCamera();
  }
  
  /**
   * Добавляет все UI элементы в UI камеру
   */
  private addElementsToCamera(): void {
    if (!this.uiCamera) return;
    
    // Получаем все UI элементы
    const uiElements = this.getAllUIElements();
    
    // Получаем ссылку на сцену и основную камеру
    const scene = this.scene as Phaser.Scene;
    const gameCamera = scene.cameras.main;
    
    // Игнорируем все UI элементы в основной камере
    if (gameCamera && gameCamera !== this.uiCamera) {
      gameCamera.ignore(uiElements);
    }
    
    // Игнорируем все не-UI элементы в UI камере
    // Получаем все объекты сцены
    const allObjects = scene.children.list;
    
    // Фильтруем объекты, которые не являются UI элементами
    const nonUIObjects = allObjects.filter(obj => !uiElements.includes(obj));
    
    // Игнорируем их в UI камере
    this.uiCamera.ignore(nonUIObjects);
  }
  
  /**
   * Конструктор
   * @param scene Сцена, на которой размещается интерфейс
   */
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    
    // Создаем поле с именем игрока
    this.playerNameText = scene.add.text(0, 10, '', {
      fontSize: `${this.FIELD_TEXT_SIZE}px`,
      fontFamily: 'Courier',
      color: this.FIELD_TEXT_COLOR,
      backgroundColor: this.FIELD_TEXT_BGCOLOR,
      padding: { left: 5, right: 5, top: 2, bottom: 2 }
    });
    this.playerNameText.setFixedSize(this.LBL_WIDTH + this.FIELD_WIDTH + 2, this.FIELD_HEIGHT);
    this.playerNameText.setAlpha(this.FIELD_ALPHA);
    this.playerNameText.setScrollFactor(0);
    this.playerNameText.setDepth(100);
    
    // Создаем поле с временем
    this.timeText = scene.add.text(0, this.playerNameText.y + this.playerNameText.height, '', {
      fontSize: `${this.FIELD_TEXT_SIZE}px`,
      fontFamily: 'Courier',
      color: this.FIELD_TEXT_COLOR,
      backgroundColor: this.FIELD_TEXT_BGCOLOR,
      padding: { left: 5, right: 5, top: 2, bottom: 2 }
    });
    this.timeText.setFixedSize(this.LBL_WIDTH + this.FIELD_WIDTH + 2, this.FIELD_HEIGHT);
    this.timeText.setAlpha(this.FIELD_ALPHA);
    this.timeText.setScrollFactor(0);
    this.timeText.setDepth(100);
    
    // Создаем поля основных параметров
    for (let j = 0; j < this.NUMB_FIELDS; j++) {
      // Метка
      const label = scene.add.text(0, this.timeText.y + this.timeText.height + 5 + j * this.FIELD_HEIGHT, '', {
        fontSize: `${this.FIELD_TEXT_SIZE}px`,
        fontFamily: 'Courier',
        color: this.FIELD_TEXT_COLOR,
        backgroundColor: this.FIELD_TEXT_BGCOLOR,
        padding: { left: 5, right: 5, top: 2, bottom: 2 }
      });
      label.setFixedSize(this.LBL_WIDTH, this.FIELD_HEIGHT);
      label.setAlpha(this.FIELD_ALPHA);
      label.setScrollFactor(0);
      label.setDepth(100);
      this.labels.push(label);
      
      // Значение
      const field = scene.add.text(
        label.x + label.width + 2,
        this.timeText.y + this.timeText.height + 5 + j * this.FIELD_HEIGHT,
        '0',
        {
          fontSize: `${this.FIELD_TEXT_SIZE}px`,
          fontFamily: 'Courier',
          color: this.FIELD_TEXT_COLOR,
          backgroundColor: this.FIELD_TEXT_BGCOLOR,
          padding: { left: 5, right: 5, top: 2, bottom: 2 }
        }
      );
      field.setFixedSize(this.FIELD_WIDTH, this.FIELD_HEIGHT);
      field.setAlpha(this.FIELD_ALPHA);
      field.setScrollFactor(0);
      field.setDepth(100);
      this.fields.push(field);
    }
    
    // Устанавливаем метки для основных полей
    this.labels[this.SPD].setText('SPD');
    this.labels[this.RUD].setText('RUD');
    this.labels[this.DIR].setText('CRS');
    this.labels[this.POW].setText('POW');
    this.labels[this.ZOM].setText('ZOM');
    
    // Устанавливаем начальные значения
    this.fields[this.RUD].setText('0');
    
    // Создаем командную строку
    this.setupCommandText();
    
    // Создаем индикаторы (лампы)
    this.panelLampSet(1, Constants.LAMP_TRPRD_I, Constants.LAMP_TRPRD_I, false);
    this.panelLampSet(2, Constants.LAMP_TRPRD_II, Constants.LAMP_TRPRD_II, false);
    this.panelLampSet(3, Constants.LAMP_TRPRD_III, Constants.LAMP_TRPRD_III, false);
    this.panelLampSet(4, Constants.LAMP_TRPRD_III + "2", Constants.LAMP_TRPRD_III, false);
    this.panelLampSet(5, Constants.LAMP_WP, "WP", false);
    this.panelLampSet(6, Constants.LAMP_TRP_ATACK, Constants.LAMP_TRP_ATACK, false);
    
    // Подготавливаем панель конца игры
    this.prepareGameOver();
  }
  
  /**
   * Создает командную строку
   */
  private setupCommandText(): void {
    this.commandText = this.scene.add.text(200, Settings.SCREEN_HEIGHT-375/* - this.COMMAND_HEIGHT*/, '', {
      fontSize: `${this.FIELD_TEXT_SIZE}px`,
      fontFamily: 'Courier',
      color: this.FIELD_TEXT_COLOR,
      backgroundColor: this.FIELD_TEXT_BGCOLOR,
      padding: { left: 5, right: 5, top: 2, bottom: 2 }
    });
    this.commandText.setFixedSize(this.COMMAND_WIDTH, this.COMMAND_HEIGHT);
    this.commandText.setAlpha(this.FIELD_ALPHA);
    this.commandText.setScrollFactor(0); // Фиксирует положение при скролле
    this.commandText.setDepth(100); // Высокое значение глубины, чтобы отображать поверх всего
  }
  
  /**
   * Медленное обновление (для мигающих индикаторов)
   * @param time Текущее время
   */
  public onSlowLoop(time: number): void {
    const lamp = this.getPanelLamp(Constants.LAMP_TRP_ATACK);
    if (lamp) {
      lamp.blinkAlarmWarning(time);
    }
  }
  
  /**
   * Очищает все элементы интерфейса
   */
  public clean(): void {
    if (this.playerNameText) this.playerNameText.destroy();
    if (this.timeText) this.timeText.destroy();
    if (this.commandText) this.commandText.destroy();
    if (this.traceText) this.traceText.destroy();
    
    this.playerNameText = null;
    this.timeText = null; 
    this.commandText = null;
    this.traceText = null;
    
    // Очищаем основные поля
    for (const label of this.labels) {
      label.destroy();
    }
    for (const field of this.fields) {
      field.destroy();
    }
    this.labels = [];
    this.fields = [];
    
    // Очищаем правые поля
    for (const label of this.rightLabels) {
      label.destroy();
    }
    for (const field of this.rightFields) {
      field.destroy();
    }
    this.rightLabels = [];
    this.rightFields = [];
    
    // Очищаем индикаторы
    for (const lamp of this.lamps) {
      lamp.destroy();
    }
    this.lamps = [];
    
    // Очищаем панель конца игры
    if (this.infoPanelHeader) this.infoPanelHeader.destroy();
    if (this.infoPanelText) this.infoPanelText.destroy();
    if (this.infoPanelFooter) this.infoPanelFooter.destroy();
    
    this.infoPanelHeader = null;
    this.infoPanelText = null;
    this.infoPanelFooter = null;
  }
  
  /**
   * Устанавливает имя игрока
   * @param txt Имя игрока
   */
  public setPlayerName(txt: string): void {
    if (this.playerNameText) {
      this.playerNameText.setText(txt);
    }
  }
  
  /**
   * Подготавливает панель информации о конце игры
   */
  public prepareGameOver(): void {
    // Заголовок
    this.infoPanelHeader = this.scene.add.text(0, 0, '', {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { left: 10, right: 10, top: 5, bottom: 5 }
    });
    this.infoPanelHeader.setScrollFactor(0);
    this.infoPanelHeader.setDepth(100);
    this.infoPanelHeader.setVisible(false);
    
    // Основной текст
    this.infoPanelText = this.scene.add.text(0, 0, '', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { left: 10, right: 10, top: 5, bottom: 5 }
    });
    this.infoPanelText.setScrollFactor(0);
    this.infoPanelText.setDepth(100);
    this.infoPanelText.setVisible(false);
    
    // Нижняя часть (footer)
    this.infoPanelFooter = this.scene.add.text(0, 0, '', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { left: 10, right: 10, top: 5, bottom: 5 }
    });
    this.infoPanelFooter.setScrollFactor(0);
    this.infoPanelFooter.setDepth(100);
    this.infoPanelFooter.setVisible(false);
  }
  
  /**
   * Показывает информационную панель
   * @param header Заголовок
   * @param txt Текст
   * @param footer Нижняя часть
   */
  public showInfoPanel(header: string, txt: string, footer: string): void {
    this.setTextPanel(header, txt, footer);
    
    if (this.infoPanelHeader) this.infoPanelHeader.setVisible(true);
    if (this.infoPanelText) this.infoPanelText.setVisible(true);
    if (this.infoPanelFooter) this.infoPanelFooter.setVisible(true);
  }
  
  /**
   * Скрывает информационную панель
   */
  public hideInfoPanel(): void {
    if (this.infoPanelHeader) this.infoPanelHeader.setVisible(false);
    if (this.infoPanelText) this.infoPanelText.setVisible(false);
    if (this.infoPanelFooter) this.infoPanelFooter.setVisible(false);
  }
  
  /**
   * Устанавливает время
   * @param tm Время в миллисекундах
   */
  public setTime(tm: number): void {
    if (this.timeText) {
      const t = Math.floor(tm / 1000);
      this.timeText.setText(`${t} sec.`);
    }
  }
  
  /**
   * Включает режим паузы для времени
   */
  public setTimePause(): void {
    if (this.timeText) {
      this.timeText.setBackgroundColor('#FF0000');
    }
  }
  
  /**
   * Возвращает нормальный режим отображения времени
   */
  public setTimeGo(): void {
    if (this.timeText) {
      this.timeText.setBackgroundColor(this.FIELD_TEXT_BGCOLOR);
    }
  }
  
  /**
   * Устанавливает скорость
   * @param speed Скорость
   */
  public setSpeed(speed: number): void {
    if (this.fields[this.SPD]) {
      this.fields[this.SPD].setText(Math.floor(speed).toString());
    }
  }
  
  /**
   * Устанавливает руль
   * @param rudder Положение руля
   */
  public setRudder(rudder: string): void {
    // console.log(`Informer.setRudder called with: ${rudder}`);
    
    try {
      // Проверяем наличие поля RUD
      if (this.RUD === undefined) {
        console.error('Индекс RUD не определен');
        return;
      }
      
      // Проверяем наличие массива fields
      if (!this.fields || !Array.isArray(this.fields)) {
        console.error('Массив fields не существует или не является массивом');
        return;
      }
      
      // Проверяем наличие элемента по индексу RUD
      if (!this.fields[this.RUD]) {
        console.error(`Поле RUD не существует по индексу ${this.RUD}`);
        return;
      }
      
      // Проверяем наличие метода setText
      if (typeof this.fields[this.RUD].setText !== 'function') {
        console.error('Метод setText не является функцией');
        return;
      }
      
      // Устанавливаем текст руля
      this.fields[this.RUD].setText(rudder);
      // console.log(`Rudder indicator successfully updated to: ${rudder}`);
    } catch (error) {
      console.error('Ошибка при обновлении руля:', error);
    }
  }
  
  /**
   * Добавляет отладочное поле слева
   * @param fieldName Имя поля
   * @param value Значение
   */
  public writeDebugDopField(fieldName: string, value: string): void {
    if (!Settings.DEBUG) return;
    
    // Проверяем, существует ли поле
    let index = this.labels.findIndex(label => label.text === fieldName);
    
    if (index === -1) {
      // Создаем новое поле если не существует
      const labelY = this.timeText ? this.timeText.y + this.timeText.height + 5 + this.labels.length * this.FIELD_HEIGHT : 0;
      
      // Создаем метку
      const label = this.scene.add.text(0, labelY, fieldName, {
        fontSize: `${this.FIELD_TEXT_SIZE - 2}px`,
        fontFamily: 'Courier',
        color: '#FFFF00',
        backgroundColor: this.FIELD_TEXT_BGCOLOR,
        padding: { left: 5, right: 5, top: 2, bottom: 2 }
      });
      label.setFixedSize(this.LBL_WIDTH, this.FIELD_HEIGHT);
      label.setAlpha(this.FIELD_ALPHA);
      this.labels.push(label);
      
      // Создаем значение
      const field = this.scene.add.text(label.x + label.width + 2, labelY, value, {
        fontSize: `${this.FIELD_TEXT_SIZE - 2}px`,
        fontFamily: 'Courier',
        color: '#FFFF00',
        backgroundColor: this.FIELD_TEXT_BGCOLOR,
        padding: { left: 5, right: 5, top: 2, bottom: 2 }
      });
      field.setFixedSize(this.FIELD_WIDTH, this.FIELD_HEIGHT);
      field.setAlpha(this.FIELD_ALPHA);
      this.fields.push(field);
    } else {
      // Обновляем существующее поле
      this.fields[index].setText(value);
    }
  }
  
  /**
   * Удаляет поле справа
   * @param fieldName Имя поля
   */
  public removeRightField(fieldName: string): void {
    const index = this.rightLabels.findIndex(label => label.text === fieldName);
    
    if (index !== -1) {
      this.rightLabels[index].destroy();
      this.rightFields[index].destroy();
      this.rightLabels.splice(index, 1);
      this.rightFields.splice(index, 1);
    }
  }
  
  /**
   * Добавляет отладочное поле справа
   * @param fieldName Имя поля
   * @param value Значение
   */
  public writeDebugRightField(fieldName: string, value: string): void {
    if (!Settings.DEBUG) return;
    this.writeRightField(fieldName, value);
  }
  
  /**
   * Добавляет поле справа
   * @param fieldName Имя поля
   * @param value Значение
   */
  public writeRightField(fieldName: string, value: string): void {
    // Проверяем, существует ли поле
    let index = this.rightLabels.findIndex(label => label.text === fieldName);
    
    if (index === -1) {
      // Создаем новое поле
      const y = 5 + this.rightLabels.length * this.R_FIELD_HEIGHT;
      
      // Создаем значение (справа)
      const field = this.scene.add.text(0, y, value, {
        fontSize: `${this.R_FIELD_TEXT_SIZE - 2}px`,
        fontFamily: 'Courier',
        color: this.R_FIELD_TEXT_COLOR,
        backgroundColor: this.R_FIELD_TEXT_BGCOLOR,
        padding: { left: 5, right: 5, top: 2, bottom: 2 }
      });
      field.setFixedSize(this.R_FIELD_WIDTH, this.R_FIELD_HEIGHT);
      field.setAlpha(this.R_ALPHA);
      field.setScrollFactor(0);
      field.setDepth(100);
      
      // Создаем метку (слева от значения)
      const label = this.scene.add.text(0, y, fieldName, {
        fontSize: `${this.R_FIELD_TEXT_SIZE - 2}px`,
        fontFamily: 'Courier',
        color: this.R_FIELD_TEXT_COLOR,
        backgroundColor: this.R_FIELD_TEXT_BGCOLOR,
        padding: { left: 5, right: 5, top: 2, bottom: 2 }
      });
      label.setFixedSize(this.R_LBL_WIDTH, this.R_FIELD_HEIGHT);
      label.setAlpha(this.R_ALPHA);
      label.setScrollFactor(0);
      label.setDepth(100);
      
      // Устанавливаем позиции (справа экрана)
      field.setX(Settings.SCREEN_WIDTH - field.width - 2);
      label.setX(field.x - label.width);
      
      this.rightLabels.push(label);
      this.rightFields.push(field);
    } else {
      // Обновляем существующее поле
      this.rightFields[index].setText(value);
    }
  }
  
  /**
   * Устанавливает состояние индикатора (включен/выключен)
   * @param lampName Имя индикатора
   * @param on Состояние
   */
  public panelLampOnOff(lampName: string, on: boolean): void {
    const lamp = this.getPanelLamp(lampName);
    if (lamp) {
      lamp.setOnOff(on);
    } else {
      console.warn(`PANEL LAMP ${lampName} NOT SET!!!`);
    }
  }
  
  /**
   * Устанавливает состояние индикатора (готов/не готов)
   * @param lampName Имя индикатора
   * @param ready Состояние
   */
  public panelLampReadyNotReady(lampName: string, ready: boolean): void {
    const lamp = this.getPanelLamp(lampName);
    if (lamp) {
      lamp.setReadyNotReady(ready);
    } else {
      console.warn(`PANEL LAMP ${lampName} NOT SET!!!`);
    }
  }
  
  /**
   * Создает индикатор (лампу)
   * @param num Номер лампы
   * @param lampName Имя лампы
   * @param text Текст лампы
   * @param on Начальное состояние (вкл/выкл)
   */
  public panelLampSet(num: number, lampName: string, text: string, on: boolean): void {
    // Текстура и цвет в зависимости от состояния
    const textureName = 'lamp_' + (on ? 'on' : 'off');
    const color = on ? '#00FF00' : '#FF0000';
    
    // Вычисляем координаты
    const x = Settings.SCREEN_WIDTH - 40;
    const y = 15 + (num - 1) * 30;
    
    // Проверяем, существует ли уже такая лампа
    const existingLamp = this.getPanelLamp(lampName);
    if (existingLamp) {
      existingLamp.setState(on);
      return;
    }
    
    // Создаем графику для лампы
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(on ? 0x00FF00 : 0xFF0000, 1);
    graphics.fillCircle(10, 10, 10);
    graphics.lineStyle(2, 0xFFFFFF, 1);
    graphics.strokeCircle(10, 10, 10);
    
    // Генерируем текстуру для лампы
    if (!this.scene.textures.exists(textureName)) {
      graphics.generateTexture(textureName, 20, 20);
    }
    
    graphics.destroy();
    
    // Создаем спрайт лампы
    const sprite = this.scene.add.sprite(x, y, textureName);
    
    // Создаем текст для лампы
    const txt = this.scene.add.text(x + 5, y - 10, text, {
      fontFamily: 'Courier',
      fontSize: '16px',
      color: color
    });
    
    // Фиксируем позицию при скролле
    sprite.setScrollFactor(0);
    sprite.setDepth(100);
    txt.setScrollFactor(0);
    txt.setDepth(100);
    
    // Создаем и сохраняем объект лампы
    const lamp = new Lamp(lampName, sprite, txt);
    this.lamps.push(lamp);
  }
  
  /**
   * Получает индикатор по имени
   * @param lampName Имя индикатора
   * @returns Индикатор или null
   */
  public getPanelLamp(lampName: string): Lamp | null {
    return this.lamps.find(lamp => lamp.name === lampName) || null;
  }
  
  /**
   * Запускает мигание индикатора
   * @param lampName Имя индикатора
   */
  public panelLampBlinkAlarmWarning(lampName: string): void {
    const lamp = this.getPanelLamp(lampName);
    if (lamp) {
      lamp.startBlinkAlarmWarning();
    }
  }
  
  /**
   * Устанавливает активное состояние индикатора
   * @param lampName Имя индикатора
   */
  public panelLampActive(lampName: string): void {
    const lamp = this.getPanelLamp(lampName);
    if (lamp) {
      lamp.setActiveState();
    }
  }
  
  /**
   * Выключает индикатор
   * @param lampName Имя индикатора
   */
  public panelLampOff(lampName: string): void {
    const lamp = this.getPanelLamp(lampName);
    if (lamp) {
      lamp.setOff();
    }
  }
  
  /**
   * Создает текстовое поле для отладочной информации
   */
  public writeText(val: string): void {
    let currentLines: string[] = [];

    if (!this.traceText) {
      let offsetY = 10; // Значение по умолчанию
      if (this.labels.length > 0 && this.labels[this.labels.length - 1]) {
        // Попробуем разместить под последней меткой слева, если они есть
        offsetY = this.labels[this.labels.length - 1].y + this.labels[this.labels.length - 1].height + 5;
      } else if (this.timeText) {
        // Или под полем времени
        offsetY = this.timeText.y + this.timeText.height + 5;
      }
      // Можно добавить еще условий или просто фиксированную позицию, если динамическая не подходит
      // Например, this.commandText.y + this.commandText.height + 5

      this.traceText = this.scene.add.text(
        5, 
        offsetY, // Используем рассчитанный offsetY
        '', // Начинаем с пустого текста
        {
          fontSize: `${this.TF_FIELD_TEXT_SIZE}px`,
          fontFamily: 'Courier',
          color: this.TF_FIELD_TEXT_COLOR,
          backgroundColor: this.TF_FIELD_TEXT_BGCOLOR,
          padding: { left: 5, right: 5, top: 5, bottom: 5 },
          wordWrap: { width: this.TF_FIELD_WIDTH - 10 }
        }
      );
      this.traceText.setFixedSize(this.TF_FIELD_WIDTH, this.TF_FIELD_HEIGHT);
      this.traceText.setAlpha(this.TF_FIELD_ALPHA);
      this.traceText.setScrollFactor(0);
      this.traceText.setDepth(this.DEBUG_PANEL_DEPTH); 
      this.traceText.setVisible(true); // Новый объект должен быть видим
      // Убедимся, что getAllUIElements() его возвращает, чтобы камеры настроились
    } else {
      // Если traceText существует, убедимся, что он видим
      if (!this.traceText.visible) {
        this.traceText.setVisible(true);
      }
      // Берем существующие строки, отфильтровывая пустые, которые могли остаться от setText('')
      currentLines = this.traceText.text.split('\n').filter(line => line.trim() !== '');
    }
    
    const newMessage = `${this.msgCount++}: ${val}`;
    currentLines.unshift(newMessage); // Добавляем новое сообщение в начало
    
    if (currentLines.length > this.TF_MAX_LINES) {
      currentLines = currentLines.slice(0, this.TF_MAX_LINES); // Оставляем только последние TF_MAX_LINES строк
    }
    
    this.traceText.setText(currentLines.join('\n'));
  }
  
  /**
   * Добавляет отладочный текст
   * @param val Текст сообщения
   */
  public writeDebugText(val: string): void {
    if (Settings.DEBUG) {
      this.writeText(val);
    }
  }
  
  /**
   * Очищает вывод отладочной панели и скрывает её.
   */
  public clearDebugOutput(): void {
    if (this.traceText) {
        this.traceText.setText(''); 
        this.traceText.setVisible(false);
    }
    this.msgCount = 1; // Сбрасываем счетчик сообщений для новой сессии вывода
  }
  
  /**
   * Устанавливает текст команды
   * @param command Текст команды
   */
  public setCommand(command: string): void {
    if (this.commandText) {
      this.commandText.setColor(this.FIELD_TEXT_COLOR);
      this.commandText.setText(command);
    }
  }
  
  /**
   * Устанавливает текст команды с сигналом тревоги
   * @param command Текст команды
   */
  public setCommandAlarm(command: string): void {
    if (this.commandText) {
      this.commandText.setColor('#ff0000');
      this.commandText.setText(command);
      this.writeText(command);
    }
  }
  
  /**
   * Устанавливает направление
   * @param direction Значение направления
   */
  public setDirection(direction: string): void {
    if (this.fields[this.DIR]) {
      this.fields[this.DIR].setText(direction);
    }
  }
  
  /**
   * Устанавливает мощность
   * @param power Значение мощности
   */
  public setPower(power: string): void {
    if (this.fields[this.POW]) {
      this.fields[this.POW].setText(power);
    }
  }
  
  /**
   * Устанавливает масштаб
   * @param zoom Значение масштаба
   */
  public setZoom(zoom: number): void {
    if (this.fields[this.ZOM]) {
      this.fields[this.ZOM].setText(zoom.toFixed(3));
    }
  }
  
  /**
   * Устанавливает текст в информационной панели
   */
  private setTextPanel(header: string, txt: string, footer: string): void {
    if (!this.infoPanelHeader || !this.infoPanelText || !this.infoPanelFooter) return;
    
    // Устанавливаем тексты
    this.infoPanelHeader.setText(header);
    this.infoPanelText.setText(txt);
    this.infoPanelFooter.setText(footer);
    
    // Рассчитываем позиции для центрирования
    const screenCenterX = Settings.SCREEN_WIDTH / 2;
    const screenCenterY = Settings.SCREEN_HEIGHT / 2;
    
    // Позиционируем элементы
    this.infoPanelHeader.setPosition(
      screenCenterX - this.infoPanelHeader.width / 2,
      screenCenterY - this.infoPanelHeader.height - this.infoPanelText.height / 2
    );
    
    this.infoPanelText.setPosition(
      screenCenterX - this.infoPanelText.width / 2,
      this.infoPanelHeader.y + this.infoPanelHeader.height
    );
    
    this.infoPanelFooter.setPosition(
      screenCenterX - this.infoPanelFooter.width / 2,
      this.infoPanelText.y + this.infoPanelText.height
    );
  }
  
  /**
   * Возвращает все UI элементы для правильной настройки камер
   * @returns Массив всех UI элементов
   */
  public getAllUIElements(): Phaser.GameObjects.GameObject[] {
    const uiElements: Phaser.GameObjects.GameObject[] = [];
    
    // Добавляем основные текстовые поля
    if (this.playerNameText) uiElements.push(this.playerNameText);
    if (this.timeText) uiElements.push(this.timeText);
    if (this.commandText) uiElements.push(this.commandText);
    if (this.traceText) uiElements.push(this.traceText);
    
    // Добавляем поля и метки
    this.labels.forEach(label => uiElements.push(label));
    this.fields.forEach(field => uiElements.push(field));
    this.rightLabels.forEach(label => uiElements.push(label));
    this.rightFields.forEach(field => uiElements.push(field));
    
    // Добавляем лампы
    this.lamps.forEach(lamp => {
      uiElements.push(lamp.sprite);
      if (lamp.text) uiElements.push(lamp.text);
    });
    
    // Добавляем информационную панель
    if (this.infoPanelHeader) uiElements.push(this.infoPanelHeader);
    if (this.infoPanelText) uiElements.push(this.infoPanelText);
    if (this.infoPanelFooter) uiElements.push(this.infoPanelFooter);
    
    return uiElements;
  }
} 