// Simple logger utility that can be extended with more features as needed

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

type LogContext = Record<string, unknown> & {
  timestamp?: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
};

class Logger {
  private static instance: Logger;
  private minLevel: LogLevel = 'info';

  private constructor() {
    // Initialize logger with any required setup
    if (process.env.NODE_ENV === 'development') {
      this.minLevel = 'debug';
    }
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    };
    return levels[level] <= levels[this.minLevel];
  }

  private log(level: LogLevel, message: string, context: Record<string, unknown> = {}) {
    if (!this.shouldLog(level)) return;

    const logEntry: LogContext = {
      ...context,
      level,
      message,
      timestamp: new Date().toISOString(),
    };

    // In development, log to console with colors
    if (process.env.NODE_ENV === 'development') {
      const { timestamp, level, message, ...rest } = logEntry;
      const color = {
        error: '\x1b[31m', // red
        warn: '\x1b[33m', // yellow
        info: '\x1b[36m', // cyan
        debug: '\x1b[90m', // gray
      }[level];
      
      console[level === 'debug' ? 'debug' : level](
        `${color}[${timestamp}] ${level.toUpperCase()}: ${message}\x1b[0m`,
        Object.keys(rest).length ? rest : ''
      );
      return;
    }

    // In production, log as JSON
    console[level === 'debug' ? 'log' : level](JSON.stringify(logEntry));
  }

  public error(message: string, context: Record<string, unknown> = {}) {
    this.log('error', message, context);
  }

  public warn(message: string, context: Record<string, unknown> = {}) {
    this.log('warn', message, context);
  }

  public info(message: string, context: Record<string, unknown> = {}) {
    this.log('info', message, context);
  }

  public debug(message: string, context: Record<string, unknown> = {}) {
    this.log('debug', message, context);
  }
}

export const logger = Logger.getInstance();
