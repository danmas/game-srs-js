# Логирование на сервер

Этот документ описывает, как работает система логирования игры на сервер.

## Обзор

Система логирования позволяет:
- Дублировать все логи из браузера на сервер
- Сохранять логи в файлы по датам
- Просматривать логи через API сервера


## Структура логов

Логи сохраняются в папку `logs` в корне проекта. Каждый файл логов именуется по дате и времени запуска сервера: `YYYY-MM-DD_HH-MM-SS.log`.

Формат записи логов:
```
[TIMESTAMP] [TAG] [LEVEL] MESSAGE | Context: {...}
```

Где:
- `TIMESTAMP` - ISO строка времени (2025-10-30T08:41:34.348Z)
- `TAG` - Категория лога (например, AI_DECISION_Vehicle 1, AI_CONTEXT_0)
- `LEVEL` - Уровень логирования (TRACE, DEBUG, INFO, WARN, ERROR)
- `MESSAGE` - Текст сообщения
- `Context` - Дополнительный структурированный контекст (JSON, опционально)

Пример:
```
[2025-10-30T08:41:34.348Z] [AI_Vehicle 1] [INFO] Strategy changed to Торговый Корабль | Context: {"entityId":1,"entityType":"Vehicle","newStrategy":"Торговый Корабль","oldStrategy":"unknown"}
```

## API для работы с логами

Сервер предоставляет следующие API для работы с логами:

### Отправка логов

```
POST /api/logs
Content-Type: application/json

{
  "message": "Текст сообщения",
  "tag": "Категория (например, AI, PHYSICS)",
  "level": "Уровень (INFO, WARN, ERROR, DEBUG)",
  "timestamp": "ISO-строка времени"
}
```

### Получение списка файлов логов

```
GET /api/logs/files
```

Возвращает массив имен файлов логов, отсортированных по дате (новые сверху).

### Получение содержимого файла логов

```
GET /api/logs/file/:filename
```

Возвращает содержимое файла лога в текстовом формате.

## Интеграция с UniversalLogger

Класс `UniversalLogger` автоматически отправляет все логи на сервер. Для логирования используйте:

```typescript
import { UniversalLogger, LogLevel } from './utils/UniversalLogger';

// Базовое логирование
UniversalLogger.log("Сообщение", "TAG", LogLevel.INFO);

// Логирование ошибок
UniversalLogger.error("Ошибка", "ERROR_TAG");

// Логирование предупреждений
UniversalLogger.warn("Предупреждение", "WARN_TAG");

// Отладочное логирование
UniversalLogger.debug("Отладочное сообщение", "DEBUG_TAG");

// Логирование с контекстом
UniversalLogger.log("Сообщение", "TAG", LogLevel.INFO, {
    entityId: 1,
    position: { x: 100, y: 200 },
    health: 150
});
```

## Интеграция с AILogger

Класс `AILogger` также отправляет логи на сервер через `UniversalLogger`. Для логирования решений ИИ используйте:

```typescript
import { AILogger } from './utils/AILogger';
import { LogLevel } from './utils/UniversalLogger';

// Базовое логирование решения
AILogger.log(vehicle, "StrategyName", "Decision", "Reason");

// Логирование с контекстом
AILogger.log(vehicle, "Стандартный Боевой ИИ", "Fire Torpedo I at Target 5", 
    "Target in range (250) and angle is good (5.2°).", 
    LogLevel.INFO, 
    { 
        dist: 250, 
        angle: 5.2, 
        targetId: 5 
    }
);

// Логирование смены стратегии
AILogger.changeLogContext(vehicle, "Торговый Корабль", "Стандартный Боевой ИИ");
```

## Что логируется для оценки стратегий ИИ

Система логирует следующие данные для анализа качества стратегий:

#### Решения стратегий
- **Принятые решения**: Что решил ИИ (например, "Fire Torpedo I", "Evade Threat", "Acquire Target")
- **Причины решений**: Почему было принято решение (например, "Target in range", "Health low")
- **Контекст ситуации**: Позиции объектов, здоровье, обнаруженные цели, состояние оружия

#### Контекст игры
- Позиция и направление объекта
- Скорость движения
- Здоровье корабля
- Обнаруженные цели (ID, тип, состояние обнаружения, позиция)
- Текущая цель атаки
- Время игры

#### Результаты действий (логируется автоматически)
- **Попадания торпед**: ID торпеды, цель, урон, здоровье до/после попадания
- **Промахи торпед**: ID торпеды, время жизни, пройденное расстояние
- **Изменение здоровья**: Урон, здоровье до/после, изменение скорости
- **Уничтожение кораблей**: ID корабля, финальное здоровье, стратегия, атакующий
- **Запуск торпед**: ID торпеды, цель, позиция цели

#### Примеры логируемых событий
- Изменение стратегии
- Приобретение/потеря цели
- Попытки атаки (с причинами отказа: оружие не готово, цель слишком далеко, угол плохой)
- Управление скоростью (увеличение при низком здоровье)
- Движение по маршрутам (WayPoints)
- Попадания/промахи торпед
- Изменение здоровья кораблей
- Уничтожение кораблей

### Примеры логов результатов действий

```
[2025-10-30T08:42:15.123Z] [TORPEDO_HIT] [INFO] Torpedo hit target Ship 5 for 150 damage | Context: {"torpedoId":10,"targetShipId":5,"weaponType":"Torpedo I","firedByShipId":1,"damage":150,"targetHealthBefore":300,"distance":"245.67"}

[2025-10-30T08:42:15.124Z] [SHIP_DAMAGE] [WARN] Ship 5 received 150 damage (300 -> 150) | Context: {"shipId":5,"attackerId":1,"damage":150,"healthBefore":300,"healthAfter":150}

[2025-10-30T08:42:20.456Z] [TORPEDO_MISS] [DEBUG] Torpedo expired without hitting target (lifeTime: 30s) | Context: {"torpedoId":11,"weaponType":"Torpedo I","firedByShipId":2,"distanceTraveled":850}

[2025-10-30T08:42:25.789Z] [SHIP_DESTROYED] [ERROR] Ship 5 destroyed | Context: {"shipId":5,"finalHealth":0,"attackerId":1,"strategy":"Стандартный Боевой ИИ"}
```

## Примечания

- Если сервер недоступен, логи всё равно сохраняются в localStorage браузера
- Логи из localStorage можно скачать через `UniversalLogger.downloadLogs()`
- Для очистки логов в localStorage используйте `UniversalLogger.clearLogs()`
- Логи дросселируются: одинаковые решения не логируются повторно до изменения состояния
- Минимальный уровень логирования можно настроить через `UniversalLogger.updateSettings({ minLevel: LogLevel.DEBUG })`
