import axios from 'axios';

export interface ClientOptions {
  baseURL: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
}

/**
 * HTTP client for accessing protected APIs
 */
export class AccessTrafficClient {
  private readonly axios: any;
  private apiKey?: string;
  private retries: number;
  private retryDelay: number;

  constructor(options: ClientOptions) {
    this.apiKey = options.apiKey;
    this.retries = options.retries || 3;
    this.retryDelay = options.retryDelay || 1000;

    this.axios = axios.create({
      baseURL: options.baseURL,
      timeout: options.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
        ...(this.apiKey && { 'x-api-key': this.apiKey }),
      },
    });

    // Add request interceptor for logging
    this.axios.interceptors.request.use(
      (config: any) => {
        console.debug(`🚀 ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error: any) => {
        console.error('❌ Request error:', error);
        return Promise.reject(error);
      },
    );

    // Add response interceptor for logging
    this.axios.interceptors.response.use(
      (response: any) => {
        console.debug(`✅ ${response.status} ${response.config.url}`);
        return response;
      },
      (error: any) => {
        console.error(
          `❌ ${error.response?.status || 'Network'} ${error.config?.url}`,
        );
        return Promise.reject(error);
      },
    );
  }

  /**
   * Perform GET request
   */
  async get<T = any>(
    url: string,
    options?: { headers?: Record<string, string> },
  ): Promise<any> {
    return this.request('GET', url, undefined, options);
  }

  /**
   * Perform POST request
   */
  async post<T = any>(
    url: string,
    data?: any,
    options?: { headers?: Record<string, string> },
  ): Promise<any> {
    return this.request('POST', url, data, options);
  }

  /**
   * Perform PUT request
   */
  async put<T = any>(
    url: string,
    data?: any,
    options?: { headers?: Record<string, string> },
  ): Promise<any> {
    return this.request('PUT', url, data, options);
  }

  /**
   * Perform PATCH request
   */
  async patch<T = any>(
    url: string,
    data?: any,
    options?: { headers?: Record<string, string> },
  ): Promise<any> {
    return this.request('PATCH', url, data, options);
  }

  /**
   * Perform DELETE request
   */
  async delete<T = any>(
    url: string,
    options?: { headers?: Record<string, string> },
  ): Promise<any> {
    return this.request('DELETE', url, undefined, options);
  }

  /**
   * Generic request method with retries
   */
  private async request<T = any>(
    method: string,
    url: string,
    data?: any,
    options?: { headers?: Record<string, string> },
  ): Promise<any> {
    const config: any = {
      method,
      url,
      data,
      headers: options?.headers,
    };

    let lastError: any;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const response = await this.axios.request(config);
        return response;
      } catch (error: any) {
        lastError = error;

        // Don't retry on client errors (4xx)
        if (error.response?.status >= 400 && error.response?.status < 500) {
          throw error;
        }

        // Don't retry on the last attempt
        if (attempt === this.retries) {
          break;
        }

        // Wait before retrying
        await this.sleep(this.retryDelay * Math.pow(2, attempt));
      }
    }

    throw lastError;
  }

  /**
   * Update the API key
   */
  updateApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    this.axios.defaults.headers['x-api-key'] = apiKey;
  }

  /**
   * Set a default header
   */
  setDefaultHeader(name: string, value: string): void {
    this.axios.defaults.headers[name] = value;
  }

  /**
   * Remove a default header
   */
  removeDefaultHeader(name: string): void {
    delete this.axios.defaults.headers[name];
  }

  /**
   * Sleep utility for retries
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a new client instance
 */
export function createClient(options: ClientOptions): AccessTrafficClient {
  return new AccessTrafficClient(options);
}

export default AccessTrafficClient;
