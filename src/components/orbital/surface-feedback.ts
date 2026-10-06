/** Delegate decoration to the shell so newly selected cards need no extra listeners. */
export function surfaceFeedback(node: HTMLElement, initial: boolean) {
	let enabled = initial;
	let frame = 0;
	let current: HTMLElement | undefined;
	const animations = new Map<HTMLElement, Animation>();
	const allowed = () =>
		enabled && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	function surface(event: Event) {
		const target = event.target as Element | null;
		if (!target || typeof target.closest !== "function") return;
		const result = target.closest<HTMLElement>("[data-feedback]");
		return result && node.contains(result) ? result : undefined;
	}
	function clearLight() {
		cancelAnimationFrame(frame);
		if (current) {
			delete current.dataset.lightActive;
			current.style.removeProperty("--light-x");
			current.style.removeProperty("--light-y");
		}
		current = undefined;
	}
	function localPoint(target: HTMLElement, clientX: number, clientY: number) {
		const bounds = target.getBoundingClientRect();
		return {
			x:
				((clientX - bounds.left) * (target.offsetWidth || bounds.width)) /
				(bounds.width || 1),
			y:
				((clientY - bounds.top) * (target.offsetHeight || bounds.height)) /
				(bounds.height || 1),
		};
	}
	function move(event: PointerEvent) {
		if (
			!allowed() ||
			event.pointerType !== "mouse" ||
			!window.matchMedia("(hover: hover) and (pointer: fine)").matches
		)
			return;
		const target = surface(event);
		if (target !== current) {
			clearLight();
			current = target;
		}
		cancelAnimationFrame(frame);
		if (!target) return;
		frame = requestAnimationFrame(() => {
			if (!allowed() || !target.isConnected) {
				clearLight();
				return;
			}
			const point = localPoint(target, event.clientX, event.clientY);
			target.style.setProperty("--light-x", `${point.x}px`);
			target.style.setProperty("--light-y", `${point.y}px`);
			target.dataset.lightActive = "true";
		});
	}
	function pulse(target: HTMLElement, x: number, y: number) {
		if (
			!allowed() ||
			!target.matches("button, a") ||
			target.matches(":disabled")
		)
			return;
		const ring = target.querySelector<HTMLElement>(".interaction-pulse > i");
		if (!ring || typeof ring.animate !== "function") return;
		animations.get(ring)?.cancel();
		const bounds = target.getBoundingClientRect();
		const scale = Math.max(
			2,
			Math.hypot(
				target.offsetWidth || bounds.width,
				target.offsetHeight || bounds.height,
			) / 9,
		);
		ring.style.left = `${x}px`;
		ring.style.top = `${y}px`;
		const animation = ring.animate(
			[
				{
					opacity: 0.5,
					transform: "translate(-50%, -50%) scale(.4)",
					borderWidth: "1px",
				},
				{
					opacity: 0,
					transform: `translate(-50%, -50%) scale(${scale})`,
					borderWidth: `${1 / scale}px`,
				},
			],
			{ duration: 520, easing: "cubic-bezier(.16,1,.3,1)" },
		);
		animations.set(ring, animation);
		animation.onfinish = () => {
			if (animations.get(ring) === animation) animations.delete(ring);
		};
	}
	function press(event: PointerEvent) {
		if (event.button !== 0) return;
		const target = surface(event);
		if (!target) return;
		const point = localPoint(target, event.clientX, event.clientY);
		pulse(target, point.x, point.y);
	}
	function keyboard(event: KeyboardEvent) {
		if (event.repeat || !["Enter", " "].includes(event.key)) return;
		const target = surface(event);
		if (!target || (event.key === " " && target.tagName === "A")) return;
		const bounds = target.getBoundingClientRect();
		pulse(
			target,
			(target.offsetWidth || bounds.width) / 2,
			(target.offsetHeight || bounds.height) / 2,
		);
	}
	function cancel() {
		clearLight();
		for (const animation of animations.values()) animation.cancel();
		animations.clear();
	}
	node.addEventListener("pointermove", move, { passive: true });
	node.addEventListener("pointerleave", clearLight);
	node.addEventListener("pointerdown", press, { passive: true });
	node.addEventListener("keydown", keyboard);
	return {
		update(next: boolean) {
			enabled = next;
			if (!enabled) cancel();
		},
		destroy() {
			cancel();
			node.removeEventListener("pointermove", move);
			node.removeEventListener("pointerleave", clearLight);
			node.removeEventListener("pointerdown", press);
			node.removeEventListener("keydown", keyboard);
		},
	};
}
