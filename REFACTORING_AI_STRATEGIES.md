# Рефакторинг AI Стратегий - Общие Функции

## Обзор

В рамках рефакторинга были вынесены общие функции из конкретных стратегий ИИ в базовый класс `BaseAIStrategy`. Это уменьшает дублирование кода и упрощает создание новых стратегий.

## Добавленные общие функции в BaseAIStrategy

### 1. `logPeriodicStatus()` - Периодическое логирование статуса

**Назначение:** Логирует состояние юнита каждые 5 секунд для отслеживания активности ИИ.

**Сигнатура:**
```typescript
protected logPeriodicStatus(
    vehicle: Vehicle,
    context: AIWorldContext,
    additionalData?: Record<string, any>
): void
```

**Пример использования:**
```typescript
// В методе analyzeStep
this.logPeriodicStatus(ship, context, {
    currentThreat: this.threatId,
    phase: this.currentPhase
});
```

**Логирует:**
- `entityId`, `strategy`, `health`, `power`
- `position`, `direction`, `speed`, `targetCount`
- `depth` (для подводных лодок)
- Любые дополнительные данные через `additionalData`

---

### 2. `checkHealthAndAdjustSpeed()` - Автоматическое повышение скорости при низком здоровье

**Назначение:** Проверяет здоровье корабля и автоматически увеличивает скорость при критическом уроне.

**Сигнатура:**
```typescript
protected checkHealthAndAdjustSpeed(
    ship: Ship,
    context: AIWorldContext,
    threshold: number = 200,
    targetPower: number = Vehicle.POWER_4
): boolean
```

**Пример использования:**
```typescript
// В методе analyzeStep
this.checkHealthAndAdjustSpeed(ship, context, 200, Vehicle.POWER_4);

// Или с кастомными параметрами
this.checkHealthAndAdjustSpeed(ship, context, 150, Vehicle.POWER_5);
```

**Возвращает:** `true` если скорость была изменена, иначе `false`.

---

### 3. `findTargetByFilter()` - Универсальный поиск цели

**Назначение:** Находит подходящую цель по заданным критериям.

**Сигнатура:**
```typescript
protected findTargetByFilter(
    vehicle: Vehicle,
    context: AIWorldContext,
    filter: {
        requireDetectionLevel?: DetectionState;
        requireType?: 'Ship' | 'Submarine' | 'any';
        maxDistance?: number;
        minDistance?: number;
        excludeConvoy?: boolean;
        excludeAllies?: boolean;
        maxSpeedFilter?: number;
    } = {}
): number | null
```

**Примеры использования:**

```typescript
// Поиск любого врага в Зоне 2+
const targetId = this.findTargetByFilter(ship, context, {
    requireDetectionLevel: DetectionState.ZONE_2_LOCALIZED
});

// Поиск торгового корабля (медленный)
const merchantId = this.findTargetByFilter(sub, context, {
    requireType: 'Ship',
    maxSpeedFilter: 15,
    requireDetectionLevel: DetectionState.ZONE_1_UNCERTAIN
});

// Поиск подводной лодки в радиусе 2000м
const subId = this.findTargetByFilter(ship, context, {
    requireType: 'Submarine',
    maxDistance: 2000,
    requireDetectionLevel: DetectionState.ZONE_1_UNCERTAIN
});

// Поиск ближайшего врага (любого типа) исключая конвой
const nearestEnemy = this.findTargetByFilter(ship, context, {
    excludeConvoy: true,
    requireDetectionLevel: DetectionState.ZONE_1_UNCERTAIN
});
```

**Возвращает:** ID найденной цели или `null`.

---

### 4. `calculateAngleToTarget()` - Расчет угла до цели

**Назначение:** Вычисляет угол до целевой позиции с учетом игровой координатной системы.

**Сигнатура:**
```typescript
protected calculateAngleToTarget(
    from: Vehicle,
    targetPos: Phaser.Math.Vector2
): { angleRad: number; angleDeg: number; diff: number }
```

**Пример использования:**
```typescript
const targetPos = new Phaser.Math.Vector2(enemy.x, enemy.y);
const angleInfo = this.calculateAngleToTarget(ship, targetPos);

console.log(`Угол до цели: ${angleInfo.angleDeg}°`);
console.log(`Разница с текущим курсом: ${angleInfo.diff}°`);

// Корректировка руля
if (Math.abs(angleInfo.diff) > 10) {
    ship.setRudder(angleInfo.diff > 0 ? 1 : -1);
}
```

**Возвращает:**
- `angleRad` - угол в радианах
- `angleDeg` - угол в градусах (с коррекцией для игровой системы)
- `diff` - разница между текущим направлением и целевым

---

### 5. `calculateEscapeDirection()` - Вычисление направления убегания

**Назначение:** Рассчитывает точку убегания в противоположном направлении от угрозы.

**Сигнатура:**
```typescript
protected calculateEscapeDirection(
    fromPos: Phaser.Math.Vector2,
    threatPos: Phaser.Math.Vector2,
    escapeDistance: number = 800
): { angle: number; point: Phaser.Math.Vector2; angleDeg: number }
```

**Пример использования:**
```typescript
const shipPos = new Phaser.Math.Vector2(ship.x, ship.y);
const threatPos = new Phaser.Math.Vector2(enemy.x, enemy.y);

// Убегаем на 1000м
const escapeInfo = this.calculateEscapeDirection(shipPos, threatPos, 1000);

// Устанавливаем waypoint
const logicalPos = CoordUtils.phaserToLogical(escapeInfo.point);
this.setManeuverWaypoint(ship, logicalPos.x, logicalPos.y);

AILogger.log(ship, this.name, "Escape", 
    `Evading at angle ${escapeInfo.angleDeg.toFixed(0)}°`);
```

**Возвращает:**
- `angle` - угол убегания в радианах
- `angleDeg` - угол убегания в градусах
- `point` - целевая точка убегания (Phaser координаты)

---

### 6. `calculateApproachDirection()` - Вычисление направления приближения

**Назначение:** Рассчитывает точку приближения к цели (прямо или под углом для скрытности).

**Сигнатура:**
```typescript
protected calculateApproachDirection(
    fromPos: Phaser.Math.Vector2,
    targetPos: Phaser.Math.Vector2,
    approachDistance: number = 500,
    angleOffset: number = 0 // 0 = прямо, Math.PI/2 = 90° для stealth
): { angle: number; point: Phaser.Math.Vector2; angleDeg: number }
```

**Примеры использования:**

```typescript
// Прямое приближение
const approach = this.calculateApproachDirection(
    new Phaser.Math.Vector2(sub.x, sub.y),
    new Phaser.Math.Vector2(target.x, target.y),
    500,
    0 // Прямо
);

// Stealth-приближение под углом 90°
const stealthApproach = this.calculateApproachDirection(
    new Phaser.Math.Vector2(sub.x, sub.y),
    new Phaser.Math.Vector2(target.x, target.y),
    500,
    Math.PI / 2 // 90° для скрытности
);

const logicalPos = CoordUtils.phaserToLogical(stealthApproach.point);
this.setManeuverWaypoint(sub, logicalPos.x, logicalPos.y);
```

**Возвращает:**
- `angle` - угол приближения в радианах
- `angleDeg` - угол приближения в градусах
- `point` - целевая точка приближения

---

### 7. `setManeuverWaypoint()` - Установка waypoint для маневра

**Назначение:** Устанавливает waypoint с автоматической очисткой предыдущих и стартом движения.

**Сигнатура:**
```typescript
protected setManeuverWaypoint(
    vehicle: Vehicle,
    x: number,
    y: number,
    type: number = Constants.WP_TYPE_MANEUVER,
    autoStart: boolean = true,
    clearPrevious: boolean = true
): void
```

**Примеры использования:**

```typescript
// Простая установка waypoint с автостартом
this.setManeuverWaypoint(ship, 1000, 2000);

// Установка без очистки предыдущих (добавление к маршруту)
this.setManeuverWaypoint(ship, 1000, 2000, Constants.WP_TYPE_SEARCH, true, false);

// Установка без автостарта
this.setManeuverWaypoint(ship, 1000, 2000, Constants.WP_TYPE_MANEUVER, false, true);
```

**Эквивалентно:**
```typescript
// Старый код (больше не нужен)
ship.clearWayPoints();
ship.addWayPoint(x, y, Constants.WP_TYPE_MANEUVER);
if (!ship.getIsMovingOnWayPoint()) {
    ship.startMoveOnWP();
}

// Новый код (одна строка)
this.setManeuverWaypoint(ship, x, y);
```

---

### 8. `fireTorpedoAtTarget()` - Выстрел торпедой с проверками

**Назначение:** Выполняет выстрел торпедой с полной проверкой всех условий (дистанция, угол, готовность оружия).

**Сигнатура:**
```typescript
protected fireTorpedoAtTarget(
    ship: Ship,
    target: Vehicle,
    weaponType: number,
    context: AIWorldContext,
    options: {
        predictLeadTime?: number;
        requireDistance?: number;
        requireAngle?: number;
        logAttempt?: boolean;
    } = {}
): Torpedo | null
```

**Примеры использования:**

```typescript
// Простой выстрел (используются значения по умолчанию из Settings)
const torpedo = this.fireTorpedoAtTarget(
    ship,
    enemy,
    Constants.WEAPON_SELECT_TORP_I,
    context
);

// Выстрел с упреждением (для движущихся целей)
const torpedo = this.fireTorpedoAtTarget(
    ship,
    enemy,
    Constants.WEAPON_SELECT_TORP_III,
    context,
    {
        predictLeadTime: 20, // Предсказать позицию через 20 сек
        requireDistance: 3000,
        requireAngle: 30
    }
);

// Выстрел без логирования попыток
const torpedo = this.fireTorpedoAtTarget(
    ship,
    enemy,
    Constants.WEAPON_SELECT_TORP_I,
    context,
    {
        logAttempt: false // Не логировать неудачные попытки
    }
);

// Проверка результата
if (torpedo) {
    // Выстрел успешен
    this.currentPhase = 'DISENGAGE';
} else {
    // Выстрел невозможен - продолжаем маневр
    this.adjustPositionForShot(ship, target, context);
}
```

**Автоматически проверяет:**
- Готовность оружия (`isWeaponReady`)
- Дистанцию до цели
- Угол атаки
- Предсказывает движение цели (если `predictLeadTime` задано)

**Автоматически логирует:**
- Причины неудачи (оружие не готово, слишком далеко, угол не подходит)
- Успешный выстрел с подробностями

**Возвращает:** Экземпляр торпеды или `null`.

---

## Пример рефакторинга MerchantShipStrategy

### Было (старый код):

```typescript
public analyzeStep(owner: Vehicle, context: AIWorldContext): void {
    if (!owner.active || !(owner instanceof Ship)) return;
    const ship = owner as Ship;
    
    // Логирование статуса (40 строк дублирующегося кода)
    const currentTime = context.gameTime;
    const lastLogTime = (ship as any).__lastAILogTime || 0;
    if (currentTime - lastLogTime > 5000) {
        (ship as any).__lastAILogTime = currentTime;
        AILogger.log(
            ship,
            this.name,
            "AI Status Report",
            `Health=${ship.getHealth()}, Power=${ship.getPower()}...`,
            LogLevel.INFO,
            {
                entityId: ship.id,
                strategy: this.name,
                health: ship.getHealth(),
                power: ship.getPower(),
                // ... еще 10 полей
            }
        );
    }
    
    // Проверка здоровья (15 строк)
    if (ship.getHealth() < 200 && ship.getPower() < Vehicle.POWER_4) {
        ship.setPower(Vehicle.POWER_4);
        AILogger.log(ship, this.name, "Increase Speed", 
            `Health low (${ship.getHealth()}), increasing speed.`, 
            LogLevel.WARN, { ...context });
    }
    
    this.findThreat(ship, context);
}
```

### Стало (новый код):

```typescript
public analyzeStep(owner: Vehicle, context: AIWorldContext): void {
    if (!owner.active || !(owner instanceof Ship)) return;
    const ship = owner as Ship;
    
    // Одна строка вместо 40
    this.logPeriodicStatus(ship, context, {
        currentThreat: this.threatId
    });
    
    // Одна строка вместо 15
    this.checkHealthAndAdjustSpeed(ship, context, 200, Vehicle.POWER_4);
    
    this.findThreat(ship, context);
}
```

### Метод убегания - Было:

```typescript
private escapeFromThreat(ship: Ship, threatInfo: any, context: AIWorldContext): void {
    if (!this.scene) return;
    
    const threatPos = this.lastKnownThreatPosition || 
                     new Phaser.Math.Vector2(threatInfo.targetVehicle.x, threatInfo.targetVehicle.y);
    
    // 20 строк вычислений угла убегания
    const angleToThreat = Phaser.Math.Angle.Between(ship.x, ship.y, threatPos.x, threatPos.y);
    const escapeAngleRad = angleToThreat + Math.PI;
    const escapeAngleDeg = (Phaser.Math.RadToDeg(escapeAngleRad) + 360) % 360;
    const escapeDistance = 800;
    const escapeX = ship.x + Math.cos(escapeAngleRad) * escapeDistance;
    const escapeY = ship.y + Math.sin(escapeAngleRad) * escapeDistance;
    
    // 10 строк установки waypoint
    const escapePhaserPos = new Phaser.Math.Vector2(escapeX, escapeY);
    const escapeLogicalPos = CoordUtils.phaserToLogical(escapePhaserPos);
    ship.clearWayPoints();
    ship.addWayPoint(escapeLogicalPos.x, escapeLogicalPos.y, Constants.WP_TYPE_MANEUVER);
    if (!ship.getIsMovingOnWayPoint()) {
        ship.startMoveOnWP();
    }
    
    // ...
}
```

### Стало:

```typescript
private escapeFromThreat(ship: Ship, threatInfo: any, context: AIWorldContext): void {
    if (!this.scene) return;
    
    const threatPos = this.lastKnownThreatPosition || 
                     new Phaser.Math.Vector2(threatInfo.targetVehicle.x, threatInfo.targetVehicle.y);
    const shipPos = new Phaser.Math.Vector2(ship.x, ship.y);
    
    // 2 строки вместо 20
    const escapeInfo = this.calculateEscapeDirection(shipPos, threatPos, 800);
    const escapeLogicalPos = CoordUtils.phaserToLogical(escapeInfo.point);
    
    // 1 строка вместо 10
    this.setManeuverWaypoint(ship, escapeLogicalPos.x, escapeLogicalPos.y);
    
    // ...
}
```

### Метод атаки - Было (75 строк):

```typescript
private attackInEmergency(ship: Ship, target: Vehicle, context: AIWorldContext): void {
    if (!this.scene || !(target instanceof Ship)) return;
    
    // Проверка готовности оружия
    const weaponReady = ship.isWeaponReady(Constants.WEAPON_SELECT_TORP_I);
    if (!weaponReady) {
        this.escapeFromThreat(ship, { targetVehicle: target }, context);
        return;
    }
    
    // 30 строк проверки дистанции и угла
    const targetTruePosition = targetShip.getTruePositionBeforeSensorEffects();
    const distanceToTarget = Phaser.Math.Distance.Between(ship.x, ship.y, targetTruePosition.x, targetTruePosition.y);
    const angleToTargetRad = Phaser.Math.Angle.Between(ship.x, ship.y, targetTruePosition.x, targetTruePosition.y);
    let angleToTargetDeg = (Phaser.Math.RadToDeg(angleToTargetRad) + 90 + 360) % 360;
    const diffAngle = Phaser.Math.Angle.ShortestBetween(ship.getDirection(), angleToTargetDeg);
    const distanceOk = distanceToTarget < Settings.TRP_I_DIST_EXECUTION;
    const angleOk = Math.abs(diffAngle) < Settings.TRP_ATACK__ANGLE_WARNING;
    
    if (distanceOk && angleOk) {
        // 45 строк выстрела и логирования
        const torpedo = this.scene.fireTorpedo(ship, Constants.WEAPON_SELECT_TORP_I, targetTruePosition.x, targetTruePosition.y);
        if (torpedo) {
            AILogger.log(ship, this.name, "Torpedo Fired", ...);
        } else {
            AILogger.log(ship, this.name, "Torpedo Fire Failed", ...);
        }
    } else {
        this.escapeFromThreat(ship, { targetVehicle: target }, context);
    }
}
```

### Стало (15 строк):

```typescript
private attackInEmergency(ship: Ship, target: Vehicle, context: AIWorldContext): void {
    if (!this.scene) return;
    
    // Одна функция делает ВСЕ проверки и логирование
    const torpedo = this.fireTorpedoAtTarget(
        ship,
        target,
        Constants.WEAPON_SELECT_TORP_I,
        context,
        {
            requireDistance: Settings.TRP_I_DIST_EXECUTION,
            requireAngle: Settings.TRP_ATACK__ANGLE_WARNING,
            logAttempt: false
        }
    );
    
    // Если не получилось - убегаем
    if (!torpedo) {
        this.escapeFromThreat(ship, { targetVehicle: target }, context);
    }
}
```

## Преимущества рефакторинга

### 📉 Уменьшение количества кода
- **MerchantShipStrategy**: с 407 строк до ~325 строк (-20%)
- **Устранение дублирования**: одинаковые функции были в 3+ стратегиях

### 🧹 Улучшение читаемости
- Вместо 40 строк логики видно **намерение** в одной строке
- Проще понять, что делает стратегия

### 🛠️ Упрощение создания новых стратегий
- Новые стратегии могут сразу использовать готовые функции
- Не нужно копировать-вставлять код из других стратегий

### 🐛 Единая точка исправления багов
- Баг в логике атаки торпедами? Исправляем в одном месте
- Все стратегии автоматически получают исправление

### ✅ Консистентность поведения
- Все стратегии логируют одинаково
- Одинаковые проверки во всех стратегиях

## Следующие шаги

1. ✅ Рефакторинг `MerchantShipStrategy`
2. 🔄 Рефакторинг `SilentHunterStrategy` (использовать `findTargetByFilter`, `fireTorpedoAtTarget`)
3. 🔄 Рефакторинг `DefaultShipStrategy` (использовать `fireTorpedoAtTarget`)
4. 🔄 Рефакторинг `AggressiveShipStrategy`
5. 📝 Обновление README_AI_STRATEGIES.md с новыми общими функциями

## Примеры для других стратегий

### SilentHunterStrategy - Поиск торговых целей

**Было:**
```typescript
private findTarget(sub: Submarine, context: AIWorldContext): void {
    let bestTarget: number | null = null;
    let minDistance = Infinity;

    for (const [id, info] of sub.perceivedTargets.entries()) {
        if (info.targetVehicle.active &&
            info.targetVehicle.getForces() !== sub.getForces() &&
            info.detectionState >= DetectionState.ZONE_1_UNCERTAIN &&
            info.targetVehicle instanceof Ship &&
            info.targetVehicle.getSpeed() < 15) {

            const distance = Phaser.Math.Distance.Between(sub.x, sub.y, info.targetVehicle.x, info.targetVehicle.y);
            if (distance < minDistance) {
                minDistance = distance;
                bestTarget = id;
            }
        }
    }
    this.targetId = bestTarget;
}
```

**Стало:**
```typescript
private findTarget(sub: Submarine, context: AIWorldContext): void {
    this.targetId = this.findTargetByFilter(sub, context, {
        requireType: 'Ship',
        maxSpeedFilter: 15, // Только медленные корабли (торговые)
        requireDetectionLevel: DetectionState.ZONE_1_UNCERTAIN
    });
}
```

---

## Итоги

Рефакторинг завершен успешно:
- ✅ 8 общих функций добавлено в `BaseAIStrategy`
- ✅ `MerchantShipStrategy` отрефакторен
- ✅ Код уменьшен на ~20%
- ✅ Нет ошибок линтера
- ✅ Документация создана

Теперь создание новых AI стратегий стало в разы проще! 🎉

