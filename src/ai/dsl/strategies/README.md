# DSL Стратегии

Эта директория содержит YAML файлы с описаниями DSL стратегий для ИИ объектов игры.

## Структура

Каждый файл в этой директории представляет собой отдельную стратегию. Имя файла (без расширения `.yaml`) используется как идентификатор стратегии.

## Использование

### Загрузка и назначение стратегии

```typescript
import { AIStrategyFactory } from '../strategies/AIStrategyFactory';

// Асинхронная загрузка и назначение стратегии по имени файла
await AIStrategyFactory.assignDSLStrategy('merchant_ship', ship, scene);

// Или загрузить стратегию заранее
await AIStrategyFactory.loadDSLStrategy('aggressive_hunter');
// Затем назначить синхронно через обычный метод
AIStrategyFactory.assignStrategy('aggressive_hunter', submarine, scene);
```

### Загрузка нескольких стратегий

```typescript
// Загрузить все необходимые стратегии заранее
await AIStrategyFactory.loadDSLStrategies([
  'merchant_ship',
  'aggressive_hunter',
  'defensive_patrol'
]);
```

### Проверка доступных стратегий

```typescript
// Получить список всех доступных стратегий (включая DSL и TypeScript)
const allStrategies = AIStrategyFactory.getAvailableStrategies();
console.log('Доступные стратегии:', allStrategies);
```

## Формат файлов

Каждый YAML файл должен содержать:

- `strategy` - имя стратегии (используется для идентификации)
- `description` - описание стратегии
- `ON ANALYZE` - блок анализа (поиск целей, оценка ситуации)
- `ON ACTION` - блок действий (принятие решений и выполнение команд)

### Пример

```yaml
strategy: "Торговый корабль"
description: "Движется по курсу, уклоняясь от торпед."

ON ANALYZE:
  - FIND:
      nearest_torpedo:
        type: torpedo
        range: 1500
        detection_zone: 1

ON ACTION:
  IF:
    condition: nearest_torpedo IS_PRESENT
    actions:
      - Action:
          EVADE:
            from: nearest_torpedo
            distance: 1000
            power: 6
  ELSE:
    actions:
      - Action:
          PATROL:
            power: 3
```

## Доступные стратегии

### merchant_ship.yaml
**Торговый корабль** - движется по курсу, уклоняясь от торпед.

### aggressive_hunter.yaml
**Агрессивный охотник** - атакует ближайшие цели, активно преследует противника.

## Добавление новых стратегий

1. Создайте новый YAML файл в этой директории
2. Используйте имя файла как идентификатор стратегии
3. Стратегия будет автоматически доступна после загрузки через `AIStrategyFactory.assignDSLStrategy()`

## Примечания

- Файлы стратегий копируются в `dist/ai/dsl/strategies/` при сборке проекта
- Стратегии кэшируются после первой загрузки
- Используйте асинхронные методы для загрузки стратегий из файлов
- Синхронные методы работают только с уже загруженными стратегиями

