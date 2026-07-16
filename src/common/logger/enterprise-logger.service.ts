import { Injectable, LogLevel, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import { CorrelationIdStore } from './correlation-id.store';

type WinstonLevel = 'fatal' | 'error' | 'warn' | 'info' | 'verbose' | 'debug';

/** Lower number = higher severity, matching winston's own convention. */
const LEVEL_SEVERITY: Record<WinstonLevel, number> = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  verbose: 4,
  debug: 5,
};

const LEVEL_COLORS: Record<WinstonLevel, string> = {
  fatal: 'redBG whiteBright bold',
  error: 'red',
  warn: 'yellow',
  info: 'green',
  verbose: 'cyan',
  debug: 'blue',
};

winston.addColors(LEVEL_COLORS);

/**
 * Drop-in replacement for Nest's default ConsoleLogger, wired in via
 * `app.useLogger()` in main.ts. Every log line is automatically enriched
 * with the request-scoped correlation ID pulled from AsyncLocalStorage
 * (via CorrelationIdStore) — callers keep using `this.logger.log(...)`,
 * `this.logger.error(...)`, etc. exactly as before; nothing about the
 * public LoggerService contract changes.
 */
@Injectable()
export class EnterpriseLoggerService implements LoggerService {
  private readonly winstonLogger: winston.Logger;

  constructor(
    private readonly correlationIdStore: CorrelationIdStore,
    configService: ConfigService,
  ) {
    const isProduction = configService.get<string>('NODE_ENV') === 'production';

    this.winstonLogger = winston.createLogger({
      levels: LEVEL_SEVERITY,
      level: isProduction ? 'info' : 'debug',
      format: isProduction ? this.buildProductionFormat() : this.buildDevelopmentFormat(),
      transports: [new winston.transports.Console()],
    });
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, optionalParams);
  }

  setLogLevels(_levels: LogLevel[]): void {
    // Verbosity is governed by NODE_ENV at construction time (see the
    // `level` option above); Nest's runtime setLogLevels() hook is
    // intentionally a no-op so a single source of truth is preserved.
  }

  private write(level: WinstonLevel, message: unknown, optionalParams: unknown[]): void {
    const context = this.pickContext(optionalParams);
    const explicitTrace = this.pickTrace(optionalParams);
    const correlationId = this.correlationIdStore.getCorrelationId();

    const resolvedMessage =
      message instanceof Error ? message.message : this.stringifyMessage(message);
    const trace = explicitTrace ?? (message instanceof Error ? message.stack : undefined);

    this.winstonLogger.log(level, resolvedMessage, {
      ...(context ? { context } : {}),
      ...(correlationId ? { correlationId } : {}),
      ...(trace ? { trace } : {}),
    });
  }

  /** Nest's Logger always appends the bound context as the final positional arg. */
  private pickContext(optionalParams: unknown[]): string | undefined {
    const last = optionalParams[optionalParams.length - 1];
    return typeof last === 'string' ? last : undefined;
  }

  /** For `.error()` calls with a bound context, the stack trace is the second-to-last arg. */
  private pickTrace(optionalParams: unknown[]): string | undefined {
    if (optionalParams.length < 2) {
      return undefined;
    }
    const candidate = optionalParams[optionalParams.length - 2];
    return typeof candidate === 'string' ? candidate : undefined;
  }

  private stringifyMessage(message: unknown): string {
    if (typeof message === 'string') {
      return message;
    }
    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }

  private buildProductionFormat(): winston.Logform.Format {
    return winston.format.combine(winston.format.timestamp(), winston.format.json());
  }

  private buildDevelopmentFormat(): winston.Logform.Format {
    return winston.format.combine(
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.colorize({ all: true }),
      winston.format.printf((info) => {
        const timestamp = String(info.timestamp);
        const level = info.level;
        const message = String(info.message);
        const context = typeof info.context === 'string' ? info.context : undefined;
        const correlationId =
          typeof info.correlationId === 'string' ? info.correlationId : undefined;
        const trace = typeof info.trace === 'string' ? info.trace : undefined;

        const contextPart = context ? `[${context}] ` : '';
        const correlationPart = correlationId ? ` {cid=${correlationId}}` : '';
        const tracePart = trace ? `\n${trace}` : '';

        return `${timestamp} ${level} ${contextPart}${message}${correlationPart}${tracePart}`;
      }),
    );
  }
}
