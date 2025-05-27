import Phaser from 'phaser';

/**
 * Класс Препятствие
 * имеет виртуальные размеры для быстрой проверки попадания
 */
export class Obstruction extends Phaser.GameObjects.Sprite {
  // Позиция и размеры препятствия в игровых координатах
  private position: Phaser.Math.Vector2;
  private _width: number;
  private _height: number;
  
  // scene должно быть protected, т.к. в базовом классе оно public
  protected sceneRef: Phaser.Scene;
  
  // Флаг инициализации
  private initialized: boolean = false;
  
  /**
   * Конструктор
   * @param scene Сцена, на которой размещается препятствие
   */
  constructor(scene: Phaser.Scene) {
    // Создаем простую текстуру для спрайта на месте, если она еще не существует
    if (!scene.textures.exists('obstacle')) {
      const graphics = scene.add.graphics();
      graphics.fillStyle(0xFF0000, 0.0); // Прозрачный цвет
      graphics.fillRect(0, 0, 1, 1);
      graphics.generateTexture('obstacle', 1, 1);
      graphics.destroy();
    }
    
    // Вызываем конструктор базового класса
    super(scene, 0, 0, 'obstacle');
    
    // Инициализируем свойства
    this.sceneRef = scene;
    this.position = new Phaser.Math.Vector2(0, 0);
    this._width = 0;
    this._height = 0;
    
    // Отмечаем, что инициализация завершена
    this.initialized = true;
    
    // Добавляем объект в сцену (но безопасно через метод)
    this.addToScene();
    
    // Делаем объект невидимым (он будет использоваться только для коллизий)
    this.setVisible(false);
  }
  
  /**
   * Добавляет объект в сцену
   */
  private addToScene(): void {
    try {
      // Используем явное приведение типа к любому GameObjectFactory
      (this.sceneRef.add as Phaser.GameObjects.GameObjectFactory).existing(this as any);
    } catch (e) {
      console.error('Ошибка при добавлении объекта на сцену:', e);
    }
  }
  
  /**
   * Переопределяем метод setPosition для совместимости с базовым классом
   */
  public setPosition(x?: number, y?: number, z?: number, w?: number): this {
    // Проверяем, инициализированы ли свойства
    if (this.initialized && this.position) {
      if (x !== undefined) this.position.x = x;
      if (y !== undefined) this.position.y = y;
    }
    
    // Вызываем родительский метод
    return super.setPosition(x || 0, y || 0, z, w);
  }
  
  /**
   * Устанавливает позицию и размеры препятствия
   * @param x Координата X
   * @param y Координата Y
   * @param width Ширина
   * @param height Высота
   */
  public setPositionAndSize(x: number, y: number, width: number, height: number): this {
    this.position.x = x;
    this.position.y = y;
    this._width = width;
    this._height = height;
    
    // Вызываем базовый метод setPosition
    this.setPosition(x, y);
    
    // Устанавливаем размеры
    this.setDisplaySize(width, height);
    
    return this;
  }
  
  /**
   * Обновляет отображение препятствия при изменении масштаба
   * @param zoom Текущий масштаб
   */
  public updateZoom(zoom: number): void {
    // Преобразуем в экранные координаты с учетом масштаба
    const screenX = this.position.x; // Преобразование с учетом zoom
    const screenY = this.position.y; // Преобразование с учетом zoom
    
    this.setPosition(screenX, screenY);
    
    // Применяем масштаб к размерам
    let displayWidth = zoom * this._width;
    let displayHeight = zoom * this._height;
    
    // Минимальный размер для видимости
    if (displayWidth < 1) displayWidth = 1;
    if (displayHeight < 1) displayHeight = 1;
    
    this.setDisplaySize(displayWidth, displayHeight);
  }
  
  /**
   * Проверяет столкновение с точкой
   * @param x Координата X
   * @param y Координата Y
   * @returns true если точка внутри препятствия
   */
  public containsPoint(x: number, y: number): boolean {
    return (
      x >= this.position.x && 
      x <= this.position.x + this._width &&
      y >= this.position.y && 
      y <= this.position.y + this._height
    );
  }
  
  /**
   * Получает ширину препятствия
   */
  public getWidth(): number {
    return this._width;
  }
  
  /**
   * Получает высоту препятствия
   */
  public getHeight(): number {
    return this._height;
  }
  
  /**
   * Устанавливает размеры препятствия
   * @param width Ширина
   * @param height Высота
   */
  public setSize(width: number, height: number): this {
    this._width = width;
    this._height = height;
    this.setDisplaySize(width, height);
    return this;
  }
} 