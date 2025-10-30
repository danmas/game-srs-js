declare module 'phaser';

// Глобальные переменные сборки (инжектируются webpack.DefinePlugin)
declare const BUILD_VERSION: string;
declare const BUILD_TIMESTAMP: string;

// Глобальные расширения типов
interface Window {
  game: Phaser.Game;
} 