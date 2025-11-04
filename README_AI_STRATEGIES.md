# Система "Сменных Мозгов" для Silent Red Storm

## Оглавление
1. [Обзор](#обзор)
2. [Способы создания стратегий](#способы-создания-стратегий)
    - [DSL (Рекомендуемый)](#dsl-рекомендуемый)
    - [TypeScript (Продвинутый)](#typescript-продвинутый)
3. [Архитектура](#архитектура)
4. [Доступные Стратегии](#доступные-стратегии)
5. [Использование](#использование)
6. [Расширение системы](#расширение-системы)
7. [API Справочник](#api-справочник)

## Обзор

Система "Сменных Мозгов" позволяет динамически назначать, заменять и генерировать алгоритмы ИИ для игровых объектов. Основные возможности:

- **Модульность**: Полное разделение "тела" (объекта) и "мозга" (логики принятия решений).
- **Гибкость**: Два способа создания стратегий (простой DSL и мощный TypeScript).
- **Динамичность**: Замена ИИ "на лету" во время игры.

## Способы создания стратегий

### DSL (Рекомендуемый)

Использование DSL (Domain-Specific Language) в формате YAML — это самый быстрый и удобный способ создавать и модифицировать AI.

**Преимущества:**
- **Простота**: Не требует глубоких знаний TypeScript.
- **Наглядность**: Логика поведения описана в декларативном стиле.
- **Быстрая итерация**: Изменения вносятся в YAML-файл без необходимости перекомпиляции всего проекта.

**🔥 Полное руководство по синтаксису DSL, доступным командам и условиям находится в файле `README_LLM_ANALYSIS.md`**

**Пример DSL-стратегии:**
```yaml
strategy: "Агрессивный охотник"
description: "Атакует ближайшие цели"

ON ANALYZE:
  - FIND:
      best_target:
        type: ship
        range: 2000
        detection_zone: 1
ON ACTION:
  IF:
    condition: best_target IS_PRESENT AND weapon_I IS_READY AND distance_to(best_target) < 800
    actions:
      - Action:
          ATTACK:
            with: best_target
            torpedo: weapon_I
            predict_lead_time: 5
```

### TypeScript (Продвинутый)

Создание стратегий в виде классов TypeScript предоставляет максимальную гибкость и доступ ко всему API игры. Этот способ подходит для реализации сложной, нетривиальной логики.

**Преимущества:**
- **Полный контроль**: Доступ ко всем методам и свойствам игровых объектов.
- **Сложные вычисления**: Возможность реализации любых алгоритмов.
- **Производительность**: Скомпилированный код работает быстрее, чем интерпретируемый DSL.

**Пример TS-стратегии (см. раздел "Расширение системы").**

## Архитектура

Система построена на паттерне "Стратегия" (Strategy Pattern) и поддерживает оба типа стратегий:

```
AIStrategy (интерфейс)
├── DSLStrategy (выполняет логику из YAML-файла)
└── BaseAIStrategy (абстрактный базовый класс для TS-стратегий)
    ├── DefaultShipStrategy
    ├── AggressiveShipStrategy
    └── HomingTorpedoStrategy
```

Каждая стратегия, независимо от способа ее создания, реализует два основных метода:
- `analyzeStep()` - анализ ситуации, сбор информации.
- `actionStep()` - принятие решений и выполнение действий.

## Доступные Стратегии

| ID | Название | Тип | Описание |
|----|----------|-----|----------|
| `default_ship` | Стандартный Боевой ИИ | TS | Базовая стратегия. Атакует цели и увеличивает скорость при низком здоровье. |
| `aggressive_ship` | Агрессивный Охотник | TS | Активно преследует цели. Игнорирует опасность. |
| `homing_torpedo` | Самонаводящаяся Торпеда | TS | Ищет и преследует ближайшую шумную цель. |
| *любое имя* | *Например, "Агрессивный охотник"* | DSL | Стратегии, загруженные из YAML. Их ID соответствует полю `strategy` в файле. |


## Использование

### Назначение стратегий из DSL

```typescript
// `aggressiveHunterDSL` - это строка, содержащая YAML-код
AIStrategyFactory.assignStrategyFromDSL(aggressiveHunterDSL, ship, scene);
```

### Назначение стандартных (TS) стратегий

```typescript
// Назначение стратегии кораблю по ее ID
AIStrategyFactory.assignStrategy('aggressive_ship', ship, scene);
```

## Расширение системы

### Создание новой DSL-стратегии

1.  Создайте строку с YAML-кодом, описывающим логику.
2.  Передайте эту строку в `AIStrategyFactory.assignStrategyFromDSL()`.

### Создание новой TS-стратегии

1. Создайте новый класс, наследующий `BaseAIStrategy`:

```typescript
import { BaseAIStrategy } from './BaseAIStrategy';

export class MyNewStrategy extends BaseAIStrategy {
    public readonly name: string = "Моя Новая Стратегия";
    public readonly description: string = "Описание стратегии";
    
    public analyzeStep(owner: Vehicle, context: AIWorldContext): void {
        // Ваш код анализа
    }
    
    public actionStep(owner: Vehicle, context: AIWorldContext): void {
        // Ваш код действий
    }
}
```

2. Зарегистрируйте стратегию в фабрике:

```typescript
AIStrategyFactory.registerStrategy('my_new_strategy', MyNewStrategy);
```

## ⚠️ КРИТИЧЕСКИ ВАЖНО: Система Координат и Углов

### Навигационная Система Координат

**Игра использует НАВИГАЦИОННУЮ систему координат, НЕ математическую!**

#### Направления (градусы)
- **0° = Север (вверх)** ⬆️
- **90° = Восток (вправо)** ➡️
- **180° = Юг (вниз)** ⬇️
- **270° = Запад (влево)** ⬅️

#### Преобразование в векторы движения

**ПРАВИЛЬНО** для навигационной системы:
```typescript
const direction = vehicle.getDirection(); // В градусах
const directionRad = Phaser.Math.DegToRad(direction); // Конвертация в радианы

// Вектор движения:
const velocityX = Math.sin(directionRad) * speed;  // X = sin для навигации
const velocityY = -Math.cos(directionRad) * speed; // Y = -cos для навигации
```

**НЕПРАВИЛЬНО** (математическая система):
```typescript
// ❌ НЕ ИСПОЛЬЗУЙТЕ ТАК:
const velocityX = Math.cos(direction) * speed;  // Это для математической системы!
const velocityY = Math.sin(direction) * speed;  // Это для математической системы!
```

#### Проверка Правильности

| Курс | sin(rad) | -cos(rad) | Вектор | Направление |
|------|----------|-----------|--------|-------------|
| 0°   | 0        | -1        | (0, -1)| Вверх ✓     |
| 90°  | 1        | 0         | (1, 0) | Вправо ✓    |
| 180° | 0        | 1         | (0, 1) | Вниз ✓      |
| 270° | -1       | 0         | (-1, 0)| Влево ✓     |

### Расчет Упреждения для Торпед

**Пример из SilentHunterStrategy:**

```typescript
// 1. Получить направление цели (в градусах)
const targetDir = target.getDirection();

// 2. Конвертировать в радианы
const targetDirRad = Phaser.Math.DegToRad(targetDir);

// 3. Рассчитать дистанцию движения цели
const predictTime = 20; // секунды
const targetSpeed = target.getSpeed(); // узлы
const targetTravelDist = (targetSpeed * predictTime / 60);

// 4. ПРАВИЛЬНЫЙ расчет предсказанной позиции
const predictX = target.x + Math.sin(targetDirRad) * targetTravelDist;
const predictY = target.y - Math.cos(targetDirRad) * targetTravelDist;

// 5. Запуск торпеды
this.scene.fireTorpedo(sub, weaponType, predictX, predictY);
```

### Частые Ошибки

#### ❌ Ошибка 1: Использование градусов вместо радианов
```typescript
// НЕПРАВИЛЬНО:
const x = target.x + Math.sin(targetDir) * distance; // targetDir в градусах!
```

```typescript
// ПРАВИЛЬНО:
const dirRad = Phaser.Math.DegToRad(targetDir);
const x = target.x + Math.sin(dirRad) * distance;
```

#### ❌ Ошибка 2: Математическая система вместо навигационной
```typescript
// НЕПРАВИЛЬНО (математическая):
const x = target.x + Math.cos(dirRad) * distance;
const y = target.y + Math.sin(dirRad) * distance;
```

```typescript
// ПРАВИЛЬНО (навигационная):
const x = target.x + Math.sin(dirRad) * distance;
const y = target.y - Math.cos(dirRad) * distance; // Минус для Y!
```

#### ❌ Ошибка 3: Забыли знак минус для Y
```typescript
// НЕПРАВИЛЬНО:
const y = target.y + Math.cos(dirRad) * distance; // Без минуса!
```

```typescript
// ПРАВИЛЬНО:
const y = target.y - Math.cos(dirRad) * distance; // С минусом!
```

### Утилиты для Работы с Углами

```typescript
// Получить угол между двумя точками (результат в радианах)
const angleRad = Phaser.Math.Angle.Between(fromX, fromY, toX, toY);

// Конвертировать в градусы (математическая система)
let angleDegMath = Phaser.Math.RadToDeg(angleRad);

// Конвертировать в навигационную систему (0° = вверх)
let angleNav = (angleDegMath + 90 + 360) % 360;

// Кратчайший угол между двумя направлениями
const diff = Phaser.Math.Angle.ShortestBetween(currentDir, targetDir);
```

---

## API Справочник

### Vehicle

Базовый класс для всех игровых объектов. Ключевые методы:

- `getDirection(): number` - **возвращает направление в ГРАДУСАХ (0-360, навигационная система)**
- `setPower(level: number)` - установка мощности двигателя (0-6)
- `setRudder(position: number)` - установка положения руля (-3 до +3)
- `addWayPoint(x: number, y: number, type: number)` - добавление путевой точки
- `clearWayPoints()` - очистка всех путевых точек
- `startMoveOnWP()` - начало движения по путевым точкам
- `stopMoveOnWayPoint()` - остановка движения по путевым точкам

### Ship

Класс корабля. Дополнительные методы:

- `isWeaponReady(weaponType: number)` - проверка готовности оружия
- `getTruePositionBeforeSensorEffects()` - получение истинной позиции

### AIWorldContext

Контекст, передаваемый в стратегию ИИ:

- `perceivedTargets: Map<number, PerceivedTargetInfo>` - обнаруженные цели
- `scene: MainScene` - игровая сцена
- `gameTime: number` - текущее игровое время

### PerceivedTargetInfo

Информация об обнаруженной цели:

- `targetVehicle: Vehicle` - объект цели
- `detectionState: DetectionState` - состояние обнаружения (0-3)
- `displayPositionLogical: Phaser.Math.Vector2` - отображаемая позиция

---

## Примеры Пользовательских Стратегий

### Патрульная стратегия

```javascript
class PatrolStrategy {
    constructor() {
        this.name = "Патрульный ИИ";
        this.description = "Патрулирует заданный маршрут и атакует цели на дистанции";
        this.patrolPoints = [
            { x: 500, y: 500 },
            { x: -500, y: 500 },
            { x: -500, y: -500 },
            { x: 500, y: -500 }
        ];
        this.currentPatrolIndex = 0;
    }
    
    initialize(owner, scene) {
        this.owner = owner;
        this.scene = scene;
        
        // Устанавливаем начальную точку патрулирования
        owner.clearWayPoints();
        const point = this.patrolPoints[this.currentPatrolIndex];
        owner.addWayPoint(point.x, point.y);
        owner.startMoveOnWP();
    }
    
    analyzeStep(owner, context) {
        // Проверяем, достигли ли мы текущей точки патрулирования
        // ИСПОЛЬЗУЕМ ПУБЛИЧНЫЙ МЕТОД вместо прямого доступа к wayPoints
        if (!owner.hasWayPoints()) {
            // Переходим к следующей точке
            this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
            const point = this.patrolPoints[this.currentPatrolIndex];
            owner.addWayPoint(point.x, point.y);
            owner.startMoveOnWP();
        }
    }
    
    actionStep(owner, context) {
        // Ищем цель для атаки
        let targetToAttack = null;
        let minDistance = Infinity;
        
        for (const [id, targetInfo] of owner.perceivedTargets.entries()) {
            if (targetInfo.detectionState >= 1 && // Зона 2 или выше
                targetInfo.targetVehicle.active &&
                targetInfo.targetVehicle.getForces() !== owner.getForces()) {
                
                // ИСПОЛЬЗУЕМ ПУБЛИЧНЫЕ МЕТОДЫ для получения позиций
                const ownerPos = owner.getPosition();
                const targetPos = targetInfo.targetVehicle.getPosition();
                const distance = Phaser.Math.Distance.Between(
                    ownerPos.x, ownerPos.y,
                    targetPos.x, targetPos.y
                );
                
                if (distance < minDistance && distance < 800) {
                    minDistance = distance;
                    targetToAttack = targetInfo.targetVehicle;
                }
            }
        }
        
        // Атакуем, если нашли цель
        if (targetToAttack && owner.isWeaponReady(1)) { // 1 = торпеда типа I
            const targetPos = targetToAttack.getPosition();
            context.scene.fireTorpedo(owner, 1, targetPos.x, targetPos.y);
        }
        
        // Устанавливаем среднюю скорость для патрулирования
        // ИСПОЛЬЗУЕМ ПУБЛИЧНЫЙ МЕТОД вместо прямого доступа к power
        if (owner.getPower() !== 3) {
            owner.setPower(3);
        }
    }
}
```

### Стратегия уклонения от торпед

```javascript
class TorpedoEvasionStrategy {
    constructor() {
        this.name = "Уклонение от торпед";
        this.description = "Активно уклоняется от торпед и атакует только при отсутствии угроз";
        this.dangerDistance = 500; // Дистанция опасности для торпед
        this.evasionCooldown = 0;
    }
    
    initialize(owner, scene) {
        this.owner = owner;
        this.scene = scene;
    }
    
    analyzeStep(owner, context) {
        // Уменьшаем кулдаун уклонения
        if (this.evasionCooldown > 0) {
            this.evasionCooldown -= 500; // 500мс - интервал вызова AI_step_I
        }
        
        // Ищем ближайшую торпеду
        let closestTorpedo = null;
        let minDistance = Infinity;
        
        for (const [id, targetInfo] of owner.perceivedTargets.entries()) {
            if (targetInfo.targetVehicle.entityType === 'Torpedo' &&
                targetInfo.targetVehicle.active &&
                targetInfo.targetVehicle.getForces() !== owner.getForces()) {
                
                // ИСПОЛЬЗУЕМ ПУБЛИЧНЫЕ МЕТОДЫ для получения позиций
                const ownerPos = owner.getPosition();
                const targetPos = targetInfo.targetVehicle.getPosition();
                const distance = Phaser.Math.Distance.Between(
                    ownerPos.x, ownerPos.y,
                    targetPos.x, targetPos.y
                );
                
                if (distance < minDistance && distance < this.dangerDistance) {
                    minDistance = distance;
                    closestTorpedo = targetInfo.targetVehicle;
                }
            }
        }
        
        // Если обнаружена торпеда и кулдаун истек, выполняем маневр уклонения
        if (closestTorpedo && this.evasionCooldown <= 0) {
            this.performEvasiveManeuver(owner, closestTorpedo);
            this.evasionCooldown = 5000; // 5 секунд кулдаун между маневрами
        }
    }
    
    actionStep(owner, context) {
        // Если выполняется маневр уклонения, не атакуем
        if (this.evasionCooldown > 3000) {
            return;
        }
        
        // Иначе ищем цель для атаки
        let targetToAttack = null;
        let minDistance = Infinity;
        
        for (const [id, targetInfo] of owner.perceivedTargets.entries()) {
            if (targetInfo.detectionState >= 1 && // Зона 2 или выше
                targetInfo.targetVehicle.active &&
                targetInfo.targetVehicle.getForces() !== owner.getForces() &&
                targetInfo.targetVehicle.entityType === 'Ship') {
                
                // ИСПОЛЬЗУЕМ ПУБЛИЧНЫЕ МЕТОДЫ для получения позиций
                const ownerPos = owner.getPosition();
                const targetPos = targetInfo.targetVehicle.getPosition();
                const distance = Phaser.Math.Distance.Between(
                    ownerPos.x, ownerPos.y,
                    targetPos.x, targetPos.y
                );
                
                if (distance < minDistance && distance < 800) {
                    minDistance = distance;
                    targetToAttack = targetInfo.targetVehicle;
                }
            }
        }
        
        // Атакуем, если нашли цель
        if (targetToAttack && owner.isWeaponReady(1)) {
            const targetPos = targetToAttack.getPosition();
            context.scene.fireTorpedo(owner, 1, targetPos.x, targetPos.y);
        }
    }
    
    performEvasiveManeuver(owner, torpedo) {
        // ИСПОЛЬЗУЕМ ПУБЛИЧНЫЕ МЕТОДЫ для получения позиций
        const ownerPos = owner.getPosition();
        const torpedoPos = torpedo.getPosition();
        
        // Рассчитываем направление от торпеды к кораблю
        const angleToTorpedo = Phaser.Math.Angle.Between(
            torpedoPos.x, torpedoPos.y,
            ownerPos.x, ownerPos.y
        );
        
        // Выбираем направление уклонения перпендикулярно направлению торпеды
        const evasionAngle = angleToTorpedo + Math.PI/2;
        
        // Рассчитываем точку для уклонения
        const evasionDistance = 300;
        const evasionX = ownerPos.x + Math.cos(evasionAngle) * evasionDistance;
        const evasionY = ownerPos.y + Math.sin(evasionAngle) * evasionDistance;
        
        // Конвертируем в логические координаты для addWayPoint
        const CoordUtils = owner.scene.sys.game.config as any;
        // В реальном коде используйте: CoordUtils.phaserToLogical({x: evasionX, y: evasionY})
        // Для примера используем координаты напрямую (предполагая, что они уже в логических единицах)
        
        // Устанавливаем путевую точку для уклонения
        owner.clearWayPoints();
        owner.addWayPoint(evasionX, evasionY);
        owner.startMoveOnWP();
        
        // Устанавливаем максимальную скорость для уклонения
        owner.setPower(6);
    }
}
```

---

© 2025 Silent Red Storm - Система "Сменных Мозгов"
