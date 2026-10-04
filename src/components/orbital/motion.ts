type SequenceOptions = {
	key: string;
	enabled: boolean;
	selector: string;
	wait?: number;
};

/** Animate content inside rows, leaving the measured rails and hit targets fixed. */
export function revealSequence(node: HTMLElement, initial: SequenceOptions) {
	let options = initial;
	let frame = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const animations = new Set<Animation>();
	function cancel() {
		cancelAnimationFrame(frame);
		clearTimeout(timer);
		for (const animation of animations) animation.cancel();
		animations.clear();
	}
	function schedule() {
		cancel();
		if (!options.enabled) return;
		timer = setTimeout(() => {
			frame = requestAnimationFrame(() => {
				if (!node.isConnected) return;
				const boundary = node.parentElement?.getBoundingClientRect();
				const top = Math.max(0, boundary?.top ?? 0);
				const bottom = Math.min(
					window.innerHeight,
					boundary?.bottom ?? window.innerHeight,
				);
				const visible = [
					...node.querySelectorAll<HTMLElement>(options.selector),
				]
					.filter((item) => {
						const bounds = item.getBoundingClientRect();
						return bounds.bottom > top && bounds.top < bottom;
					})
					.slice(0, 7);
				visible.forEach((item, index) => {
					const animation = item.animate(
						[
							{ opacity: 0, transform: "translate3d(12px, 0, 0)" },
							{ opacity: 1, transform: "translate3d(0, 0, 0)" },
						],
						{
							duration: 380,
							delay: index * 45,
							easing: "cubic-bezier(.16,1,.3,1)",
							fill: "backwards",
						},
					);
					animations.add(animation);
					animation.onfinish = () => animations.delete(animation);
				});
			});
		}, options.wait ?? 0);
	}
	schedule();
	return {
		update(next: SequenceOptions) {
			const changed =
				next.key !== options.key || next.enabled !== options.enabled;
			options = next;
			if (changed) schedule();
		},
		destroy: cancel,
	};
}

/** Track the actual navigation geometry, including the horizontal phone layout. */
export function navigationBeacon(node: HTMLElement, _section: string) {
	let frame = 0;
	function position() {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(() => {
			const active = node.querySelector<HTMLElement>(
				'a[aria-current="page"]',
			);
			const beacon = node.querySelector<HTMLElement>(".nav-tracer");
			if (!active || !beacon) return;
			const horizontal = window.matchMedia("(max-width: 650px)").matches;
			const x = horizontal
				? active.offsetLeft + active.offsetWidth / 2 - 10
				: active.offsetLeft - 7;
			const y = horizontal
				? active.offsetTop + active.offsetHeight + 4
				: active.offsetTop + active.offsetHeight / 2 - 13;
			beacon.style.width = horizontal ? "20px" : "2px";
			beacon.style.height = horizontal ? "2px" : "26px";
			beacon.style.transform = `translate3d(${x}px, ${y}px, 0)`;
			beacon.dataset.ready = "true";
		});
	}
	const observer = new ResizeObserver(position);
	observer.observe(node);
	position();
	return {
		update: position,
		destroy() {
			observer.disconnect();
			cancelAnimationFrame(frame);
		},
	};
}
