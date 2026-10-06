type Timer = ReturnType<typeof setTimeout>;
type NavigationClock = {
	schedule: (callback: () => void, duration: number) => Timer;
	cancel: (timer: Timer) => void;
};

export const WELCOME_RETURN_DURATION = 420;

export function createDeferredNavigation(
	navigate: () => void,
	duration: number,
	clock: NavigationClock = {
		schedule: (callback, delay) => setTimeout(callback, delay),
		cancel: (timer) => clearTimeout(timer),
	},
) {
	let timer: Timer | undefined;
	let generation = 0;

	function cancel() {
		generation++;
		if (timer !== undefined) clock.cancel(timer);
		timer = undefined;
	}

	function finish() {
		if (timer === undefined) return false;
		cancel();
		navigate();
		return true;
	}

	function start(immediate = false) {
		if (timer !== undefined) return false;
		if (immediate) {
			cancel();
			navigate();
			return true;
		}
		const currentGeneration = ++generation;
		timer = clock.schedule(() => {
			if (currentGeneration !== generation || timer === undefined) return;
			timer = undefined;
			navigate();
		}, duration);
		return true;
	}

	return { start, finish, cancel };
}
