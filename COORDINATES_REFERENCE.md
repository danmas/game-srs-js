# 🧭 Справочник: Навигационная Система Координат

## ⚠️ КРИТИЧЕСКИ ВАЖНО

**Silent Red Storm использует НАВИГАЦИОННУЮ систему координат, НЕ математическую!**

---

## Быстрая Шпаргалка

### Направления

```
        0° ⬆️ (Север/Вверх)
        |
270° ⬅️ + ➡️ 90° (Запад/Влево | Восток/Вправо)
        |
      180° ⬇️ (Юг/Вниз)
```

---

## Правильный Код

### ✅ Расчет Вектора Движения

```typescript
const direction = vehicle.getDirection(); // Градусы (0-360)
const directionRad = Phaser.Math.DegToRad(direction); // Радианы

// НАВИГАЦИОННАЯ система:
const velocityX = Math.sin(directionRad) * speed;  // X = sin
const velocityY = -Math.cos(directionRad) * speed; // Y = -cos (МИНУС!)
```

### ✅ Расчет Упреждения

```typescript
const targetDir = target.getDirection(); // Градусы
const targetDirRad = Phaser.Math.DegToRad(targetDir);
const travelDist = target.getSpeed() * predictTime / 60;

const predictX = target.x + Math.sin(targetDirRad) * travelDist;
const predictY = target.y - Math.cos(targetDirRad) * travelDist; // МИНУС!
```

---

## Частые Ошибки

### ❌ Ошибка 1: Градусы как Радианы

```typescript
// НЕПРАВИЛЬНО:
const x = ship.x + Math.sin(direction) * distance;

// ПРАВИЛЬНО:
const dirRad = Phaser.Math.DegToRad(direction);
const x = ship.x + Math.sin(dirRad) * distance;
```

### ❌ Ошибка 2: Математическая Система

```typescript
// НЕПРАВИЛЬНО (0° = вправо):
const x = ship.x + Math.cos(dirRad) * distance;
const y = ship.y + Math.sin(dirRad) * distance;

// ПРАВИЛЬНО (0° = вверх):
const x = ship.x + Math.sin(dirRad) * distance;
const y = ship.y - Math.cos(dirRad) * distance;
```

### ❌ Ошибка 3: Забыли Минус

```typescript
// НЕПРАВИЛЬНО:
const y = ship.y + Math.cos(dirRad) * distance;

// ПРАВИЛЬНО:
const y = ship.y - Math.cos(dirRad) * distance; // МИНУС!
```

---

## Таблица Проверки

| Курс | sin(rad) | -cos(rad) | Вектор (X,Y) | Направление |
|------|----------|-----------|--------------|-------------|
| 0°   | 0        | -1        | (0, -1)      | ⬆️ Вверх    |
| 90°  | 1        | 0         | (1, 0)       | ➡️ Вправо   |
| 180° | 0        | 1         | (0, 1)       | ⬇️ Вниз     |
| 270° | -1       | 0         | (-1, 0)      | ⬅️ Влево    |

---

## Полезные Функции

```typescript
// Угол между точками (радианы, математическая)
const angleRad = Phaser.Math.Angle.Between(x1, y1, x2, y2);

// Радианы → Градусы
const angleDeg = Phaser.Math.RadToDeg(angleRad);

// Градусы → Радианы
const angleRad = Phaser.Math.DegToRad(angleDeg);

// Кратчайший угол между направлениями
const diff = Phaser.Math.Angle.ShortestBetween(current, target);

// Нормализация к 0-360
const normalized = (angle + 360) % 360;

// Математическая → Навигационная
const angleNav = (angleMath + 90 + 360) % 360;
```

---

## Примеры из Реального Кода

### SilentHunterStrategy - Прицеливание

```typescript
// src/ai/strategies/SilentHunterStrategy.ts
const targetDir = target.getDirection(); // В градусах
const targetDirRad = Phaser.Math.DegToRad(targetDir); // Конвертация

const predictTime = 20;
const targetTravelDist = (target.getSpeed() * predictTime / 60);

// ПРАВИЛЬНЫЙ расчет с навигационной системой
const predictX = target.x + Math.sin(targetDirRad) * targetTravelDist;
const predictY = target.y - Math.cos(targetDirRad) * targetTravelDist;

this.scene.fireTorpedo(sub, weaponType, predictX, predictY);
```

### Vehicle - Физика Движения

```typescript
// src/objects/Vehicle.ts - updatePhysics()
if (currentSpeed > 0) {
  this.velocity.setTo(0, -currentSpeed); // Вверх (0°)
  this.velocity.rotate(Phaser.Math.DegToRad(this.direction)); // Поворот
}
```

---

## Дополнительная Документация

- **README_AI_STRATEGIES.md** - Полная документация для разработчиков стратегий
- **README_GAME_AI.md** - Подробное описание AI и физики игры

---

**Версия:** 1.0  
**Дата:** 2025-10-30  
**Статус:** Критически важная информация для всех разработчиков AI

