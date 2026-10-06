type RailOptions = { key: string; enabled: boolean };

/** Move a decorative underline without moving the controls or their hit targets. */
export function selectionRail(node: HTMLElement, initial: RailOptions) {
	let options = initial;
	let frame = 0;
	let disposed = false;
	let observer: ResizeObserver | undefined;
	const marker = node.querySelector<HTMLElement>(".selection-rail");
	function position() {
		cancelAnimationFrame(frame);
		if (disposed || !options.enabled) return;
		frame = requestAnimationFrame(() => {
			const selected = node.querySelector<HTMLElement>(
				'button[aria-pressed="true"]',
			);
			if (disposed || !node.isConnected || !marker || !selected) {
				delete node.dataset.selectionReady;
				return;
			}
			const bounds = node.getBoundingClientRect();
			const target = selected.getBoundingClientRect();
			if (!target.width) {
				delete node.dataset.selectionReady;
				return;
			}
			const x = target.left - bounds.left + node.scrollLeft - node.clientLeft;
			const y =
				target.bottom - bounds.top + node.scrollTop - node.clientTop - 2;
			marker.style.width = `${target.width}px`;
			marker.style.transform = `translate3d(${x}px, ${y}px, 0)`;
			node.dataset.selectionReady = "true";
		});
	}
	function connect() {
		observer?.disconnect();
		cancelAnimationFrame(frame);
		delete node.dataset.selectionReady;
		if (!options.enabled || disposed) return;
		if (typeof ResizeObserver !== "undefined") {
			observer = new ResizeObserver(position);
			observer.observe(node);
			for (const button of node.querySelectorAll("button")) {
				observer.observe(button);
			}
		}
		position();
	}
	node.addEventListener("scroll", position, { passive: true });
	window.addEventListener("resize", position, { passive: true });
	connect();
	return {
		update(next: RailOptions) {
			const changed = next.key !== options.key;
			const toggled = next.enabled !== options.enabled;
			options = next;
			if (toggled) connect();
			else if (changed) position();
		},
		destroy() {
			disposed = true;
			observer?.disconnect();
			cancelAnimationFrame(frame);
			delete node.dataset.selectionReady;
			marker?.style.removeProperty("width");
			marker?.style.removeProperty("transform");
			node.removeEventListener("scroll", position);
			window.removeEventListener("resize", position);
		},
	};
}

/** Native details still open immediately; only their contents briefly settle in. */
export function disclosureReception(node: HTMLElement, initial: boolean) {
	let enabled = initial;
	const animations = new Map<HTMLElement, Animation>();
	function cancel() {
		for (const animation of animations.values()) animation.cancel();
		animations.clear();
	}
	function receive(event: Event) {
		const details = event.target as HTMLDetailsElement | null;
		if (details?.tagName !== "DETAILS") return;
		const content = details.querySelector<HTMLElement>(
			":scope > .reader-comment-content, :scope > .pr-check-list, :scope > .patch-diff-scroll, :scope > pre",
		);
		if (!content) return;
		animations.get(content)?.cancel();
		animations.delete(content);
		if (
			!enabled ||
			!details.open ||
			window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
			typeof content.animate !== "function"
		)
			return;
		const animation = content.animate(
			[
				{ opacity: 0.35, transform: "translateY(-4px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ duration: 240, easing: "cubic-bezier(.16,1,.3,1)" },
		);
		animations.set(content, animation);
		animation.onfinish = () => {
			if (animations.get(content) === animation) animations.delete(content);
		};
	}
	node.addEventListener("toggle", receive, true);
	return {
		update(next: boolean) {
			enabled = next;
			if (!enabled) cancel();
		},
		destroy() {
			node.removeEventListener("toggle", receive, true);
			cancel();
		},
	};
}
