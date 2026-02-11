import type { AuthTokens, ErrorResponse } from './types.js';

export class APIError extends Error {
	status: number;
	details?: Record<string, string>;

	constructor(status: number, message: string, details?: Record<string, string>) {
		super(message);
		this.name = 'APIError';
		this.status = status;
		this.details = details;
		// Maintains proper stack trace for where our error was thrown (V8 only)
		if (typeof (Error as any).captureStackTrace === 'function') {
			(Error as any).captureStackTrace(this, APIError);
		}
	}

	get isClientError(): boolean {
		return this.status >= 400 && this.status < 500;
	}

	get isServerError(): boolean {
		return this.status >= 500;
	}

	get isUnauthorized(): boolean {
		return this.status === 401;
	}

	get isForbidden(): boolean {
		return this.status === 403;
	}

	get isNotFound(): boolean {
		return this.status === 404;
	}

	get isValidationError(): boolean {
		return this.status === 422 || (this.status === 400 && !!this.details);
	}

	toString(): string {
		if (this.details) {
			const detailsStr = Object.entries(this.details)
				.map(([key, value]) => `${key}: ${value}`)
				.join(', ');
			return `${this.message} (${detailsStr})`;
		}
		return this.message;
	}
}

type TokenGetter = () => AuthTokens | null;
type TokenSetter = (tokens: AuthTokens | null) => void;
type OnUnauthorized = () => void;

interface ClientOptions {
	baseURL?: string;
	timeout?: number;
	getTokens: TokenGetter;
	setTokens: TokenSetter;
	onUnauthorized: OnUnauthorized;
}

let clientInstance: APIClient | null = null;

export class APIClient {
	private baseURL: string;
	private timeout: number;
	private getTokens: TokenGetter;
	private setTokens: TokenSetter;
	private onUnauthorized: OnUnauthorized;
	private refreshing: Promise<boolean> | null = null;

	constructor(options: ClientOptions) {
		this.baseURL = options.baseURL ?? '/api';
		this.timeout = options.timeout ?? 30000; // 30 seconds default
		this.getTokens = options.getTokens;
		this.setTokens = options.setTokens;
		this.onUnauthorized = options.onUnauthorized;
	}

	private async request<T>(
		method: string,
		path: string,
		body?: unknown,
		skipAuth = false
	): Promise<T> {
		const url = `${this.baseURL}${path}`;
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};

		if (!skipAuth) {
			const tokens = this.getTokens();
			if (tokens?.access_token) {
				headers['Authorization'] = `Bearer ${tokens.access_token}`;
			}
		}

		// Set up timeout with AbortController
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
			const res = await fetch(url, {
				method,
				headers,
				body: body != null ? JSON.stringify(body) : undefined,
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			if (res.status === 401 && !skipAuth) {
				const refreshed = await this.tryRefresh();
				if (refreshed) {
					return this.request<T>(method, path, body, false);
				}
				this.onUnauthorized();
				throw new APIError(401, 'Unauthorized - please log in again');
			}

			if (!res.ok) {
				const errorBody: ErrorResponse = await res.json().catch(() => ({
					error: `Request failed with status ${res.status}`
				}));
				throw new APIError(res.status, errorBody.error, errorBody.details);
			}

			if (res.status === 204) {
				return undefined as T;
			}

			return res.json() as Promise<T>;
		} catch (error) {
			clearTimeout(timeoutId);

			// Handle abort/timeout
			if (error instanceof Error && error.name === 'AbortError') {
				throw new APIError(408, 'Request timeout - please try again');
			}

			// Handle network errors
			if (error instanceof TypeError) {
				throw new APIError(0, 'Network error - please check your connection');
			}

			// Re-throw APIError as-is
			if (error instanceof APIError) {
				throw error;
			}

			// Unknown error
			throw new APIError(500, 'An unexpected error occurred');
		}
	}

	private async tryRefresh(): Promise<boolean> {
		if (this.refreshing) {
			return this.refreshing;
		}

		this.refreshing = this.executeRefresh();
		try {
			return await this.refreshing;
		} finally {
			this.refreshing = null;
		}
	}

	private async executeRefresh(): Promise<boolean> {
		const tokens = this.getTokens();
		if (!tokens?.refresh_token) {
			return false;
		}

		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s for refresh

			const res = await fetch(`${this.baseURL}/v1/auth/refresh`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ refresh_token: tokens.refresh_token }),
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			if (!res.ok) {
				this.setTokens(null);
				return false;
			}

			const newTokens: AuthTokens = await res.json();
			this.setTokens(newTokens);
			return true;
		} catch (error) {
			// Only clear tokens if it's not a network/timeout error
			// (user might just have bad connection temporarily)
			if (!(error instanceof Error && error.name === 'AbortError')) {
				this.setTokens(null);
			}
			return false;
		}
	}

	async get<T>(path: string): Promise<T> {
		return this.request<T>('GET', path);
	}

	async post<T>(path: string, body?: unknown): Promise<T> {
		return this.request<T>('POST', path, body);
	}

	async put<T>(path: string, body?: unknown): Promise<T> {
		return this.request<T>('PUT', path, body);
	}

	async del<T>(path: string): Promise<T> {
		return this.request<T>('DELETE', path);
	}

	async postPublic<T>(path: string, body?: unknown): Promise<T> {
		return this.request<T>('POST', path, body, true);
	}
}

export function initClient(options: ClientOptions): APIClient {
	clientInstance = new APIClient(options);
	return clientInstance;
}

export function getClient(): APIClient {
	if (!clientInstance) {
		throw new Error('API client not initialized. Call initClient() first.');
	}
	return clientInstance;
}
