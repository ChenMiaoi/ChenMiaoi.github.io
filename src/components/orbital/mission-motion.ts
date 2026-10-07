type SelectionOptions = { key: string; enabled: boolean };
type MetricOptions = { value: number; enabled: boolean };
const easing = "cubic-bezier(.16,1,.3,1)";
const canMove = (enabled: boolean) =>
	enabled && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Animate the real value, so announcements and rapid filtering stay accurate. */
export function metricTransition(node: HTMLElement, initial: MetricOptions) {
	let options = initial;
	let animation: Animation | undefined;
	return {
		update(next: MetricOptions) {
			const changed = next.value !== options.value;
			options = next;
			if (changed || !canMove(next.enabled)) {
				animation?.cancel();
				animation = undefined;
			}
			if (
				!changed ||
				!canMove(next.enabled) ||
				!node.isConnected ||
				!node.animate
			)
				return;
			animation = node.animate(
				[
					{ opacity: 0.3, transform: "translateY(.35em)" },
					{ opacity: 1, transform: "translateY(0)" },
				],
				{ duration: 300, easing },
			);
		},
		destroy() {
			animation?.cancel();
		},
	};
}

/** Decorations follow the selection; controls, scrolling and briefing stay native. */
export function missionLink(node: HTMLElement, initial: SelectionOptions) {
	let options = initial;
	let disposed = false;
	let frame = 0;
	let pendingPulse = false;
	let observer: ResizeObserver | undefined;
	let animation: Animation | undefined;
	const list = node.querySelector<HTMLElement>(".mission-log-scroll");
	const marker = node.querySelector<HTMLElement>(".mission-selection");
	const heading = node.querySelector<HTMLElement>(".briefing-heading");
	const path = node.querySelector<SVGPathElement>(".mission-link path");
	function clear() {
		cancelAnimationFrame(frame);
		pendingPulse = false;
		animation?.cancel();
		animation = undefined;
		delete list?.dataset.missionSelectionReady;
		path?.removeAttribute("d");
	}
	function position(pulse = false) {
		cancelAnimationFrame(frame);
		pendingPulse ||= pulse;
		if (disposed || !canMove(options.enabled)) {
			clear();
			return;
		}
		frame = requestAnimationFrame(() => {
			const receive = pendingPulse;
			pendingPulse = false;
			const selected = list?.querySelector<HTMLElement>(
				'.mission-entry[aria-pressed="true"]',
			);
			if (
				disposed ||
				!node.isConnected ||
				!list ||
				!marker ||
				!heading ||
				!path ||
				!selected
			) {
				clear();
				return;
			}
			const bounds = node.getBoundingClientRect();
			const viewport = list.getBoundingClientRect();
			const row = selected.getBoundingClientRect();
			const destination = heading.getBoundingClientRect();
			if (!row.height || !viewport.height) {
				clear();
				return;
			}
			marker.style.height = `${Math.max(8, row.height - 24)}px`;
			marker.style.transform = `translateY(${row.top - viewport.top + list.scrollTop - list.clientTop + 12}px)`;
			list.dataset.missionSelectionReady = "true";
			const top = Math.max(row.top, viewport.top, 0);
			const bottom = Math.min(row.bottom, viewport.bottom, window.innerHeight);
			// Stacked mobile panes use their local reception effect instead of a cross-page line.
			if (
				top >= bottom ||
				destination.left <= row.right ||
				destination.bottom <= 0 ||
				destination.top >= window.innerHeight
			) {
				animation?.cancel();
				animation = undefined;
				path.removeAttribute("d");
				return;
			}
			const x = row.right - bounds.left;
			const y = (top + bottom) / 2 - bounds.top;
			const endX = destination.left - bounds.left;
			const endY = (destination.top + destination.bottom) / 2 - bounds.top;
			const middle = (x + endX) / 2;
			const route = `M ${x} ${y} C ${middle} ${y}, ${middle} ${endY}, ${endX} ${endY}`;
			if (route !== path.getAttribute("d") || receive) {
				animation?.cancel();
				animation = undefined;
			}
			path.setAttribute("d", route);
			if (receive && path.animate) {
				animation = path.animate(
					[
						{ opacity: 0, strokeDashoffset: ".12" },
						{ opacity: 0.9, offset: 0.15 },
						{ opacity: 0, strokeDashoffset: "-1" },
					],
					{ duration: 460, easing: "ease-out" },
				);
			}
		});
	}
	function layout() {
		position();
	}
	function connect() {
		observer?.disconnect();
		clear();
		if (disposed || !canMove(options.enabled)) return;
		if (typeof ResizeObserver !== "undefined") {
			observer = new ResizeObserver(layout);
			for (const target of [
				node,
				list,
				heading,
				list?.querySelector('.mission-entry[aria-pressed="true"]'),
			]) {
				if (target) observer.observe(target);
			}
		}
		position();
	}
	list?.addEventListener("scroll", layout, { passive: true });
	window.addEventListener("resize", layout, { passive: true });
	window.addEventListener("scroll", layout, { passive: true });
	connect();
	return {
		update(next: SelectionOptions) {
			const changed = next.key !== options.key;
			const toggled = next.enabled !== options.enabled;
			options = next;
			if (changed || toggled) {
				connect();
				if (changed && next.key) position(true);
			}
		},
		destroy() {
			disposed = true;
			observer?.disconnect();
			clear();
			marker?.style.removeProperty("height");
			marker?.style.removeProperty("transform");
			list?.removeEventListener("scroll", layout);
			window.removeEventListener("resize", layout);
			window.removeEventListener("scroll", layout);
		},
	};
}
