import { goto } from '$app/navigation';
import { browser } from '$app/environment';
import { getClient, initClient, type APIClient } from '$lib/api/client.js';
import type {
	AuthTokens,
	LoginRequest,
	LoginResponse,
	MeResponse,
	RegisterRequest,
	RegisterResponse
} from '$lib/api/types.js';

const TOKENS_KEY = 'pos_tokens';
const SYNC_KEY = 'pos_auth_sync';
const TOKEN_EXPIRY_BUFFER_MS = 60000; // Refresh 1 minute before expiry

// Development logger - disabled in production
const DEV = import.meta.env.DEV;
const log = {
	info: (...args: unknown[]) => DEV && console.log('[auth]', ...args),
	error: (...args: unknown[]) => console.error('[auth]', ...args),
	warn: (...args: unknown[]) => console.warn('[auth]', ...args)
};

/**
 * Secure localStorage wrapper with error handling
 */
class SecureStorage {
	private isAvailable(): boolean {
		return browser && typeof localStorage !== 'undefined';
	}

	get(key: string): string | null {
		if (!this.isAvailable()) return null;
		try {
			return localStorage.getItem(key);
		} catch (error) {
			log.error('localStorage.getItem failed:', error);
			return null;
		}
	}

	set(key: string, value: string): void {
		if (!this.isAvailable()) return;
		try {
			localStorage.setItem(key, value);
		} catch (error) {
			log.error('localStorage.setItem failed:', error);
		}
	}

	remove(key: string): void {
		if (!this.isAvailable()) return;
		try {
			localStorage.removeItem(key);
		} catch (error) {
			log.error('localStorage.removeItem failed:', error);
		}
	}
}

const storage = new SecureStorage();

/**
 * Token utilities
 */
function decodeJWT(token: string): { exp?: number } | null {
	try {
		const parts = token.split('.');
		if (parts.length !== 3) return null;
		const payload = JSON.parse(atob(parts[1]));
		return payload;
	} catch {
		return null;
	}
}

function isTokenExpired(token: string, bufferMs = TOKEN_EXPIRY_BUFFER_MS): boolean {
	const decoded = decodeJWT(token);
	if (!decoded?.exp) return false; // If no expiry, assume valid
	const now = Date.now();
	const expiryMs = decoded.exp * 1000;
	return now >= expiryMs - bufferMs;
}

/**
 * Auth state - reactive Svelte 5 runes
 */
export const authState = $state({
	tokens: null as AuthTokens | null,
	user: null as MeResponse | null,
	initialized: false,
	loading: false,
	error: null as string | null
});

/**
 * Auth store implementation
 */
class AuthStore {
	private client: APIClient | null = null;
	private refreshTimer: ReturnType<typeof setTimeout> | null = null;
	private storageListener: ((e: StorageEvent) => void) | null = null;

	// Getters for reactive state
	get tokens() {
		return authState.tokens;
	}
	get user() {
		return authState.user;
	}
	get initialized() {
		return authState.initialized;
	}
	get loading() {
		return authState.loading;
	}
	get error() {
		return authState.error;
	}
	get isAuthenticated() {
		return authState.tokens !== null && authState.user !== null;
	}
	get accessibleStores() {
		return authState.user?.stores ?? [];
	}
	get allStoresAccess() {
		return authState.user?.all_stores_access ?? false;
	}
	get permissions() {
		return authState.user?.permissions ?? {};
	}

	/**
	 * Initialize auth - must be called before using auth
	 */
	async initialize(): Promise<void> {
		if (authState.initialized) {
			log.info('Already initialized');
			return;
		}

		log.info('Initializing auth');
		authState.loading = true;
		authState.error = null;

		try {
			// Initialize API client
			this.ensureClient();

			// Set up cross-tab synchronization
			this.setupCrossTabSync();

			// Set up visibility change listener for token refresh
			this.setupVisibilityListener();

			// Try to restore session from localStorage
			const stored = storage.get(TOKENS_KEY);
			if (stored) {
				const tokens: AuthTokens = JSON.parse(stored);

				// Check if access token is expired
				if (isTokenExpired(tokens.access_token)) {
					log.info('Access token expired, attempting refresh');
					const refreshed = await this.tryRefreshToken(tokens);
					if (!refreshed) {
						log.info('Token refresh failed, clearing session');
						this.clearSession();
						authState.initialized = true;
						authState.loading = false;
						return;
					}
				} else {
					authState.tokens = tokens;
				}

				// Load user data
				await this.loadUser();
				this.scheduleTokenRefresh();
			}

			authState.initialized = true;
			log.info('Auth initialized', { isAuthenticated: this.isAuthenticated });
		} catch (error) {
			log.error('Initialization error:', error);
			authState.error = 'Failed to initialize authentication';
			this.clearSession();
			authState.initialized = true;
		} finally {
			authState.loading = false;
		}
	}

	/**
	 * Load current user data
	 */
	private async loadUser(): Promise<void> {
		if (!authState.tokens) {
			authState.user = null;
			return;
		}

		try {
			const api = this.ensureClient();
			const user = await api.get<MeResponse>('/v1/me');
			authState.user = user;
			authState.error = null;
			log.info('User loaded', { email: user.email });
		} catch (error) {
			log.error('Failed to load user:', error);
			authState.user = null;
			this.clearSession();
			throw error;
		}
	}

	/**
	 * Refresh user data (for profile updates)
	 */
	async refreshUser(): Promise<void> {
		if (!this.isAuthenticated) return;
		authState.loading = true;
		try {
			await this.loadUser();
		} finally {
			authState.loading = false;
		}
	}

	/**
	 * Login with email and password
	 */
	async login(data: LoginRequest): Promise<void> {
		const api = this.ensureClient();
		authState.loading = true;
		authState.error = null;

		try {
			const res = await api.postPublic<LoginResponse>('/v1/auth/login', data);
			this.setTokens(res.tokens);
			await this.loadUser();
			this.scheduleTokenRefresh();
			this.broadcastAuthChange('login');
			log.info('Login successful');
		} catch (error) {
			log.error('Login failed:', error);
			throw error;
		} finally {
			authState.loading = false;
		}
	}

	/**
	 * Register new account
	 */
	async register(data: RegisterRequest): Promise<void> {
		const api = this.ensureClient();
		authState.loading = true;
		authState.error = null;

		try {
			const res = await api.postPublic<RegisterResponse>('/v1/auth/register', data);
			this.setTokens(res.tokens);
			await this.loadUser();
			this.scheduleTokenRefresh();
			this.broadcastAuthChange('register');
			log.info('Registration successful');
		} catch (error) {
			log.error('Registration failed:', error);
			throw error;
		} finally {
			authState.loading = false;
		}
	}

	/**
	 * Logout and clear session
	 */
	async logout(): Promise<void> {
		const api = this.ensureClient();
		const tokens = authState.tokens;

		// Clear local state first for responsive UI
		this.clearSession();
		this.broadcastAuthChange('logout');

		// Then try to invalidate on server (best effort)
		if (tokens?.refresh_token) {
			try {
				await api.postPublic('/v1/auth/logout', {
					refresh_token: tokens.refresh_token
				});
				log.info('Server logout successful');
			} catch (error) {
				log.warn('Server logout failed (already cleared locally):', error);
			}
		}

		// Navigate to login
		goto('/login');
	}

	/**
	 * Check if user has a specific permission
	 */
	hasPermission(featureSlug: string, action: string): boolean {
		if (!authState.user) return false;

		// Admin users with all_stores_access get all permissions
		if (authState.user.all_stores_access) {
			return true;
		}

		const actions = authState.user.permissions[featureSlug];
		return actions ? actions.includes(action) : false;
	}

	/**
	 * Check if user can access a store
	 */
	canAccessStore(storeId: string): boolean {
		if (!authState.user) return false;
		if (authState.user.all_stores_access) return true;
		return authState.user.stores.some((s) => s.id === storeId);
	}

	/**
	 * Get the API client (ensures it is initialized)
	 */
	getApiClient(): APIClient {
		return this.ensureClient();
	}

	/**
	 * Set up auth session from pre-obtained tokens (e.g., invitation acceptance)
	 */
	async loginWithTokens(tokens: AuthTokens): Promise<void> {
		this.ensureClient();
		this.setTokens(tokens);
		await this.loadUser();
		this.scheduleTokenRefresh();
		this.broadcastAuthChange('login');
		authState.initialized = true;
	}

	/**
	 * Cleanup when no longer needed
	 */
	destroy(): void {
		if (this.refreshTimer) {
			clearTimeout(this.refreshTimer);
			this.refreshTimer = null;
		}
		if (this.storageListener && browser) {
			window.removeEventListener('storage', this.storageListener);
			this.storageListener = null;
		}
		if (browser) {
			document.removeEventListener('visibilitychange', this.handleVisibilityChange);
		}
	}

	// ============= Private methods =============

	private ensureClient(): APIClient {
		if (!this.client) {
			this.client = initClient({
				getTokens: () => authState.tokens,
				setTokens: (tokens) => this.setTokens(tokens),
				onUnauthorized: () => this.handleUnauthorized()
			});
		}
		return this.client;
	}

	private setTokens(tokens: AuthTokens | null): void {
		authState.tokens = tokens;
		if (tokens) {
			storage.set(TOKENS_KEY, JSON.stringify(tokens));
		} else {
			storage.remove(TOKENS_KEY);
		}
	}

	private clearSession(): void {
		authState.tokens = null;
		authState.user = null;
		authState.error = null;
		storage.remove(TOKENS_KEY);
		if (this.refreshTimer) {
			clearTimeout(this.refreshTimer);
			this.refreshTimer = null;
		}
	}

	private handleUnauthorized(): void {
		log.warn('Unauthorized - clearing session');
		this.clearSession();
		this.broadcastAuthChange('unauthorized');
		goto('/login');
	}

	private async tryRefreshToken(tokens: AuthTokens): Promise<boolean> {
		if (!tokens.refresh_token) return false;

		try {
			const api = this.ensureClient();
			const res = await fetch('/api/v1/auth/refresh', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ refresh_token: tokens.refresh_token })
			});

			if (!res.ok) return false;

			const newTokens: AuthTokens = await res.json();
			this.setTokens(newTokens);
			log.info('Token refresh successful');
			return true;
		} catch (error) {
			log.error('Token refresh failed:', error);
			return false;
		}
	}

	private scheduleTokenRefresh(): void {
		if (this.refreshTimer) {
			clearTimeout(this.refreshTimer);
		}

		if (!authState.tokens?.access_token) return;

		const decoded = decodeJWT(authState.tokens.access_token);
		if (!decoded?.exp) return;

		const now = Date.now();
		const expiryMs = decoded.exp * 1000;
		const refreshAt = expiryMs - TOKEN_EXPIRY_BUFFER_MS;
		const delay = refreshAt - now;

		if (delay > 0) {
			log.info('Scheduling token refresh in', Math.round(delay / 1000), 'seconds');
			this.refreshTimer = setTimeout(async () => {
				if (authState.tokens) {
					log.info('Auto-refreshing token');
					await this.tryRefreshToken(authState.tokens);
					this.scheduleTokenRefresh();
				}
			}, delay);
		}
	}

	/**
	 * Cross-tab synchronization
	 */
	private setupCrossTabSync(): void {
		if (!browser) return;

		this.storageListener = (e: StorageEvent) => {
			if (e.key === SYNC_KEY && e.newValue) {
				const event = JSON.parse(e.newValue);
				log.info('Auth sync event from another tab:', event.type);

				if (event.type === 'logout' || event.type === 'unauthorized') {
					this.clearSession();
					if (window.location.pathname !== '/login') {
						goto('/login');
					}
				} else if (event.type === 'login' || event.type === 'register') {
					// Reload tokens from storage
					const stored = storage.get(TOKENS_KEY);
					if (stored) {
						authState.tokens = JSON.parse(stored);
						this.loadUser().catch((err) => log.error('Failed to load user after sync:', err));
					}
				}
			}
		};

		window.addEventListener('storage', this.storageListener);
	}

	private broadcastAuthChange(type: 'login' | 'logout' | 'register' | 'unauthorized'): void {
		if (!browser) return;
		storage.set(SYNC_KEY, JSON.stringify({ type, timestamp: Date.now() }));
		// Clean up sync key after a short delay
		setTimeout(() => storage.remove(SYNC_KEY), 1000);
	}

	/**
	 * Handle page visibility change - refresh tokens when returning to tab
	 */
	private handleVisibilityChange = async (): Promise<void> => {
		if (document.visibilityState === 'visible' && authState.tokens) {
			if (isTokenExpired(authState.tokens.access_token)) {
				log.info('Tab became visible with expired token, refreshing');
				const refreshed = await this.tryRefreshToken(authState.tokens);
				if (refreshed) {
					await this.loadUser();
					this.scheduleTokenRefresh();
				} else {
					this.handleUnauthorized();
				}
			}
		}
	};

	private setupVisibilityListener(): void {
		if (!browser) return;
		document.addEventListener('visibilitychange', this.handleVisibilityChange);
	}
}

// Export singleton instance
export const auth = new AuthStore();

// Cleanup on module unload (HMR)
if (browser && import.meta.hot) {
	import.meta.hot.dispose(() => {
		auth.destroy();
	});
}
