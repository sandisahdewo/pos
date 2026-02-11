const SELECTED_STORE_KEY = 'pos_selected_store';

function createStoreSelector() {
	let selectedStoreId = $state<string | null>(null);

	function initialize() {
		try {
			selectedStoreId = localStorage.getItem(SELECTED_STORE_KEY);
		} catch {
			// localStorage unavailable (SSR)
		}
	}

	function select(storeId: string | null) {
		selectedStoreId = storeId;
		try {
			if (storeId) {
				localStorage.setItem(SELECTED_STORE_KEY, storeId);
			} else {
				localStorage.removeItem(SELECTED_STORE_KEY);
			}
		} catch {
			// localStorage unavailable (SSR)
		}
	}

	function clear() {
		select(null);
	}

	return {
		get selectedStoreId() {
			return selectedStoreId;
		},
		initialize,
		select,
		clear
	};
}

export const storeSelector = createStoreSelector();
