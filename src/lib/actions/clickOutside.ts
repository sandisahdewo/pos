import type { Action } from 'svelte/action';

export const clickOutside: Action<HTMLElement, () => void> = (node, callback) => {
  let cb = callback;

  const handle = (event: MouseEvent) => {
    const target = event.target as Node | null;
    if (target && !node.contains(target)) {
      cb?.();
    }
  };

  document.addEventListener('click', handle, true);

  return {
    update(newCallback) {
      cb = newCallback;
    },
    destroy() {
      document.removeEventListener('click', handle, true);
    }
  };
};
