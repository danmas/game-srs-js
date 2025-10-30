# Система "Сменных Мозгов" для Silent Red Storm

## Оглавление
1. [Обзор](#обзор)
2. [Архитектура](#архитектура)
3. [Доступные Стратегии](#доступные-стратегии)
4. [Использование](#использование)
   - [Назначение стандартных стратегий](#назначение-стандартных-стратегий)
   - [Создание пользовательских стратегий](#создание-пользовательских-стратегий)
   - [Генерация стратегий с помощью LLM](#генерация-стратегий-с-помощью-llm)
   - [Клонирование стратегий](#клонирование-стратегий)
5. [Расширение системы](#расширение-системы)
6. [API Справочник](#api-справочник)

## Обзор

Система "Сменных Мозгов" позволяет динамически назначать, заменять и генерировать алгоритмы ИИ для игровых объектов. Основные возможности:

- **Модульность**: Полное разделение "тела" (объекта) и "мозга" (логики принятия решений)
- **Гибкость**: Возможность создавать и назначать разные стратегии поведения
- **Динамичность**: Замена ИИ "на лету" во время игры
- **Интеграция с LLM**: Генерация новых стратегий с помощью текстовых описаний

## Архитектура

Система построена на паттерне "Стратегия" (Strategy Pattern):

```
AIStrategy (интерфейс)
├── BaseAIStrategy (абстрактный базовый класс)
│   ├── DefaultShipStrategy (стандартная стратегия корабля)
│   ├── AggressiveShipStrategy (агрессивная стратегия корабля)
│   └── HomingTorpedoStrategy (стратегия самонаводящейся торпеды)
└── CustomAIStrategy (динамически созданная стратегия)
```

Каждая стратегия реализует два основных метода:
- `analyzeStep()` - анализ ситуации, сбор информации (переопределяется в наследниках `BaseAIStrategy`)
- `actionStep()` - принятие решений и выполнение действий (переопределяется в наследниках `BaseAIStrategy`)

**Примечание:** Базовый класс `BaseAIStrategy` предоставляет пустые реализации этих методов. Конкретная логика реализуется в наследниках (например, `DefaultShipStrategy`, `AggressiveShipStrategy`).

## Доступные Стратегии

### Стандартные стратегии

| ID | Название | Описание |
|----|----------|----------|
| `default_ship` | Стандартный Боевой ИИ | Базовая стратегия для кораблей. Атакует обнаруженные цели и увеличивает скорость при низком здоровье. |
| `aggressive_ship` | Агрессивный Охотник | Активно преследует обнаруженные цели и атакует при первой возможности. Игнорирует опасность. |
| `homing_torpedo` | Самонаводящаяся Торпеда | Ищет ближайшую шумную цель и преследует ее. Эффективна против громких кораблей. |

## Использование

### Назначение стандартных стратегий

```typescript
// Назначение стратегии кораблю
AIStrategyFactory.assignStrategy('aggressive_ship', ship, scene);

// Получение стратегии по умолчанию для объекта
const defaultStrategy = AIStrategyFactory.getDefaultStrategy(ship, scene);
ship.aiStrategy = defaultStrategy;
```

### Создание пользовательских стратегий

```typescript
// Создание стратегии из кода JavaScript
const customCode = `
class PatrolStrategy {
    constructor() {
        this.name = "Патрульный ИИ";
        this.description = "Патрулирует заданный маршрут";
    }
    
    initialize(owner, scene) {
        // Инициализация
    }
    
    analyzeStep(owner, context) {
        // Анализ ситуации
    }
    
    actionStep(owner, context) {
        // Действия
    }
}

return PatrolStrategy;
`;

// Назначение пользовательской стратегии
AICodeGenerator.createAndAssignStrategy(customCode, ship, scene);
```

### Генерация стратегий с помощью LLM

**⚠️ ПРИМЕЧАНИЕ:** Функция `generateStrategyFromPrompt()` в данный момент является **заглушкой** и не выполняет реальный запрос к LLM API. Для использования требуется реализация интеграции с конкретным LLM сервисом (OpenAI, Anthropic и т.д.).

```typescript
// Генерация стратегии по текстовому описанию
const prompt = "Создай агрессивную стратегию, которая преследует цели и атакует торпедами типа II";
const apiKey = "YOUR_API_KEY";

// Асинхронная генерация (возвращает заглушку, пока не реализована интеграция с LLM)
const generatedCode = await AICodeGenerator.generateStrategyFromPrompt(prompt, apiKey);
if (generatedCode) {
    AICodeGenerator.createAndAssignStrategy(generatedCode, ship, scene);
}
```

**Для реальной генерации** необходимо модифицировать метод `AICodeGenerator.generateStrategyFromPrompt()` для интеграции с выбранным LLM API.

### Клонирование стратегий

**⚠️ ПРИМЕЧАНИЕ:** Функция клонирования стратегий в данный момент не реализована в базовом API. Для передачи стратегии между объектами используйте:

```typescript
// Получение стратегии от одного объекта и назначение другому
const sourceStrategy = sourceShip.aiStrategy;
if (sourceStrategy) {
  const newStrategy = AIStrategyFactory.createStrategy('default_ship'); // Создаем новую стратегию того же типа
  if (newStrategy) {
    newStrategy.initialize(targetShip, scene);
    targetShip.aiStrategy = newStrategy;
  }
}
```

**Планируется:** В будущих версиях будет добавлен метод `AIStrategyFactory.cloneStrategy()` для прямой клонирования стратегий.

## Расширение системы

### Создание новой стратегии

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

## API Справочник

### Vehicle

Базовый класс для всех игровых объектов. Ключевые методы:

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
