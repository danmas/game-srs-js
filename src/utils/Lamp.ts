import Phaser from 'phaser';
import { Constants } from './Constants';

/**
 * Класс индикатора (лампы) для информационной панели
 */
export class Lamp {
  // Состояния мигания
  private static readonly ST_NOT_BLINK: number = 0;
  private static readonly ST_BLINK_ALARM: number = 1;
  private static readonly ST_BLINK_WARNING: number = 2;
  
  // Цвета состояний
  private colorOff: number = 0xFF0000; // Красный для выключенного
  private colorOn: number = 0x00FF00;  // Зеленый для включенного
  private colorNotReady: number = 0xFF0000; // Красный для не готового
  private colorReady: number = 0x00FF00;    // Зеленый для готового
  private colorActive: number = 0xFFFF00;   // Желтый для активного
  private colorAlarm: number = 0xFF0000;    // Красный для тревоги
  private colorWarning: number = 0xFFFF00;  // Желтый для предупреждения
  private colorBlinkAlarm: number = 0xFF0000;    // Красный для мигающей тревоги
  private colorBlinkWarning: number = 0xFFFF00;  // Желтый для мигающего предупреждения
  
  // Объекты отображения
  public sprite: Phaser.GameObjects.Sprite;
  public text: Phaser.GameObjects.Text | null;
  
  // Переменные для отслеживания состояния
  private timeLast: number = 0;
  private blinkState: number = Lamp.ST_NOT_BLINK;
  private currentState: boolean = false; // true = on, false = off
  
  // Публичное имя лампы
  public name: string = '';
  
  /**
   * Конструктор
   * @param name Внутреннее имя индикатора
   * @param sprite Спрайт индикатора
   * @param text Текстовый объект индикатора (опционально)
   */
  constructor(name: string, sprite: Phaser.GameObjects.Sprite, text?: Phaser.GameObjects.Text) {
    this.name = name;
    this.sprite = sprite;
    this.text = text || null;
  }
  
  /**
   * Устанавливает состояние индикатора
   * @param on Состояние включения (true/false)
   */
  public setState(on: boolean): void {
    this.currentState = on;
    
    if (on) {
      this.setOn();
    } else {
      this.setOff();
    }
  }
  
  /**
   * Переключает состояние индикатора между тревогой и предупреждением
   * @param time Текущее время
   */
  public blinkAlarmWarning(time: number): void {
    if ((time - this.timeLast) > 300) { // 0.3 секунды в миллисекундах
      if (this.blinkState === Lamp.ST_BLINK_ALARM) {
        this.sprite.setTint(this.colorBlinkWarning);
        if (this.text) this.text.setColor('#' + this.colorBlinkWarning.toString(16).padStart(6, '0'));
        this.blinkState = Lamp.ST_BLINK_WARNING;
      } else if (this.blinkState === Lamp.ST_BLINK_WARNING) {
        this.sprite.setTint(this.colorBlinkAlarm);
        if (this.text) this.text.setColor('#' + this.colorBlinkAlarm.toString(16).padStart(6, '0'));
        this.blinkState = Lamp.ST_BLINK_ALARM;
      } else {
        this.blinkState = Lamp.ST_NOT_BLINK;
      }
      this.timeLast = time;
    }
  }
  
  /**
   * Останавливает мигание индикатора
   */
  private stopBlinkAlarmWarning(): void {
    this.blinkState = Lamp.ST_NOT_BLINK;
  }
  
  /**
   * Запускает мигание между тревогой и предупреждением
   */
  public startBlinkAlarmWarning(): void {
    if (this.blinkState !== Lamp.ST_BLINK_ALARM && this.blinkState !== Lamp.ST_BLINK_WARNING) {
      this.sprite.setTint(this.colorBlinkAlarm);
      if (this.text) this.text.setColor('#' + this.colorBlinkAlarm.toString(16).padStart(6, '0'));
      this.blinkState = Lamp.ST_BLINK_ALARM;
    }
  }
  
  /**
   * Устанавливает состояние включено/выключено
   * @param on Состояние включения
   */
  public setOnOff(on: boolean): void {
    this.stopBlinkAlarmWarning();
    this.setState(on);
  }
  
  /**
   * Устанавливает состояние тревоги
   */
  public setAlarm(): void {
    this.stopBlinkAlarmWarning();
    this.sprite.setTint(this.colorAlarm);
    if (this.text) this.text.setColor('#' + this.colorAlarm.toString(16).padStart(6, '0'));
  }
  
  /**
   * Устанавливает состояние "включено"
   */
  public setOn(): void {
    this.stopBlinkAlarmWarning();
    this.sprite.setTint(this.colorOn);
    if (this.text) this.text.setColor('#' + this.colorOn.toString(16).padStart(6, '0'));
  }
  
  /**
   * Устанавливает состояние "выключено"
   */
  public setOff(): void {
    this.stopBlinkAlarmWarning();
    this.sprite.setTint(this.colorOff);
    if (this.text) this.text.setColor('#' + this.colorOff.toString(16).padStart(6, '0'));
  }
  
  /**
   * Устанавливает состояние "готово"
   */
  public setReady(): void {
    this.stopBlinkAlarmWarning();
    this.sprite.setTint(this.colorReady);
    if (this.text) this.text.setColor('#' + this.colorReady.toString(16).padStart(6, '0'));
  }
  
  /**
   * Устанавливает состояние "не готово"
   */
  public setNotReady(): void {
    this.stopBlinkAlarmWarning();
    this.sprite.setTint(this.colorNotReady);
    if (this.text) this.text.setColor('#' + this.colorNotReady.toString(16).padStart(6, '0'));
  }
  
  /**
   * Устанавливает состояние готовности
   * @param ready Состояние готовности
   */
  public setReadyNotReady(ready: boolean): void {
    this.stopBlinkAlarmWarning();
    if (ready) {
      this.setReady();
    } else {
      this.setNotReady();
    }
  }
  
  /**
   * Устанавливает активное состояние
   */
  public setActiveState(): void {
    this.stopBlinkAlarmWarning();
    this.sprite.setTint(this.colorActive);
    if (this.text) this.text.setColor('#' + this.colorActive.toString(16).padStart(6, '0'));
  }
  
  /**
   * Уничтожает индикатор
   */
  public destroy(): void {
    this.sprite.destroy();
    if (this.text) this.text.destroy();
  }
} 