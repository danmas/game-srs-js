import Phaser from 'phaser';
import { MainScene } from './scenes/MainScene';
import { Settings } from './utils/Settings';

// Логируем версию сборки в консоль браузера
console.log(`%c🚀 Silent Red Storm ${BUILD_VERSION}`, 'color: #4CAF50; font-weight: bold; font-size: 14px;');
console.log(`📦 Build Timestamp: ${BUILD_TIMESTAMP}`);
console.log(`%c⚠️ Если торпеды стреляют неправильно - проверь что используется эта версия!`, 'color: #FF9800; font-weight: bold;');

// Создаем стили для контейнера игры и страницы
document.body.style.backgroundColor = '#333333'; // Темно-серый для всей страницы
const styleElement = document.createElement('style');
styleElement.textContent = `
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden; /* Предотвратить полосы прокрутки */
  }
  #game-container {
    width: 100%;
    height: 100%;
    /* display: flex; justify-content: center; align-items: center; */ /* Уже не обязательно для 100% */
  }
  canvas {
    display: block; /* Убирает возможный небольшой отступ снизу у canvas */
    /* background-color: #0000FF !important; */ /* Фон сцены должен управлять этим */
  }
`;
document.head.appendChild(styleElement);

// Конфигурация игры
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: '100%', // Растягиваем на всю ширину родителя
  height: '100%', // Растягиваем на всю высоту родителя
  // backgroundColor: '#0000FF', // Фон сцены должен быть установлен в MainScene
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.RESIZE, // Режим масштабирования для изменения размера холста
    autoCenter: Phaser.Scale.CENTER_BOTH // Центрирование холста, если он не занимает все пространство (здесь займет)
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: Settings.DEBUG
    }
  },
  scene: [MainScene],
  render: {
    pixelArt: false,
    antialias: true,
    // transparent: false, // Пусть сцена решает прозрачность своего фона
  }
};

// Создаем игру
const game = new Phaser.Game(config);

// Экспортируем для доступа из других модулей
export default game; 