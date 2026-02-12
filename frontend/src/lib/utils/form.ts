/**
 * Toggle an item in an array (for checkbox groups)
 */
export function toggleArrayItem<T>(array: T[], item: T): T[] {
	return array.includes(item) ? array.filter((i) => i !== item) : [...array, item];
}

/**
 * Extract form data as an object with proper types
 */
export function getFormData(form: HTMLFormElement): Record<string, string> {
	const formData = new FormData(form);
	const data: Record<string, string> = {};
	formData.forEach((value, key) => {
		data[key] = value.toString();
	});
	return data;
}
