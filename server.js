const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3101;

// --- Генерация имени файла лога при старте сервера ---
const getLogFileName = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}.log`;
};
const logFileName = getLogFileName();
// ----------------------------------------------------

// Папка для хранения логов
const LOGS_DIR = path.join(__dirname, 'logs');

// Создаем папку для логов, если её нет
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR);
  console.log(`Создана папка для логов: ${LOGS_DIR}`);
}

// Разрешаем CORS для локальной разработки
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:8081', 'http://127.0.0.1:8080', 'http://127.0.0.1:8081'],
  credentials: true
}));

// Логирование всех запросов
app.use((req, res, next) => {
  // console.log(`${new Date().toISOString()} [${req.method}] ${req.url}`);
  next();
});

// Разрешаем обработку JSON
app.use(express.json());

// Обработчик для логов
app.post('/api/logs', (req, res) => {
  // console.log('Получен запрос на сохранение лога:', req.method, req.url);
  // console.log('Заголовки:', JSON.stringify(req.headers, null, 2));
  
  const { message, tag, level, timestamp, context } = req.body;
  
  // Проверка обязательных полей
  if (!message) {
    console.error('Ошибка: отсутствует обязательное поле message');
    return res.status(400).send('Отсутствует обязательное поле message');
  }
  
  // Используем имя файла, сгенерированное при старте сервера
  const filePath = path.join(LOGS_DIR, logFileName);
  
  // Формируем строку лога
  let logEntry = `[${timestamp || new Date().toISOString()}] [${tag || 'LOG'}] [${level || 'INFO'}] ${message}`;

  // Добавляем контекст, если он есть и не пустой
  if (context && Object.keys(context).length > 0) {
    try {
      // Преобразуем контекст в удобочитаемый JSON
      const contextString = JSON.stringify(context, null, 2);
      // Добавляем к записи лога, убирая лишние переносы строк для компактности
      logEntry += ` | Context: ${contextString.replace(/\n/g, '')}`;
    } catch (e) {
      logEntry += ` | Context: (serialization error)`;
    }
  }
  logEntry += '\n'; // Добавляем перенос строки в конце
  
  // Записываем в файл (добавляем в конец)
  fs.appendFile(filePath, logEntry, (err) => {
    if (err) {
      console.error('Ошибка при записи лога:', err);
      return res.status(500).send('Ошибка при сохранении лога');
    }
    
    console.log(`Лог сохранен: ${tag || 'LOG'} - ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
    res.status(200).send('Лог сохранен');
  });
});

// Эндпоинт для получения списка файлов логов
app.get('/api/logs/files', (req, res) => {
  fs.readdir(LOGS_DIR, (err, files) => {
    if (err) {
      console.error('Ошибка при чтении директории логов:', err);
      return res.status(500).send('Ошибка при получении списка логов');
    }
    
    // Фильтруем только .log файлы и сортируем по дате (новые сверху)
    const logFiles = files
      .filter(file => file.endsWith('.log'))
      .sort()
      .reverse();
    
    res.json(logFiles);
  });
});

// Эндпоинт для получения содержимого файла лога
app.get('/api/logs/file/:filename', (req, res) => {
  const fileName = req.params.filename;
  const filePath = path.join(LOGS_DIR, fileName);
  
  // Проверяем, что файл существует и находится в папке логов
  if (!fileName.endsWith('.log') || fileName.includes('..')) {
    return res.status(400).send('Некорректное имя файла');
  }
  
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Ошибка при чтении файла лога:', err);
      return res.status(404).send('Файл лога не найден');
    }
    
    res.type('text/plain').send(data);
  });
});

// Статические файлы из папки dist
app.use(express.static(path.join(__dirname, 'dist')));

// Маршрут для всех остальных запросов - отдаем index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Запускаем сервер
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`Логи сохраняются в ${LOGS_DIR}`);
  console.log(`Игра доступна по адресу: http://localhost:${PORT}`);
});
