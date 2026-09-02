// logger.ts — 进度日志工具
// 提供彩色控制台输出和文件日志记录
import * as fs from 'fs/promises';
import * as path from 'path';

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
}

const COLORS: Record<LogLevel, string> = {
  info: '\x1b[36m',     // cyan
  warn: '\x1b[33m',     // yellow
  error: '\x1b[31m',    // red
  debug: '\x1b[90m',    // gray
  success: '\x1b[32m',  // green
};

const RESET = '\x1b[0m';

export class Logger {
  private logFile: string | null;
  private entries: LogEntry[] = [];
  private verbose: boolean;

  constructor(logDir?: string, verbose: boolean = true) {
    this.verbose = verbose;
    if (logDir) {
      this.logFile = path.join(logDir, `pipeline_${Date.now()}.log`);
      fs.mkdir(logDir, { recursive: true }).catch(() => {});
    } else {
      this.logFile = null;
    }
  }

  log(level: LogLevel, message: string, context?: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };
    this.entries.push(entry);

    if (this.verbose) {
      const color = COLORS[level];
      const prefix = level.toUpperCase().padEnd(7);
      const ctx = context ? ` [${context}]` : '';
      console.log(`${color}${prefix}${RESET} ${message}${ctx}`);
    }

    // Write to file asynchronously
    if (this.logFile) {
      const line = `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${message}${context ? ` [${context}]` : ''}\n`;
      fs.appendFile(this.logFile, line).catch(() => {});
    }
  }

  info(message: string, context?: string): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: string): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: string): void {
    this.log('error', message, context);
  }

  debug(message: string, context?: string): void {
    if (this.verbose) {
      this.log('debug', message, context);
    }
  }

  success(message: string, context?: string): void {
    this.log('success', message, context);
  }

  // Progress bar
  progress(current: number, total: number, label?: string): void {
    if (!this.verbose) return;
    const percentage = Math.round((current / total) * 100);
    const barLength = 30;
    const filled = Math.round((current / total) * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
    process.stdout.write(`\r${COLORS.info}PROGRESS${RESET} [${bar}] ${percentage}% ${label || ''}`);
    if (current >= total) {
      process.stdout.write('\n');
    }
  }

  // Get all log entries
  getEntries(): LogEntry[] {
    return this.entries;
  }

  // Save log summary
  async saveSummary(outputPath: string): Promise<void> {
    const summary = {
      start_time: this.entries[0]?.timestamp,
      end_time: this.entries[this.entries.length - 1]?.timestamp,
      total_entries: this.entries.length,
      errors: this.entries.filter(e => e.level === 'error').length,
      warnings: this.entries.filter(e => e.level === 'warn').length,
      entries: this.entries,
    };
    await fs.writeFile(outputPath, JSON.stringify(summary, null, 2));
  }

  // Section separator
  section(title: string): void {
    if (this.verbose) {
      console.log(`\n${COLORS.info}════════════════════════════════════════${RESET}`);
      console.log(`${COLORS.info}  ${title}${RESET}`);
      console.log(`${COLORS.info}════════════════════════════════════════${RESET}\n`);
    }
  }
}

// Singleton logger
let globalLogger: Logger | null = null;

export function getLogger(logDir?: string, verbose?: boolean): Logger {
  if (!globalLogger) {
    globalLogger = new Logger(logDir, verbose);
  }
  return globalLogger;
}

export function setLogger(logger: Logger): void {
  globalLogger = logger;
}
