type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: Error;
}

interface LoggerConfig {
  level: LogLevel;
  format: "json" | "text";
  service: string;
  version: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getConfig(): LoggerConfig {
  return {
    level: (process.env.LOG_LEVEL as LogLevel) || "info",
    format: (process.env.LOG_FORMAT as "json" | "text") || "json",
    service: "returns-hub",
    version: process.env.npm_package_version || "0.1.0",
  };
}

function shouldLog(level: LogLevel): boolean {
  const config = getConfig();
  return LOG_LEVELS[level] >= LOG_LEVELS[config.level];
}

function formatError(error: Error): Record<string, unknown> {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack?.split("\n").slice(0, 5),
  };
}

function formatEntry(entry: LogEntry): string {
  const config = getConfig();

  const base = {
    timestamp: entry.timestamp,
    level: entry.level,
    service: config.service,
    version: config.version,
    message: entry.message,
    ...entry.context,
    ...(entry.error && { error: formatError(entry.error) }),
  };

  if (config.format === "json") {
    return JSON.stringify(base);
  }

  const contextStr = entry.context
    ? ` ${Object.entries(entry.context)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(" ")}`
    : "";

  const errorStr = entry.error ? ` error="${entry.error.message}"` : "";

  return `[${entry.timestamp}] ${entry.level.toUpperCase()} ${entry.message}${contextStr}${errorStr}`;
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error) {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
    error,
  };

  const formatted = formatEntry(entry);

  switch (level) {
    case "debug":
      console.debug(formatted);
      break;
    case "info":
      console.info(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    case "error":
      console.error(formatted);
      break;
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => log("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => log("info", message, context),
  warn: (message: string, context?: Record<string, unknown>, error?: Error) =>
    log("warn", message, context, error),
  error: (message: string, context?: Record<string, unknown>, error?: Error) =>
    log("error", message, context, error),

  withContext: (baseContext: Record<string, unknown>) => ({
    debug: (message: string, context?: Record<string, unknown>) =>
      log("debug", message, { ...baseContext, ...context }),
    info: (message: string, context?: Record<string, unknown>) =>
      log("info", message, { ...baseContext, ...context }),
    warn: (message: string, context?: Record<string, unknown>, error?: Error) =>
      log("warn", message, { ...baseContext, ...context }, error),
    error: (message: string, context?: Record<string, unknown>, error?: Error) =>
      log("error", message, { ...baseContext, ...context }, error),
  }),

  request: (method: string, path: string, context?: Record<string, unknown>) => {
    log("info", `${method} ${path}`, { type: "request", method, path, ...context });
  },

  response: (method: string, path: string, status: number, durationMs: number) => {
    log("info", `${method} ${path} ${status}`, {
      type: "response",
      method,
      path,
      status,
      durationMs,
    });
  },

  webhook: (topic: string, shop: string, context?: Record<string, unknown>) => {
    log("info", `Webhook: ${topic}`, { type: "webhook", topic, shop, ...context });
  },

  returnRequest: (action: string, returnId: string, context?: Record<string, unknown>) => {
    log("info", `Return ${action}: ${returnId}`, { type: "return", action, returnId, ...context });
  },
};

export type Logger = typeof logger;
