export enum DetectionState {
  NO_CONTACT,             // Нет контакта
  ZONE_1_UNCERTAIN,       // Зона 1: Неопределенный контакт, примерное направление
  ZONE_2_LOCALIZED,       // Зона 2: Точное местоположение, неизвестен тип/курс/скорость
  ZONE_3_IDENTIFIED,      // Зона 3: Полная информация
} 