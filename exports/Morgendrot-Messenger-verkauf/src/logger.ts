import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import fs from 'fs';
import { CFG } from './config.js';

if (CFG.ENABLE_FILE_LOGGING && !fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}

const transports: winston.transport[] = [new winston.transports.Console()];
if (CFG.ENABLE_FILE_LOGGING) {
  if (CFG.LOG_MAX_FILES > 0) {
    transports.push(
      new DailyRotateFile({
        filename: 'logs/morgendrot-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: CFG.LOG_MAX_SIZE,
        maxFiles: String(CFG.LOG_MAX_FILES),
      })
    );
  } else {
    transports.push(new winston.transports.File({ filename: 'logs/morgendrot.log' }));
  }
}

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.printf((info) => {
      const { timestamp, level, message } = info;
      return `${timestamp} [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports,
});
