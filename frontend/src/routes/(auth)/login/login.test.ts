import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import LoginPage from './+page.svelte';

const mockLogin = vi.fn();
const mockGoto = vi.fn();

vi.mock('$app/navigation', () => ({
	goto: (...args: unknown[]) => mockGoto(...args)
}));

vi.mock('$lib/stores/auth.svelte.js', () => ({
	auth: {
		login: (...args: unknown[]) => mockLogin(...args)
	}
}));

vi.mock('$lib/api/client.js', () => ({
	APIError: class APIError extends Error {
		status: number;
		details?: Record<string, string>;
		constructor(status: number, message: string, details?: Record<string, string>) {
			super(message);
			this.name = 'APIError';
			this.status = status;
			this.details = details;
		}
	}
}));

describe('Login Page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders the login form with all fields', () => {
		render(LoginPage);
		expect(screen.getAllByText('Sign In').length).toBeGreaterThanOrEqual(1);
		expect(screen.getByLabelText('Email')).toBeDefined();
		expect(screen.getByLabelText('Password')).toBeDefined();
		expect(screen.getByRole('button', { name: 'Sign In' })).toBeDefined();
	});

	it('renders the page description', () => {
		render(LoginPage);
		expect(screen.getByText('Enter your credentials to access your account')).toBeDefined();
	});

	it('has a link to register page', () => {
		render(LoginPage);
		const registerLink = screen.getByText('Register');
		expect(registerLink.closest('a')?.getAttribute('href')).toBe('/register');
	});

	it('has a link to forgot password page', () => {
		render(LoginPage);
		const forgotLink = screen.getByText('Forgot password?');
		expect(forgotLink.closest('a')?.getAttribute('href')).toBe('/forgot-password');
	});

	it('email input has correct attributes', () => {
		render(LoginPage);
		const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
		expect(emailInput.type).toBe('email');
		expect(emailInput.autocomplete).toBe('email');
		expect(emailInput.required).toBe(true);
	});

	it('password input has correct attributes', () => {
		render(LoginPage);
		const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
		expect(passwordInput.type).toBe('password');
		expect(passwordInput.autocomplete).toBe('current-password');
		expect(passwordInput.required).toBe(true);
	});

	it('calls auth.login with email and password on submit', async () => {
		mockLogin.mockResolvedValue(undefined);
		render(LoginPage);

		const emailInput = screen.getByLabelText('Email');
		const passwordInput = screen.getByLabelText('Password');
		const submitButton = screen.getByRole('button', { name: 'Sign In' });

		await fireEvent.input(emailInput, { target: { value: 'test@example.com' } });
		await fireEvent.input(passwordInput, { target: { value: 'password123' } });
		await fireEvent.click(submitButton);

		expect(mockLogin).toHaveBeenCalledWith({
			email: 'test@example.com',
			password: 'password123'
		});
	});

	it('redirects to dashboard on successful login', async () => {
		mockLogin.mockResolvedValue(undefined);
		render(LoginPage);

		const emailInput = screen.getByLabelText('Email');
		const passwordInput = screen.getByLabelText('Password');
		const submitButton = screen.getByRole('button', { name: 'Sign In' });

		await fireEvent.input(emailInput, { target: { value: 'test@example.com' } });
		await fireEvent.input(passwordInput, { target: { value: 'password123' } });
		await fireEvent.click(submitButton);

		await vi.waitFor(() => {
			expect(mockGoto).toHaveBeenCalledWith('/dashboard');
		});
	});

	it('shows API error message in alert on failed login', async () => {
		const APIErrorClass = (await import('$lib/api/client.js')).APIError;
		mockLogin.mockRejectedValue(new APIErrorClass(401, 'Invalid email or password'));
		render(LoginPage);

		const emailInput = screen.getByLabelText('Email');
		const passwordInput = screen.getByLabelText('Password');
		const submitButton = screen.getByRole('button', { name: 'Sign In' });

		await fireEvent.input(emailInput, { target: { value: 'test@example.com' } });
		await fireEvent.input(passwordInput, { target: { value: 'wrongpass' } });
		await fireEvent.click(submitButton);

		await vi.waitFor(() => {
			expect(screen.getByText('Invalid email or password')).toBeDefined();
		});
	});

	it('shows generic error message for non-API errors', async () => {
		mockLogin.mockRejectedValue(new Error('Network failure'));
		render(LoginPage);

		const emailInput = screen.getByLabelText('Email');
		const passwordInput = screen.getByLabelText('Password');
		const submitButton = screen.getByRole('button', { name: 'Sign In' });

		await fireEvent.input(emailInput, { target: { value: 'test@example.com' } });
		await fireEvent.input(passwordInput, { target: { value: 'password123' } });
		await fireEvent.click(submitButton);

		await vi.waitFor(() => {
			expect(screen.getByText('An unexpected error occurred')).toBeDefined();
		});
	});

	it('does not redirect on failed login', async () => {
		const APIErrorClass = (await import('$lib/api/client.js')).APIError;
		mockLogin.mockRejectedValue(new APIErrorClass(401, 'Invalid credentials'));
		render(LoginPage);

		const emailInput = screen.getByLabelText('Email');
		const passwordInput = screen.getByLabelText('Password');
		const submitButton = screen.getByRole('button', { name: 'Sign In' });

		await fireEvent.input(emailInput, { target: { value: 'test@example.com' } });
		await fireEvent.input(passwordInput, { target: { value: 'wrongpass' } });
		await fireEvent.click(submitButton);

		await vi.waitFor(() => {
			expect(screen.getByText('Invalid credentials')).toBeDefined();
		});
		expect(mockGoto).not.toHaveBeenCalled();
	});
});
