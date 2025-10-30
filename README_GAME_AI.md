# Архитектура Игрового ИИ - Silent Red Storm

## Оглавление
1. [Обзор Системы](#обзор-системы)
2. [Архитектура ИИ](#архитектура-иИ)
3. [Сенсорная Система (Обнаружение Целей)](#сенсорная-система-обнаружение-целей)
4. [Система Стратегий ИИ](#система-стратегий-ии)
5. [Алгоритмы Принятия Решений](#алгоритмы-принятия-решений)
6. [Алгоритмы Управления Оружием](#алгоритмы-управления-оружием)
7. [Алгоритмы Торпед](#алгоритмы-торпед)
8. [Система Навигации (WayPoints)](#система-навигации-waypoints)
9. [Физическая Модель](#физическая-модель)
10. [Как Подключить Новые Алгоритмы](#как-подключить-новые-алгоритмы)

---

## Обзор Системы

### Основная Философия
Игровой ИИ в Silent Red Storm построен на модульной архитектуре с двухфазным циклом принятия решений:
- **AI_step_I()** - анализ ситуации, сбор информации
- **AI_step_II()** - принятие решений и выполнение действий

### Иерархия Классов
```
Vehicle (базовый класс)
├── Ship (корабли)
│   ├── Submarine (подводные лодки)
│   └── AI Components:
│       └── AIWeaponControl (управление оружием)
└── Torpedo (торпеды)
    ├── TorpedoTypeI (прямоидущая)
    ├── TorpedoTypeII (маневрирующая)
    └── TorpedoTypeIII (самонаводящаяся)
```

### Основные Компоненты
1. **Сенсорная Система** - обнаружение целей на основе шума
2. **Система Принятия Решений** - двухфазный ИИ цикл
3. **Система Управления Оружием** - AIWeaponControl
4. **Система Навигации** - WayPoints с автоматическим руление
5. **Физическая Модель** - реалистичная инерция, шум, управление

---

## Архитектура ИИ

### Двухфазный Цикл ИИ

Игровой ИИ работает в двух фазах, вызываемых из `MainScene`:

#### Фаза 1: AI_step_I() - Анализ (Slow Loop)
**Частота:** 500ms (`Settings.SLOW_LOOP_INTERVAL_MS`)  
**Назначение:** Сбор информации, обновление состояния

**Выполняется в:**
- `Ship.AI_step_I()` - базовая логика (низкое здоровье → увеличить скорость)
- `Submarine.AI_step_I()` - дополнительная логика подлодок
- `Torpedo.AI_step_I()` - анализ для торпед

```typescript
// MainScene.ts - Slow Loop
public slowLoop(time: number, delta: number): void {
  for (const ship of this.redShips) {
    ship.AI_step_I();
  }
  for (const ship of this.whiteShips) {
    ship.AI_step_I();
  }
  // Обновление сенсоров
  this.updateAllVehicleSensors();
}
```

#### Фаза 2: AI_step_II() - Действия (Slow Loop)
**Частота:** 500ms  
**Назначение:** Принятие решений, атака, управление

**Выполняется в:**
- `Ship.AI_step_II()` - управление через систему стратегий (`aiStrategy.actionStep()`) или через `AIWeaponControl.evaluateAndFire()` для обратной совместимости
- `Submarine.AI_step_II()` - специфичные действия подлодок
- `Torpedo.AI_step_II()` - самонаведение для Type III

```typescript
// Ship.ts - AI_step_II
public AI_step_II(): void {
  if (!this.active || this.underControl) return;
  
  // Вызываем базовую реализацию, которая использует aiStrategy
  super.AI_step_II(); // Делегирует выполнение aiStrategy.actionStep()
  
  // Для обратной совместимости: если нет стратегии, используем старую логику
  if (!this.aiStrategy) {
    if (!this.isConvoyShip && this.aiWeaponControl) {
      this.aiWeaponControl.evaluateAndFire(); // Оценка и атака
    }
  }
  
  // Управление движением по WayPoints
  if (this.hasWayPoints() && !this.isMovingOnWayPoint) {
    // this.startMoveOnWP();
  }
}
```

**Примечание:** Современная система использует **систему стратегий** (`AIStrategy`). `AIWeaponControl` используется только для обратной совместимости. Подробнее см. `README_AI_STRATEGIES.md`.

### Состояния ИИ (moveState)

Каждый `Vehicle` имеет состояние `moveState`:

```typescript
// Vehicle.ts
static readonly ST_MOVE_UNKNOWN: number = 0;          // Неопределенное
static readonly ST_WP_MOVING: number = 1;             // Движение по WayPoints
static readonly ST_COMMAND_MOVING: number = 2;        // Движение по команде
static readonly ST_WP_SEARCH_TARGET: number = 3;      // Поиск цели
static readonly ST_WP_TORP_DEFENCE_MOVING: number = 4;// Маневр уклонения
static readonly ST_WP_FINISHED: number = 5;           // Маршрут завершен
static readonly ST_WP_CONVOY_MOVING: number = 6;      // Движение в конвое
```

**Применение:**
- `ST_WP_SEARCH_TARGET` - корабль патрулирует область в поисках целей
- `ST_WP_TORP_DEFENCE_MOVING` - маневр уклонения от торпеды
- `ST_WP_CONVOY_MOVING` - движение по заданному маршруту конвоя

---

## Сенсорная Система (Обнаружение Целей)

### Принцип Работы

Обнаружение целей основано на **модели шума**:
1. Каждый объект производит шум (зависит от мощности двигателя)
2. Шум распространяется по закону обратных квадратов расстояния
3. Другие корабли "слышат" шум и определяют степень обнаружения

### Формула Расчета Шума

```typescript
// Vehicle.ts - getSourceNoiseLevel()
// Базовая формула (упрощенная для понимания):
sourceNoise = (3 * intrinsicNoisiness * 1000000 * finalNoiseFactor) / 36
receivedNoise = sourceNoise / (distance * distance)
```

**Параметры:**
- `intrinsicNoisiness` - базовая шумность (1.0 для Vehicle, 1.5 для Ship)
- `powerFactor` - базовый фактор мощности:
  - `POWER_0`: 0.05
  - `POWER_1`: 0.2
  - `POWER_2`: 1.0
  - `POWER_3`: 3.0
  - `POWER_4`: 4.0
  - `POWER_5`: 5.0
  - `POWER_6`: 6.0

**Важно:** Реальная формула учитывает **соотношение текущей скорости к максимальной** для данной мощности:

```typescript
// Реальная реализация учитывает скорость:
speedRatio = currentSpeed / maxSpeedForCurrentPower
scaledPowerFactor = powerFactor * speedRatio
finalNoiseFactor = Math.max(scaledPowerFactor, 0.05) // Минимум 0.05

// Если корабль движется медленнее максимума для своей мощности,
// его шум пропорционально уменьшается
```

**Примеры:**
- Корабль на `POWER_4` (maxSpeed = 20), но движется со скоростью 10 → шум будет 50% от максимального для POWER_4
- Корабль только что получил команду `POWER_4`, но еще разгоняется → шум постепенно увеличивается с ростом скорости

**Модификаторы для подводных лодок:**
```typescript
// Submarine.ts - getNoiseStrength()
depthFactor = 1 - (depth / maxDepth) * 0.7  // Глубже = тише
periscopeFactor = periscope ? 1.0 : 0.8     // Перископ опущен = тише

finalNoise = sourceNoise * depthFactor * periscopeFactor
```

### Зоны Обнаружения

Система использует 3 зоны обнаружения + состояние "нет контакта":

```typescript
// DetectionState.ts
enum DetectionState {
  NO_CONTACT,           // Шум < 0.2
  ZONE_1_UNCERTAIN,     // Шум >= 0.2 (примерное направление)
  ZONE_2_LOCALIZED,     // Шум >= 0.5 (точные координаты)
  ZONE_3_IDENTIFIED     // Шум >= 0.8 (полная информация)
}
```

**Пороги:**
```typescript
// Settings.ts
NOISE_THRESHOLD_ZONE_1_UNCERTAIN: 0.2
NOISE_THRESHOLD_ZONE_2_LOCALIZED: 0.5
NOISE_THRESHOLD_ZONE_3_IDENTIFIED: 0.8
```

### Визуальные Эффекты по Зонам

**Зона 1 (Неопределенный Контакт):**
- Позиция "прыгает" каждые 1000ms (`ZONE_1_PING_INTERVAL_MS`)
- Смещение: ±150 единиц (`ZONE_1_DISPLACEMENT_DELTA_LOGICAL`)
- Цель показывается с низкой точностью

**Зона 2 (Локализованный Контакт):**
- Точная позиция цели
- Видны курс и скорость
- Возможна атака

**Зона 3 (Идентифицирована):**
- Полная информация
- Тип корабля, здоровье
- Оптимальная дистанция для атаки

### Алгоритм Обновления Сенсоров

```typescript
// Vehicle.ts - updateSensors()
public updateSensors(allVehicles: Vehicle[], gameTime: number, informer: Informer | null): void {
  for (const otherVehicle of allVehicles) {
    // Игнорируем союзников и себя
    if (otherVehicle === this || otherVehicle.getForces() === this.getForces()) continue;
    
    // Рассчитываем принимаемый шум
    const receivedNoise = PhysicsUtils.getReceivedNoiseLevel(otherVehicle, this.getPosition());
    
    // Определяем зону обнаружения
    let newDetectionState = DetectionState.NO_CONTACT;
    if (receivedNoise >= Settings.NOISE_THRESHOLD_ZONE_3_IDENTIFIED) {
      newDetectionState = DetectionState.ZONE_3_IDENTIFIED;
    } else if (receivedNoise >= Settings.NOISE_THRESHOLD_ZONE_2_LOCALIZED) {
      newDetectionState = DetectionState.ZONE_2_LOCALIZED;
    } else if (receivedNoise >= Settings.NOISE_THRESHOLD_ZONE_1_UNCERTAIN) {
      newDetectionState = DetectionState.ZONE_1_UNCERTAIN;
    }
    
    // Обновляем данные о цели
    this.perceivedTargets.set(otherVehicle.id, {
      targetVehicle: otherVehicle,
      detectionState: newDetectionState,
      // ... другие данные
    });
  }
}
```

### Структура Данных Обнаруженной Цели

```typescript
// PerceivedTargetInfo.ts
interface PerceivedTargetInfo {
  targetVehicle: Vehicle;                     // Объект цели
  detectionState: DetectionState;             // Текущая зона
  previousDetectionState: DetectionState;     // Предыдущая зона
  lastZone1PingTime: number;                  // Для "прыжков" в Зоне 1
  displayPositionLogical: Phaser.Math.Vector2; // Отображаемая позиция
}
```

**Каждый корабль хранит Map обнаруженных целей:**
```typescript
// Vehicle.ts
public perceivedTargets: Map<number, PerceivedTargetInfo>;
```

---

## Система Стратегий ИИ

### Обзор

Современная система использует паттерн **"Стратегия"** для управления поведением ИИ. Каждый `Vehicle` может иметь назначенную стратегию (`aiStrategy`), которая реализует логику принятия решений.

**Файлы:**
- `src/ai/strategies/AIStrategy.ts` - интерфейс стратегии
- `src/ai/strategies/BaseAIStrategy.ts` - базовый класс
- `src/ai/strategies/AIStrategyFactory.ts` - фабрика стратегий
- `src/ai/strategies/DefaultShipStrategy.ts` - стандартная стратегия корабля
- `src/ai/strategies/AggressiveShipStrategy.ts` - агрессивная стратегия

### Интеграция с Двухфазным Циклом

```typescript
// Vehicle.ts - AI_step_I()
public AI_step_I(): void {
  if (!this.active || !this.aiStrategy) return;
  
  const context: AIWorldContext = {
    perceivedTargets: this.perceivedTargets,
    scene: this.scene as MainScene,
    gameTime: this.scene.time.now
  };
  
  // Делегируем управление стратегии
  this.aiStrategy.analyzeStep(this, context);
}

// Vehicle.ts - AI_step_II()
public AI_step_II(): void {
  if (!this.active || !this.aiStrategy) return;
  
  const context: AIWorldContext = {
    perceivedTargets: this.perceivedTargets,
    scene: this.scene as MainScene,
    gameTime: this.scene.time.now
  };
  
  // Делегируем управление стратегии
  this.aiStrategy.actionStep(this, context);
}
```

### Назначение Стратегий

```typescript
// Ship.ts - конструктор
if (!this.underControl) {
  // Назначаем стратегию ИИ по умолчанию
  this.aiStrategy = AIStrategyFactory.getDefaultStrategy(this, scene as MainScene);
}

// Динамическая замена стратегии
AIStrategyFactory.assignStrategy('aggressive_ship', ship, scene);
```

**Доступные стратегии:**
- `default_ship` - стандартная боевая стратегия
- `aggressive_ship` - агрессивное преследование
- `homing_torpedo` - стратегия самонаводящейся торпеды

**Подробнее:** См. полную документацию в `README_AI_STRATEGIES.md`.

---

## Алгоритмы Принятия Решений

### AIWeaponControl - Управление Оружием (Legacy)

**Файл:** `src/ai/AIWeaponControl.ts`

**⚠️ ВАЖНО:** `AIWeaponControl` используется только для **обратной совместимости**. Современная система использует **систему стратегий** (`AIStrategy`). Подробнее см. раздел [Система Стратегий ИИ](#система-стратегий-ии) и `README_AI_STRATEGIES.md`.

Этот компонент все еще присутствует в коде, но новые корабли получают стратегию через `AIStrategyFactory.getDefaultStrategy()`.

#### Алгоритм Оценки и Атаки

```typescript
// AIWeaponControl.ts - evaluateAndFire()
public evaluateAndFire(): void {
  if (!this.owner || !this.owner.active) return;
  
  let targetCandidate: Vehicle | null = null;
  
  // 1. Поиск цели среди обнаруженных
  for (const perceivedInfo of this.owner.perceivedTargets.values()) {
    // Условия выбора цели:
    if (perceivedInfo.targetVehicle.active &&                           // Цель жива
        perceivedInfo.targetVehicle.getForces() !== this.owner.getForces() && // Враг
        (perceivedInfo.detectionState === DetectionState.ZONE_2_LOCALIZED ||   // Зона 2+
         perceivedInfo.detectionState === DetectionState.ZONE_3_IDENTIFIED)) {
      
      // Приоритет: корабли (Ship)
      if (perceivedInfo.targetVehicle instanceof Ship) {
        targetCandidate = perceivedInfo.targetVehicle;
        break; // Первый найденный корабль
      }
    }
  }
  
  if (!targetCandidate) return; // Нет подходящих целей
  
  const target: Ship = targetCandidate as Ship;
  
  // 2. Проверка условий атаки
  const weaponReady = this.owner.isWeaponReady(Constants.WEAPON_SELECT_TORP_I);
  const targetTruePosition = target.getTruePositionBeforeSensorEffects();
  const distanceToTarget = Phaser.Math.Distance.Between(
    this.owner.x, this.owner.y,
    targetTruePosition.x, targetTruePosition.y
  );
  const angleToTargetRad = Phaser.Math.Angle.Between(
    this.owner.x, this.owner.y,
    targetTruePosition.x, targetTruePosition.y
  );
  let angleToTargetDeg = (Phaser.Math.RadToDeg(angleToTargetRad) + 90 + 360) % 360;
  const diffAngle = Phaser.Math.Angle.ShortestBetween(this.owner.getDirection(), angleToTargetDeg);
  
  const distanceOk = distanceToTarget < Settings.TRP_I_DIST_EXECUTION; // < 1000
  const angleOk = Math.abs(diffAngle) < Settings.TRP_ATACK__ANGLE_WARNING; // < 180°
  
  // 3. Стрельба при выполнении всех условий
  if (weaponReady && distanceOk && angleOk) {
    console.log(`AI Ship ${this.owner.id}: FIRE Torpedo I at Target ${target.id}`);
    this.mainScene.fireTorpedo(
      this.owner,
      Constants.WEAPON_SELECT_TORP_I,
      targetTruePosition.x,
      targetTruePosition.y
    );
  }
}
```

#### Параметры Атаки

```typescript
// Settings.ts
TRP_I_DIST_EXECUTION: 1000        // Макс. дистанция атаки
TRP_ATACK__ANGLE_WARNING: 180     // Допустимый угол атаки (любой)
```

### Логика Выбора Цели

**Приоритеты:**
1. **Активная цель** (`active === true`)
2. **Враг** (другая сторона)
3. **Обнаружена** (Зона 2 или Зона 3)
4. **Тип: Ship** (приоритет перед Torpedo)

**Стратегия:**
- Выбирается **первая** найденная подходящая цель
- Нет оценки по расстоянию или опасности
- Простая, но эффективная логика

### Реакция на Опасность

```typescript
// Ship.ts - AI_step_I()
public AI_step_I(): void {
  // Вызываем базовую реализацию, которая использует aiStrategy
  super.AI_step_I(); // Делегирует выполнение aiStrategy.analyzeStep()
  
  // Для обратной совместимости: если нет стратегии, используем старую логику
  if (!this.aiStrategy) {
    // Если здоровье низкое, пытаемся уйти
    if (this.health < 200 && this.power < Vehicle.POWER_4) {
      this.setPower(Vehicle.POWER_4); // Увеличить скорость
    }
  }
}
```

**Примечание:** В современной системе эта логика реализована в стратегиях (например, `DefaultShipStrategy`). Данный код используется только для обратной совместимости.

---

## Алгоритмы Управления Оружием

### Проверка Готовности Оружия

```typescript
// Ship.ts - isWeaponReady()
public isWeaponReady(weaponType: number): boolean {
  switch (weaponType) {
    case Constants.WEAPON_SELECT_TORP_I:
      return this.torpedoOnBoardI > 0 && this.reloadTimeTorp1 <= 0;
    
    case Constants.WEAPON_SELECT_TORP_II:
      return this.torpedoOnBoardII > 0 && this.reloadTimeTorp2 <= 0;
    
    case Constants.WEAPON_SELECT_TORP_III:
      return this.torpedoOnBoardIII > 0 && this.reloadTimeTorp3 <= 0;
    
    default:
      return false;
  }
}
```

### Запуск Торпеды

**Процесс:**
1. Проверка готовности оружия
2. Уменьшение количества торпед
3. Установка времени перезарядки
4. Создание торпеды с параметрами

```typescript
// Ship.ts - decrementTorpCount()
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
    // ... аналогично для других типов
  }
}
```

### Параметры Торпед

```typescript
// Ship.ts - initTorpedoParams()
protected initTorpedoParams(): void {
  this.torpedoParamsI = {
    maxVelocity: Settings.TRP_I_MAX_VELOCITY,      // 60
    lifeTimeSec: Settings.TRP_I_LIFE_TIME_SEC,     // 60
    maneuvering: Settings.TRP_I_MANEVR_PRC,        // 80
    reloadTimeSec: Settings.TRP_I_TIME_RELOAD_SEC, // 2
    damage: Settings.TRP_I_DAMEGE,                 // 1000
    executionDist: Settings.TRP_I_DIST_EXECUTION   // 1000
  };
  
  // ... аналогично для Type II и Type III
}
```

---

## Алгоритмы Торпед

### Тип I - Прямоидущая Торпеда

**Файл:** `src/objects/TorpedoTypeI.ts`

**Стратегия:**
- Для игрока: движется к указанной точке, затем прямо
- Для ИИ: движется прямо по курсу запуска

```typescript
// TorpedoTypeI.ts
public AI_step_I(): void {
  // Торпеда движется прямо без наведения
}

public AI_step_II(): void {
  // Нет изменений в направлении
}

protected override onWayPointReached(pointType: number, isLastPoint: boolean): void {
  if (pointType === Constants.WP_TYPE_TORPEDO_TARGET) {
    this.hasReachedPlayerTargetPoint = true;
    this.clearWayPoints();
    this.moveState = Vehicle.ST_COMMAND_MOVING; // Прямо
    this.setRudder(Vehicle.RUDER_0);
    this.isMovingOnWayPoint = false;
  }
}
```

**Параметры:**
```typescript
// Settings.ts
TRP_I_MAX_VELOCITY: 60        // Самая быстрая
TRP_I_LIFE_TIME_SEC: 60       // Время жизни
TRP_I_DAMEGE: 1000            // Максимальный урон
TRP_I_MANEVR_PRC: 80          // Маневренность
```

### Тип II - Маневрирующая Торпеда

**Файл:** `src/objects/TorpedoTypeII.ts`

**Стратегия:**
- Может следовать по путевым точкам (WayPoints)
- Игрок задает маршрут, торпеда его выполняет

```typescript
// TorpedoTypeII.ts
public AI_step_I(): void {
  // Логика движения по WayPoints в Vehicle.updateMoveOnWayPoint()
  if (this.moveState === Vehicle.ST_WP_MOVING && 
      this.hasWayPoints() && 
      !this.isMovingOnWayPoint) {
    this.startMoveOnWP(); // Запуск движения по маршруту
  }
  
  if (this.isMovingOnWayPoint && this.getPower() < Vehicle.POWER_6) {
    this.setPower(Vehicle.POWER_6); // Полная мощность
  }
}

public AI_step_II(): void {
  // Проверка достижения точек в базовом Vehicle
}
```

**Параметры:**
```typescript
// Settings.ts
TRP_II_MAX_VELOCITY: 50       // Средняя скорость
TRP_II_LIFE_TIME_SEC: 60      // Время жизни
TRP_II_DAMEGE: 800            // Средний урон
TRP_II_MANEVR_PRC: 80         // Маневренность
```

**Преимущества:**
- Обход препятствий
- Атака с неожиданного направления
- Гибкость маршрута

### Тип III - Самонаводящаяся Торпеда

**Файл:** `src/objects/TorpedoTypeIII.ts`

**Стратегия:**
- Активный поиск целей по шуму
- Самонаведение на ближайшую громкую цель

#### Алгоритм Самонаведения

```typescript
// TorpedoTypeIII.ts - AI_step_II()
public AI_step_II(): void {
  if (!this.active || this.moveState === Vehicle.ST_WP_MOVING) return;
  
  let closestEnemy: Ship | null = null;
  let minDistance = Infinity;
  
  const enemyShips = this.getForces() === Constants.FORCES_WHITE 
    ? mainScene.getRedShips() 
    : mainScene.getWhiteShips();
  
  for (const enemy of enemyShips) {
    if (!enemy.active) continue;
    
    // КЛЮЧЕВОЙ МОМЕНТ: Проверка "слышимости" цели
    const noiseReceivedByTorpedo = PhysicsUtils.getReceivedNoiseLevel(
      enemy, 
      this.getPosition()
    );
    
    // Торпеда "слышит" только если шум >= порога Зоны 1
    if (noiseReceivedByTorpedo < Settings.NOISE_THRESHOLD_ZONE_1_UNCERTAIN) {
      continue; // Цель слишком тихая
    }
    
    const distance = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
    
    // Выбор ближайшей цели в радиусе захвата
    if (distance < minDistance && distance < this.targetAcceptDist) {
      minDistance = distance;
      closestEnemy = enemy;
    }
  }
  
  if (closestEnemy) {
    // Цель найдена - движение к ней
    this.clearWayPoints();
    const targetLogicalPos = CoordUtils.phaserToLogical(closestEnemy.getPosition());
    this.addWayPoint(
      targetLogicalPos.x, 
      targetLogicalPos.y, 
      Constants.WP_TYPE_TORPEDO_TARGET
    );
    this.startMoveOnWP();
    this.moveState = Vehicle.ST_WP_MOVING;
  } else {
    // Цель потеряна - движение прямо
    if (this.moveState === Vehicle.ST_WP_MOVING) {
      this.stopMoveOnWayPoint();
    }
    if (this.getPower() === Vehicle.POWER_0) {
      this.setPower(Vehicle.POWER_4); // Продолжить поиск
    }
  }
}
```

#### Алгоритм Поиска Цели (AI_step_I)

**Примечание:** `AI_step_I()` используется для **периодического обновления цели** (каждые 3 секунды), а `AI_step_II()` выполняется **каждые 500ms** для активного самонаведения.

```typescript
// TorpedoTypeIII.ts - AI_step_I()
public AI_step_I(): void {
  this.searchTimeMs += Settings.SLOW_LOOP_INTERVAL_MS;
  
  // Обновление поиска каждые 3 секунды
  if (this.searchTimeMs >= 3000) {
    this.searchTimeMs = 0;
    
    if (!this.targetShip) {
      this.targetShip = this.findNoisestEnemyShip();
    } else {
      // Проверка дистанции до цели
      const dist = Phaser.Math.Distance.Between(
        this.position.x, this.position.y,
        this.targetShip.getPosition().x, this.targetShip.getPosition().y
      );
      
      if (dist > this.noiseDetectionRange) {
        this.targetShip = this.findNoisestEnemyShip();
      }
    }
  }
}

private findNoisestEnemyShip(): Ship | null {
  let maxNoiseShip: Ship | null = null;
  let maxNoise = 0;
  
  const enemyShips = this.getForces() === Constants.FORCES_RED 
    ? mainScene.getWhiteShips() 
    : mainScene.getRedShips();
  
  for (const ship of enemyShips) {
    const dist = Phaser.Math.Distance.Between(
      this.position.x, this.position.y,
      ship.getPosition().x, ship.getPosition().y
    );
    
    if (dist < this.noiseDetectionRange) {
      const noise = PhysicsUtils.getReceivedNoiseLevel(ship, this.getPosition());
      
      if (noise > maxNoise) {
        maxNoise = noise;
        maxNoiseShip = ship;
      }
    }
  }
  
  return maxNoiseShip;
}
```

**Примечание:** Метод `findNoisestEnemyShip()` используется параллельно с логикой `AI_step_II()`. Первый периодически обновляет целевую цель (`targetShip`), второй постоянно корректирует направление движения к ближайшей слышимой цели.

**Параметры:**
```typescript
// Settings.ts
TRP_III_MAX_VELOCITY: 38          // Медленная
TRP_III_LIFE_TIME_SEC: 30         // Короткое время жизни
TRP_III_DAMEGE: 500               // Низкий урон
TRP_III_TRG_ACCEPT_DIST: 200      // Радиус захвата цели
TRP_III_MANEVR_PRC: 80            // Маневренность
```

**Преимущества:**
- Не требует точного прицеливания
- Эффективна против шумных целей
- Адаптивна к маневрам противника

**Недостатки:**
- Низкая скорость
- Малое время жизни
- Низкий урон
- Может потерять тихую цель

---

## Система Навигации (WayPoints)

### Архитектура WayPoints

**Базовый класс:** `Vehicle`  
**Файл:** `src/objects/Vehicle.ts`

```typescript
// Vehicle.ts
export interface WayPointData {
  point: Phaser.Math.Vector2;      // Логические координаты
  type: number;                     // Тип точки (WP_TYPE_*)
  graphics?: Phaser.GameObjects.Graphics; // Визуализация
}

protected wayPoints: WayPointData[] = [];
protected currentWayPointIndex: number = -1;
public isMovingOnWayPoint: boolean = false;
protected arrivalThreshold: number = 30; // Дистанция прибытия
```

### Типы Путевых Точек

```typescript
// Constants.ts
static readonly WP_TYPE_MOVE: number = 0;           // Обычное движение
static readonly WP_TYPE_SEARCH: number = 1;         // Поиск цели
static readonly WP_TYPE_CONVOY: number = 2;         // Движение конвоя
static readonly WP_TYPE_MANEUVER: number = 3;       // Маневр уклонения
static readonly WP_TYPE_TARGET: number = 4;         // Атака цели
static readonly WP_TYPE_TORPEDO_TARGET: number = 100; // Цель торпеды игрока
```

### Добавление Путевой Точки

```typescript
// Vehicle.ts - addWayPoint()
public addWayPoint(logicalX: number, logicalY: number, type: number = Constants.WP_TYPE_MOVE): void {
  // Конвертация в Phaser координаты для физики
  const phaserPoint = new Phaser.Math.Vector2(
    CoordUtils.logicalToPhaserX(logicalX),
    CoordUtils.logicalToPhaserY(logicalY)
  );
  
  // Создание визуализации
  const wpGraphics = this.scene.add.graphics({ 
    x: phaserPoint.x, 
    y: phaserPoint.y 
  });
  wpGraphics.setDepth(Constants.DEPTH_WAYPOINT);
  
  // Стиль в зависимости от типа
  const isTorpedoWPStyle = (this.entityType === 'Torpedo') || 
                           type === Constants.WP_TYPE_TARGET || 
                           type === Constants.WP_TYPE_TORPEDO_TARGET;
  
  if (isTorpedoWPStyle) {
    // Крестик для торпед
    const size = Vehicle.TORPEDO_WP_CROSS_SIZE;
    wpGraphics.lineStyle(2, Vehicle.TORPEDO_WAY_POINT_COLOR, 1);
    wpGraphics.beginPath();
    wpGraphics.moveTo(-size, 0);
    wpGraphics.lineTo(size, 0);
    wpGraphics.moveTo(0, -size);
    wpGraphics.lineTo(0, size);
    wpGraphics.strokePath();
  } else {
    // Круг для кораблей
    const radius = Vehicle.WAY_POINT_RADIUS;
    wpGraphics.fillStyle(Vehicle.WAY_POINT_COLOR, 0.2);
    wpGraphics.fillCircle(0, 0, radius);
    wpGraphics.lineStyle(1.5, Vehicle.WAY_POINT_COLOR, 0.9);
    wpGraphics.strokeCircle(0, 0, radius);
  }
  
  // Сохранение точки (в ЛОГИЧЕСКИХ координатах)
  const newWayPoint: WayPointData = {
    point: new Phaser.Math.Vector2(logicalX, logicalY),
    type: type,
    graphics: wpGraphics
  };
  
  this.wayPoints.push(newWayPoint);
  
  // Автоматическая установка первой точки
  if (this.currentWayPointIndex === -1 && this.wayPoints.length > 0) {
    this.currentWayPointIndex = 0;
  }
  
  // Управление видимостью
  if (wpGraphics) {
    wpGraphics.setVisible(this.entityType === 'Torpedo' ? true : this.displaySelected);
  }
}
```

### Алгоритм Движения по WayPoints

```typescript
// Vehicle.ts - updateMoveOnWayPoint()
protected updateMoveOnWayPoint(delta: number): void {
  if (!this.isMovingOnWayPoint || this.currentWayPointIndex < 0) return;
  
  const currentWpData = this.wayPoints[this.currentWayPointIndex];
  const targetLogicalPos = currentWpData.point;
  
  // Конвертация в Phaser координаты для расчетов
  const targetPhaserPos = new Phaser.Math.Vector2(
    CoordUtils.logicalToPhaserX(targetLogicalPos.x),
    CoordUtils.logicalToPhaserY(targetLogicalPos.y)
  );
  
  const distanceToTarget = Phaser.Math.Distance.Between(
    this.x, this.y, 
    targetPhaserPos.x, targetPhaserPos.y
  );
  
  // Проверка достижения точки
  if (distanceToTarget <= this.arrivalThreshold) {
    const isLastPoint = this.currentWayPointIndex === this.wayPoints.length - 1;
    this.onWayPointReached(currentWpData.type, isLastPoint);
    
    if (isLastPoint) {
      this.onWayPointSequenceFinished();
      this.isMovingOnWayPoint = false;
      this.moveState = Vehicle.ST_WP_FINISHED;
      return;
    } else {
      this.currentWayPointIndex++;
    }
  }
  
  // Логика руления к текущей точке
  const angleToTargetRad = Phaser.Math.Angle.Between(
    this.x, this.y, 
    targetPhaserPos.x, targetPhaserPos.y
  );
  let angleToTargetDeg = (Phaser.Math.RadToDeg(angleToTargetRad) + 90 + 360) % 360;
  const diffAngle = Phaser.Math.Angle.ShortestBetween(this.direction, angleToTargetDeg);
  
  if (Math.abs(diffAngle) > Settings.ANGLE_PRECISION_FOR_WP) {
    // Установка руля в зависимости от угла
    if (diffAngle > 0) { // Поворот влево
      if (Math.abs(diffAngle) > 45) this.setRudder(Vehicle.RUDER_RIGHT_15);
      else if (Math.abs(diffAngle) > 20) this.setRudder(Vehicle.RUDER_RIGHT_10);
      else this.setRudder(Vehicle.RUDER_RIGHT_5);
    } else { // Поворот вправо
      if (Math.abs(diffAngle) > 45) this.setRudder(Vehicle.RUDER_LEFT_15);
      else if (Math.abs(diffAngle) > 20) this.setRudder(Vehicle.RUDER_LEFT_10);
      else this.setRudder(Vehicle.RUDER_LEFT_5);
    }
  } else {
    this.setRudder(Vehicle.RUDER_0); // Прямо
  }
}
```

### Обработчики Событий WayPoints

```typescript
// Vehicle.ts
protected onWayPointReached(pointType: number, isLastPoint: boolean): void {
  console.log(`Vehicle ${this.id} reached WP type: ${pointType}, isLast: ${isLastPoint}`);
  
  // Удаление графики достигнутой точки
  if (this.currentWayPointIndex >= 0 && 
      this.currentWayPointIndex < this.wayPoints.length) {
    const reachedWpData = this.wayPoints[this.currentWayPointIndex];
    if (reachedWpData && reachedWpData.graphics) {
      reachedWpData.graphics.destroy();
      reachedWpData.graphics = undefined;
    }
  }
  
  // Специфичная логика в зависимости от типа
  if (this.moveState === Vehicle.ST_WP_SEARCH_TARGET) {
    // Обработка точки поиска
  }
}

protected onWayPointSequenceFinished(): void {
  console.log(`${this.constructor.name} ${this.id} WP sequence finished.`);
  this.isMovingOnWayPoint = false;
  
  if (this.moveState === Vehicle.ST_WP_MOVING) {
    this.moveState = Vehicle.ST_WP_FINISHED;
  }
  this.setRudder(Vehicle.RUDER_0);
  this.clearWayPoints();
  
  // Дочерние классы могут переопределить для спец. поведения
}
```

### Применение в Ship.ts

```typescript
// Ship.ts - onWayPointReached()
protected override onWayPointReached(pointType: number, isLastPoint: boolean): void {
  super.onWayPointReached(pointType, isLastPoint);
  
  if (this.moveState === Vehicle.ST_WP_SEARCH_TARGET) {
    if (pointType === Constants.WP_TYPE_SEARCH) {
      if (isLastPoint) {
        console.log(`AI ${this.id}: Search WP sequence finished.`);
      }
    }
  } else if (this.moveState === Vehicle.ST_WP_CONVOY_MOVING) {
    if (pointType === Constants.WP_TYPE_CONVOY) {
      if (isLastPoint) {
        console.log(`AI ${this.id}: Convoy WP sequence finished.`);
      }
    }
  } else if (this.moveState === Vehicle.ST_WP_TORP_DEFENCE_MOVING) {
    if (pointType === Constants.WP_TYPE_MANEUVER) {
      if (isLastPoint) {
        console.log(`AI ${this.id}: Maneuver WP sequence finished.`);
      }
    }
  }
}

protected override onWayPointSequenceFinished(): void {
  super.onWayPointSequenceFinished();
  
  if (this.moveState === Vehicle.ST_WP_SEARCH_TARGET) {
    this.moveState = Vehicle.ST_MOVE_UNKNOWN;
    console.log(`AI ${this.id}: Search sequence complete. Resetting AI state.`);
  } else if (this.moveState === Vehicle.ST_WP_CONVOY_MOVING) {
    this.setPower(Vehicle.POWER_0);
    this.moveState = Vehicle.ST_MOVE_UNKNOWN;
    console.log(`AI ${this.id}: Convoy sequence complete.`);
  } else if (this.moveState === Vehicle.ST_WP_TORP_DEFENCE_MOVING) {
    this.moveState = Vehicle.ST_MOVE_UNKNOWN;
    console.log(`AI ${this.id}: Maneuver sequence complete.`);
  }
}
```

---

## Физическая Модель

### Система Управления

**Уровни Мощности:**
```typescript
// Vehicle.ts
static readonly POWER_0: number = 0;  // Стоп
static readonly POWER_1: number = 1;  // Самый тихий ход
static readonly POWER_2: number = 2;  // Медленный ход
static readonly POWER_3: number = 3;  // Средний ход
static readonly POWER_4: number = 4;  // Полный ход
static readonly POWER_5: number = 5;  // Форсаж 1
static readonly POWER_6: number = 6;  // Форсаж 2
```

**Положения Руля:**
```typescript
// Vehicle.ts
static readonly RUDER_RIGHT_15: number = -3;  // Вправо 15°
static readonly RUDER_RIGHT_10: number = -2;  // Вправо 10°
static readonly RUDER_RIGHT_5: number = -1;   // Вправо 5°
static readonly RUDER_0: number = 0;          // Прямо
static readonly RUDER_LEFT_5: number = 1;     // Влево 5°
static readonly RUDER_LEFT_10: number = 2;    // Влево 10°
static readonly RUDER_LEFT_15: number = 3;    // Влево 15°
```

### Физика Движения

```typescript
// Vehicle.ts - updatePhysics()
protected updatePhysics(delta: number): void {
  const deltaSeconds = delta / 1000;
  
  // 1. Обновление направления от руля
  if (this.rudder !== Vehicle.RUDER_0) {
    const turnFactor = this.rudder * this.getAlphaR() * this.velocity.length();
    this.direction -= delta * turnFactor;
    this.direction = (this.direction + 360) % 360;
    this.directionTarget = this.direction;
  }
  
  // 2. Обновление скорости с инерцией
  const targetSpeed = this.power * this.maxVelocity / Vehicle.POWER_6;
  let currentSpeed = this.velocity.length();
  const inertiaFactor = Settings.alfa_v * 1000; // 0.0005 * 1000 = 0.5
  
  if (Math.abs(currentSpeed - targetSpeed) > 0.01) {
    const speedChange = (targetSpeed - currentSpeed) * inertiaFactor * deltaSeconds;
    currentSpeed = Math.max(0, currentSpeed + speedChange);
  } else if (targetSpeed > 0 && currentSpeed < targetSpeed) {
    currentSpeed = targetSpeed;
  }
  
  if (currentSpeed < 0.01 && targetSpeed > 0.01) {
    currentSpeed = targetSpeed * 0.1; // Начальный импульс
  }
  
  // 3. Установка вектора скорости
  if (currentSpeed > 0) {
    this.velocity.setTo(0, -currentSpeed);        // Вверх (0°)
    this.velocity.rotate(Phaser.Math.DegToRad(this.direction)); // Поворот
  } else {
    this.velocity.setTo(0, 0);
  }
  
  // 4. Обновление позиции
  this.position.x += this.velocity.x * deltaSeconds;
  this.position.y += this.velocity.y * deltaSeconds;
  
  // 5. Сохранение истинной позиции
  this.truePhaserPosition.set(this.position.x, this.position.y);
}
```

### Коэффициенты Поворота

```typescript
// Vehicle.ts - getAlphaR()
protected getAlphaR(): number {
  const vel = this.velocity.length();
  const ar = (Settings.alfa_r_30 - Settings.alfa_r_0) / 
             (100 * Settings.koef_v) * vel + Settings.alfa_r_0;
  
  // Учет маневренности (100% для торпед, 70% для кораблей)
  return ar * this.manevr_prc / 100;
}
```

**Параметры:**
```typescript
// Settings.ts
koef_v: 30              // Базовый коэффициент скорости
alfa_v: 0.0005          // Инерция скорости
alfa_r_0: 0.002         // Поворот на минимальной скорости
alfa_r_30: 0.005        // Поворот на максимальной скорости
```

### Маневренность

```typescript
// Vehicle.ts
protected manevr_prc: number = 100;  // 100% по умолчанию

// Ship.ts
this.manevr_prc = 70;  // Корабли менее маневренны

// Torpedo.ts
this.manevr_prc = 80;  // Торпеды маневреннее кораблей
```

### Инерция

**Ускорение:**
```typescript
speedChange = (targetSpeed - currentSpeed) * 0.5 * deltaSeconds
```

**Торможение:**
- При POWER_0 корабль постепенно замедляется
- Не мгновенная остановка
- Реалистичное поведение

---

## Как Подключить Новые Алгоритмы

### 1. Новый Тип Торпеды

**Шаг 1:** Создать класс, наследующий `Torpedo`

```typescript
// src/objects/TorpedoTypeIV.ts
import { Torpedo } from './Torpedo';
import { TorpedoParams } from './TorpedoParams';
import { Constants } from '../utils/Constants';

export class TorpedoTypeIV extends Torpedo {
  // Специфичные свойства
  private customProperty: number = 0;
  
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    angle: number,
    params: TorpedoParams,
    forces: number = Constants.FORCES_WHITE
  ) {
    super(scene, x, y, angle, params, forces);
    this.weaponType = Constants.WEAPON_SELECT_TORP_IV;
  }
  
  // Переопределить AI методы
  public AI_step_I(): void {
    // Ваша логика анализа
  }
  
  public AI_step_II(): void {
    // Ваша логика действий
  }
  
  // Переопределить отрисовку
  protected drawVehicle(): void {
    // Ваша визуализация
  }
}
```

**Шаг 2:** Добавить константу в `Constants.ts`

```typescript
// Constants.ts
static readonly WEAPON_SELECT_TORP_IV: number = 4;
```

**Шаг 3:** Добавить параметры в `Settings.ts`

```typescript
// Settings.ts
static readonly TRP_IV_LIFE_TIME_SEC: number = 45;
static readonly TRP_IV_MAX_VELOCITY: number = 55;
static readonly TRP_IV_MANEVR_PRC: number = 90;
static readonly TRP_IV_TIME_RELOAD_SEC: number = 3;
static readonly TRP_IV_DAMEGE: number = 700;
static readonly TRP_IV_DIST_EXECUTION: number = 800;
```

**Шаг 4:** Добавить инициализацию в `Ship.ts`

```typescript
// Ship.ts - initTorpedoParams()
protected torpedoParamsIV: TorpedoParams | null = null;
protected torpedoOnBoardIV: number = 5;
protected reloadTimeTorp4: number = 0;

protected initTorpedoParams(): void {
  // ... существующие параметры ...
  
  this.torpedoParamsIV = {
    maxVelocity: Settings.TRP_IV_MAX_VELOCITY,
    lifeTimeSec: Settings.TRP_IV_LIFE_TIME_SEC,
    maneuvering: Settings.TRP_IV_MANEVR_PRC,
    reloadTimeSec: Settings.TRP_IV_TIME_RELOAD_SEC,
    damage: Settings.TRP_IV_DAMEGE,
    executionDist: Settings.TRP_IV_DIST_EXECUTION
  };
}
```

**Шаг 5:** Добавить создание в `MainScene.ts`

```typescript
// MainScene.ts - _spawnAndRegisterTorpedo()
case Constants.WEAPON_SELECT_TORP_IV:
  torpedo = new TorpedoTypeIV(
    this,
    launcherPhaserX,
    launcherPhaserY,
    launcher.getDirection(),
    torpedoParams,
    launcher.getForces()
  );
  break;
```

### 2. Новый Компонент ИИ для Кораблей

**Пример:** Система уклонения от торпед

```typescript
// src/ai/AITorpedoDefence.ts
import { Ship } from '../objects/Ship';
import { Torpedo } from '../objects/Torpedo';
import { MainScene } from '../scenes/MainScene';
import { Constants } from '../utils/Constants';
import { Settings } from '../utils/Settings';
import { Vehicle } from '../objects/Vehicle';

export class AITorpedoDefence {
  private owner: Ship;
  private mainScene: MainScene;
  
  constructor(owner: Ship, scene: MainScene) {
    this.owner = owner;
    this.mainScene = scene;
  }
  
  /**
   * Проверяет угрозу от торпед и выполняет маневр уклонения
   */
  public evaluateAndEvade(): void {
    if (!this.owner || !this.owner.active) return;
    
    // Получить все вражеские торпеды
    const enemyTorpedos: Torpedo[] = this.owner.getForces() === Constants.FORCES_RED
      ? this.mainScene.getWhiteTorpedos()
      : this.mainScene.getRedTorpedos();
    
    let closestThreat: Torpedo | null = null;
    let minDistance = Infinity;
    
    for (const torpedo of enemyTorpedos) {
      if (!torpedo.active) continue;
      
      const distance = Phaser.Math.Distance.Between(
        this.owner.x, this.owner.y,
        torpedo.x, torpedo.y
      );
      
      // Проверка угрозы
      if (distance < Settings.TRP_ATACK_ALARM_DIST) {
        const angleToTorpedo = Phaser.Math.Angle.Between(
          this.owner.x, this.owner.y,
          torpedo.x, torpedo.y
        );
        const torpedoAngle = torpedo.getDirection();
        const angleDiff = Math.abs(Phaser.Math.Angle.ShortestBetween(
          torpedoAngle,
          (Phaser.Math.RadToDeg(angleToTorpedo) + 180) % 360
        ));
        
        // Торпеда движется на нас
        if (angleDiff < Settings.TRP_ATACK_DEFENSE_ANGLE) {
          if (distance < minDistance) {
            minDistance = distance;
            closestThreat = torpedo;
          }
        }
      }
    }
    
    // Если есть угроза - маневр
    if (closestThreat) {
      this.performEvasiveManeuver(closestThreat);
    }
  }
  
  /**
   * Выполняет маневр уклонения
   */
  private performEvasiveManeuver(threat: Torpedo): void {
    console.log(`AI Ship ${this.owner.id}: EVADING torpedo ${threat.id}`);
    
    // Рассчитать направление уклонения (перпендикулярно торпеде)
    const angleToThreat = Phaser.Math.Angle.Between(
      this.owner.x, this.owner.y,
      threat.x, threat.y
    );
    let evasionAngle = (Phaser.Math.RadToDeg(angleToThreat) + 90) % 360;
    
    // Создать точку маневра
    const evasionDistance = 300;
    const evasionX = this.owner.x + evasionDistance * Math.cos(Phaser.Math.DegToRad(evasionAngle));
    const evasionY = this.owner.y + evasionDistance * Math.sin(Phaser.Math.DegToRad(evasionAngle));
    
    const logicalPoint = CoordUtils.phaserToLogical({ x: evasionX, y: evasionY });
    
    // Установить маневр
    this.owner.clearWayPoints();
    this.owner.addWayPoint(logicalPoint.x, logicalPoint.y, Constants.WP_TYPE_MANEUVER);
    this.owner.startMoveOnWP();
    this.owner.setPower(Vehicle.POWER_6); // Полный ход
    this.owner['moveState'] = Vehicle.ST_WP_TORP_DEFENCE_MOVING;
  }
}
```

**Использование в Ship.ts:**

```typescript
// Ship.ts
import { AITorpedoDefence } from '../ai/AITorpedoDefence';

export class Ship extends Vehicle {
  private aiTorpedoDefence: AITorpedoDefence | null = null;
  
  constructor(scene: Phaser.Scene, x: number, y: number, forces: number) {
    super(scene, x, y);
    
    if (!this.underControl) {
      this.aiWeaponControl = new AIWeaponControl(this, scene as MainScene);
      this.aiTorpedoDefence = new AITorpedoDefence(this, scene as MainScene);
    }
  }
  
  public AI_step_II(): void {
    if (!this.active || this.underControl) return;
    
    // Проверка угрозы от торпед
    if (this.aiTorpedoDefence) {
      this.aiTorpedoDefence.evaluateAndEvade();
    }
    
    // Атака
    if (!this.isConvoyShip && this.aiWeaponControl) {
      this.aiWeaponControl.evaluateAndFire();
    }
  }
}
```

### 3. Новая Система Обнаружения

**Пример:** Визуальное обнаружение (дополнение к шуму)

```typescript
// src/utils/VisualDetection.ts
import { Vehicle } from '../objects/Vehicle';
import { Settings } from './Settings';

export class VisualDetection {
  /**
   * Проверяет визуальное обнаружение цели
   * @param observer Наблюдатель
   * @param target Цель
   * @returns true если цель видна
   */
  static canSeeTarget(observer: Vehicle, target: Vehicle): boolean {
    // 1. Проверка расстояния
    const distance = Phaser.Math.Distance.BetweenPoints(
      observer.getPosition(),
      target.getPosition()
    );
    
    const maxVisualRange = Settings.MAX_VISUAL_RANGE || 500;
    if (distance > maxVisualRange) {
      return false;
    }
    
    // 2. Проверка угла обзора (перископ для подлодок)
    if (observer instanceof Submarine) {
      if (!observer['periscope']) {
        return false; // Нет перископа - нет визуального обнаружения
      }
    }
    
    // 3. Проверка препятствий (опционально)
    // const hasObstacles = this.checkLineOfSight(observer, target);
    // if (hasObstacles) return false;
    
    // 4. Модификаторы видимости
    const targetSize = target instanceof Ship ? 1.0 : 0.5; // Торпеды меньше
    const weatherFactor = 1.0; // Можно добавить погоду
    
    const effectiveRange = maxVisualRange * targetSize * weatherFactor;
    
    return distance < effectiveRange;
  }
  
  /**
   * Проверка прямой видимости (без препятствий)
   */
  static checkLineOfSight(observer: Vehicle, target: Vehicle): boolean {
    // Реализация ray-casting для проверки препятствий
    // Возвращает true если путь свободен
    return true;
  }
}
```

**Интеграция в Vehicle.ts:**

```typescript
// Vehicle.ts - updateSensors()
import { VisualDetection } from '../utils/VisualDetection';

public updateSensors(allVehicles: Vehicle[], gameTime: number, informer: Informer | null): void {
  for (const otherVehicle of allVehicles) {
    if (otherVehicle === this || otherVehicle.getForces() === this.getForces()) continue;
    
    // Существующая система шума
    const receivedNoise = PhysicsUtils.getReceivedNoiseLevel(otherVehicle, this.getPosition());
    let noiseBasedDetection = this.getNoiseDetectionState(receivedNoise);
    
    // НОВАЯ система визуального обнаружения
    const visualDetection = VisualDetection.canSeeTarget(this, otherVehicle);
    
    // Комбинированное обнаружение (берем лучшее)
    let finalDetectionState = noiseBasedDetection;
    if (visualDetection && finalDetectionState < DetectionState.ZONE_2_LOCALIZED) {
      finalDetectionState = DetectionState.ZONE_2_LOCALIZED; // Визуально = Зона 2
    }
    
    // Обновление perceivedTargets с учетом обоих типов обнаружения
    // ...
  }
}

private getNoiseDetectionState(receivedNoise: number): DetectionState {
  if (receivedNoise >= Settings.NOISE_THRESHOLD_ZONE_3_IDENTIFIED) {
    return DetectionState.ZONE_3_IDENTIFIED;
  } else if (receivedNoise >= Settings.NOISE_THRESHOLD_ZONE_2_LOCALIZED) {
    return DetectionState.ZONE_2_LOCALIZED;
  } else if (receivedNoise >= Settings.NOISE_THRESHOLD_ZONE_1_UNCERTAIN) {
    return DetectionState.ZONE_1_UNCERTAIN;
  }
  return DetectionState.NO_CONTACT;
}
```

### 4. Новая Стратегия ИИ для Кораблей

**Пример:** Агрессивное преследование

```typescript
// src/ai/AIAggressivePursuit.ts
import { Ship } from '../objects/Ship';
import { MainScene } from '../scenes/MainScene';
import { Constants } from '../utils/Constants';
import { Settings } from '../utils/Settings';
import { Vehicle } from '../objects/Vehicle';
import { DetectionState } from '../utils/DetectionState';
import { CoordUtils } from '../utils/CoordUtils';

export class AIAggressivePursuit {
  private owner: Ship;
  private mainScene: MainScene;
  private currentTarget: Ship | null = null;
  private pursuitTimeout: number = 0;
  
  constructor(owner: Ship, scene: MainScene) {
    this.owner = owner;
    this.mainScene = scene;
  }
  
  /**
   * Агрессивное преследование ближайшей цели
   */
  public pursue(delta: number): void {
    if (!this.owner || !this.owner.active) return;
    
    this.pursuitTimeout -= delta;
    
    // Поиск цели каждые 2 секунды
    if (this.pursuitTimeout <= 0) {
      this.pursuitTimeout = 2000;
      this.currentTarget = this.findBestTarget();
    }
    
    if (!this.currentTarget || !this.currentTarget.active) {
      this.currentTarget = null;
      return;
    }
    
    // Получение информации о цели из сенсоров
    const targetInfo = this.owner.perceivedTargets.get(this.currentTarget.id);
    if (!targetInfo) {
      this.currentTarget = null;
      return;
    }
    
    // Преследование только при хорошем обнаружении
    if (targetInfo.detectionState >= DetectionState.ZONE_2_LOCALIZED) {
      this.moveToTarget(this.currentTarget);
      
      // Попытка атаки на близкой дистанции
      const distance = Phaser.Math.Distance.Between(
        this.owner.x, this.owner.y,
        this.currentTarget.x, this.currentTarget.y
      );
      
      if (distance < Settings.TRP_I_DIST_EXECUTION) {
        // Атака через AIWeaponControl
        if (this.owner['aiWeaponControl']) {
          this.owner['aiWeaponControl'].evaluateAndFire();
        }
      }
    }
  }
  
  /**
   * Поиск лучшей цели для преследования
   */
  private findBestTarget(): Ship | null {
    let bestTarget: Ship | null = null;
    let minDistance = Infinity;
    
    for (const [targetId, targetInfo] of this.owner.perceivedTargets.entries()) {
      if (!targetInfo.targetVehicle.active) continue;
      if (!(targetInfo.targetVehicle instanceof Ship)) continue;
      if (targetInfo.detectionState < DetectionState.ZONE_2_LOCALIZED) continue;
      
      const distance = Phaser.Math.Distance.Between(
        this.owner.x, this.owner.y,
        targetInfo.targetVehicle.x, targetInfo.targetVehicle.y
      );
      
      // Приоритет: ближайшая цель
      if (distance < minDistance) {
        minDistance = distance;
        bestTarget = targetInfo.targetVehicle as Ship;
      }
    }
    
    return bestTarget;
  }
  
  /**
   * Движение к цели
   */
  private moveToTarget(target: Ship): void {
    const targetLogicalPos = CoordUtils.phaserToLogical(target.getPosition());
    
    // Обновляем WayPoint к цели
    this.owner.clearWayPoints();
    this.owner.addWayPoint(targetLogicalPos.x, targetLogicalPos.y, Constants.WP_TYPE_TARGET);
    
    if (!this.owner.isMovingOnWayPoint) {
      this.owner.startMoveOnWP();
    }
    
    // Максимальная скорость для преследования
    if (this.owner.getPower() < Vehicle.POWER_5) {
      this.owner.setPower(Vehicle.POWER_5);
    }
    
    this.owner['moveState'] = Vehicle.ST_WP_MOVING;
  }
}
```

**Использование:**

```typescript
// Ship.ts
import { AIAggressivePursuit } from '../ai/AIAggressivePursuit';

export class Ship extends Vehicle {
  private aiPursuit: AIAggressivePursuit | null = null;
  
  constructor(scene: Phaser.Scene, x: number, y: number, forces: number) {
    super(scene, x, y);
    
    if (!this.underControl) {
      this.aiWeaponControl = new AIWeaponControl(this, scene as MainScene);
      this.aiPursuit = new AIAggressivePursuit(this, scene as MainScene);
    }
  }
  
  // НОВЫЙ метод update для постоянного преследования
  override update(time: number, delta: number): void {
    super.update(time, delta);
    
    // Агрессивное преследование в каждом кадре
    if (this.aiPursuit && !this.underControl && !this.isConvoyShip) {
      this.aiPursuit.pursue(delta);
    }
  }
}
```

### 5. Система Поведения (Behavior Trees)

**Структура:**

```typescript
// src/ai/behaviors/Behavior.ts
export enum BehaviorStatus {
  SUCCESS,
  FAILURE,
  RUNNING
}

export abstract class Behavior {
  abstract execute(owner: Ship, context: any): BehaviorStatus;
}

// src/ai/behaviors/SequenceBehavior.ts
export class SequenceBehavior extends Behavior {
  private children: Behavior[] = [];
  private currentIndex: number = 0;
  
  constructor(children: Behavior[]) {
    super();
    this.children = children;
  }
  
  execute(owner: Ship, context: any): BehaviorStatus {
    while (this.currentIndex < this.children.length) {
      const status = this.children[this.currentIndex].execute(owner, context);
      
      if (status === BehaviorStatus.RUNNING) {
        return BehaviorStatus.RUNNING;
      }
      if (status === BehaviorStatus.FAILURE) {
        this.currentIndex = 0;
        return BehaviorStatus.FAILURE;
      }
      
      this.currentIndex++;
    }
    
    this.currentIndex = 0;
    return BehaviorStatus.SUCCESS;
  }
}

// src/ai/behaviors/SelectorBehavior.ts
export class SelectorBehavior extends Behavior {
  private children: Behavior[] = [];
  
  constructor(children: Behavior[]) {
    super();
    this.children = children;
  }
  
  execute(owner: Ship, context: any): BehaviorStatus {
    for (const child of this.children) {
      const status = child.execute(owner, context);
      
      if (status !== BehaviorStatus.FAILURE) {
        return status;
      }
    }
    
    return BehaviorStatus.FAILURE;
  }
}
```

**Примеры конкретных поведений:**

```typescript
// src/ai/behaviors/FindTargetBehavior.ts
export class FindTargetBehavior extends Behavior {
  execute(owner: Ship, context: any): BehaviorStatus {
    for (const [id, targetInfo] of owner.perceivedTargets.entries()) {
      if (targetInfo.targetVehicle.active &&
          targetInfo.targetVehicle instanceof Ship &&
          targetInfo.detectionState >= DetectionState.ZONE_2_LOCALIZED) {
        context.target = targetInfo.targetVehicle;
        return BehaviorStatus.SUCCESS;
      }
    }
    
    context.target = null;
    return BehaviorStatus.FAILURE;
  }
}

// src/ai/behaviors/AttackTargetBehavior.ts
export class AttackTargetBehavior extends Behavior {
  execute(owner: Ship, context: any): BehaviorStatus {
    if (!context.target || !owner['aiWeaponControl']) {
      return BehaviorStatus.FAILURE;
    }
    
    owner['aiWeaponControl'].evaluateAndFire();
    return BehaviorStatus.SUCCESS;
  }
}

// src/ai/behaviors/PatrolBehavior.ts
export class PatrolBehavior extends Behavior {
  execute(owner: Ship, context: any): BehaviorStatus {
    if (owner.hasWayPoints()) {
      return BehaviorStatus.RUNNING;
    }
    
    // Генерация случайной точки патрулирования
    const randomX = Phaser.Math.Between(-2000, 2000);
    const randomY = Phaser.Math.Between(-2000, 2000);
    
    owner.clearWayPoints();
    owner.addWayPoint(randomX, randomY, Constants.WP_TYPE_SEARCH);
    owner.startMoveOnWP();
    
    return BehaviorStatus.RUNNING;
  }
}
```

**Создание Behavior Tree:**

```typescript
// Ship.ts
import { SelectorBehavior } from '../ai/behaviors/SelectorBehavior';
import { SequenceBehavior } from '../ai/behaviors/SequenceBehavior';
import { FindTargetBehavior } from '../ai/behaviors/FindTargetBehavior';
import { AttackTargetBehavior } from '../ai/behaviors/AttackTargetBehavior';
import { PatrolBehavior } from '../ai/behaviors/PatrolBehavior';

export class Ship extends Vehicle {
  private behaviorTree: Behavior | null = null;
  private behaviorContext: any = {};
  
  constructor(scene: Phaser.Scene, x: number, y: number, forces: number) {
    super(scene, x, y);
    
    if (!this.underControl) {
      // Создание Behavior Tree:
      // Если есть цель → атаковать, иначе → патрулировать
      this.behaviorTree = new SelectorBehavior([
        new SequenceBehavior([
          new FindTargetBehavior(),
          new AttackTargetBehavior()
        ]),
        new PatrolBehavior()
      ]);
    }
  }
  
  public AI_step_II(): void {
    if (!this.active || this.underControl || !this.behaviorTree) return;
    
    this.behaviorTree.execute(this, this.behaviorContext);
  }
}
```

---

## Заключение

### Ключевые Принципы Дизайна

1. **Модульность** - каждый компонент ИИ независим
2. **Расширяемость** - легко добавлять новые алгоритмы
3. **Реалистичность** - физика и сенсоры основаны на реальных принципах
4. **Производительность** - двухфазный цикл оптимизирует нагрузку

### Дальнейшее Развитие

**Планируемые улучшения:**
- Поведенческие деревья (Behavior Trees)
- Система целей (Goal-Oriented Action Planning)
- Машинное обучение для адаптации ИИ
- Кооперация между кораблями
- Формации и тактические маневры

### Полезные Файлы

- `src/ai/AIWeaponControl.ts` - управление оружием
- `src/objects/Vehicle.ts` - базовая логика движения и сенсоров
- `src/objects/Ship.ts` - логика кораблей
- `src/objects/Torpedo*.ts` - алгоритмы торпед
- `src/utils/PhysicsUtils.ts` - физические расчеты
- `src/utils/Settings.ts` - настройки и параметры
- `src/utils/Constants.ts` - константы игры

### Контакты

Для вопросов и предложений по игровому ИИ обращайтесь к документации проекта.

---

**Версия документа:** 1.0  
**Дата:** 2025-10-27  
**Автор:** AI Assistant (на основе анализа кодовой базы)

