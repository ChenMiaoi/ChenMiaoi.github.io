// Modules execute once for the document. Swup replaces page regions, so page
// resources must dispose before replacement and mount after the new view arrives.
export function onSwupReady(setup: (swup: Window["swup"]) => void) {
	if (window.swup?.hooks) setup(window.swup);
	else
		document.addEventListener("swup:enable", () => setup(window.swup), {
			once: true,
		});
}

export function registerPageLifecycle(mount: () => undefined | (() => void)) {
	let dispose = mount();
	onSwupReady((swup) => {
		swup.hooks.on(
			"content:replace",
			() => {
				dispose?.();
				dispose = undefined;
			},
			{ before: true },
		);
		swup.hooks.on("page:view", () => {
			dispose?.();
			dispose = mount();
		});
	});
}
