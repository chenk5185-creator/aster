/**
 * Retry utility with exponential backoff
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  factor?: number;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    factor = 2,
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      if (attempt === maxRetries) {
        throw lastError;
      }

      console.log(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed: ${lastError.message}. Retrying in ${delay}ms...`);

      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * factor, maxDelay);
    }
  }

  throw lastError!;
}

/**
 * Logger utility with timestamp
 */
export class Logger {
  constructor(private prefix: string) {}

  info(message: string, ...args: any[]) {
    console.log(`[${new Date().toISOString()}] [${this.prefix}] INFO:`, message, ...args);
  }

  warn(message: string, ...args: any[]) {
    console.warn(`[${new Date().toISOString()}] [${this.prefix}] WARN:`, message, ...args);
  }

  error(message: string, ...args: any[]) {
    console.error(`[${new Date().toISOString()}] [${this.prefix}] ERROR:`, message, ...args);
  }

  success(message: string, ...args: any[]) {
    console.log(`[${new Date().toISOString()}] [${this.prefix}] ✅:`, message, ...args);
  }
}
