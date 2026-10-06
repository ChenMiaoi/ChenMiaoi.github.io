import assert from "node:assert/strict";
import test from "node:test";
import {
	disclosureReception,
	selectionRail,
} from "../src/components/orbital/interaction-motion.ts";
import { surfaceFeedback } from "../src/components/orbital/surface-feedback.ts";

function eventTarget() {
	const listeners = new Map();
	return {
		listeners,
		addEventListener(type, callback) { listeners.set(type, callback); },
		removeEventListener(type, callback) {
			if (listeners.get(type) === callback) listeners.delete(type);
		},
		emit(type, target, extra = {}) { listeners.get(type)?.({ target, ...extra }); },
	};
}

function environment(t) {
	const descriptors = new Map(
		["window", "ResizeObserver", "requestAnimationFrame", "cancelAnimationFrame"]
			.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
	);
	const frames = new Map();
	const observers = [];
	let next = 0;
	const win = { ...eventTarget(), reduced: false, fine: true };
	win.matchMedia = (query) => ({ matches: query.includes("prefers-reduced-motion") ? win.reduced : win.fine });
	globalThis.window = win;
	globalThis.requestAnimationFrame = (callback) => {
		frames.set(++next, callback);
		return next;
	};
	globalThis.cancelAnimationFrame = (id) => frames.delete(id);
	globalThis.ResizeObserver = class {
		constructor(callback) {
			this.callback = callback;
			this.targets = new Set();
			observers.push(this);
		}
		observe(target) { this.targets.add(target); }
		disconnect() { this.targets.clear(); }
	};
	t.after(() => {
		for (const [key, descriptor] of descriptors) {
			if (descriptor) Object.defineProperty(globalThis, key, descriptor);
			else delete globalThis[key];
		}
	});
	return {
		win, frames, observers,
		flush() {
			const pending = [...frames.values()];
			frames.clear();
			for (const callback of pending) callback();
		},
	};
}

function railFixture() {
	const marker = { style: { removeProperty(key) { delete this[key]; } } };
	const first = { bounds: { left: 110, bottom: 228, width: 74 } };
	const second = { bounds: { left: 185, bottom: 248, width: 92 } };
	first.getBoundingClientRect = () => first.bounds;
	second.getBoundingClientRect = () => second.bounds;
	const node = {
		...eventTarget(), dataset: {}, isConnected: true,
		scrollLeft: 10, scrollTop: 5, clientLeft: 2, clientTop: 2,
		selected: first,
		getBoundingClientRect: () => ({ left: 100, top: 200 }),
		querySelector(selector) { return selector === ".selection-rail" ? marker : this.selected; },
		querySelectorAll: () => [first, second],
	};
	return { node, marker, first, second };
}

test("selection marker follows wrapped controls, scrolling and resizing without moving buttons", (t) => {
	const env = environment(t);
	const { node, marker, second } = railFixture();
	const action = selectionRail(node, { key: "first", enabled: true });
	node.selected = second;
	action.update({ key: "second", enabled: true });
	assert.equal(env.frames.size, 1);
	env.flush();
	assert.equal(marker.style.transform, "translate3d(93px, 49px, 0)");
	assert.equal(marker.style.width, "92px");
	assert.equal(node.dataset.selectionReady, "true");
	assert.equal(second.style, undefined);
	second.bounds = { left: 118, bottom: 280, width: 110 };
	env.observers[0].callback();
	node.emit("scroll");
	env.flush();
	assert.equal(marker.style.transform, "translate3d(26px, 81px, 0)");
	assert.equal(marker.style.width, "110px");
	node.selected = null;
	action.update({ key: "empty", enabled: true });
	env.flush();
	assert.equal(node.dataset.selectionReady, undefined);
	action.destroy();
	assert.equal(env.observers[0].targets.size, 0);
	assert.equal(env.win.listeners.size, 0);
});

test("rapid selection, motion disabling and unmount discard pending marker work", (t) => {
	const env = environment(t);
	const { node, marker, first, second } = railFixture();
	const action = selectionRail(node, { key: "first", enabled: false });
	assert.equal(env.frames.size, 0);
	assert.equal(env.observers.length, 0);
	action.update({ key: "first", enabled: true });
	node.selected = second;
	action.update({ key: "second", enabled: true });
	node.selected = first;
	action.update({ key: "first", enabled: true });
	assert.equal(env.frames.size, 1);
	env.flush();
	assert.equal(marker.style.width, "74px");
	action.update({ key: "second", enabled: true });
	action.update({ key: "second", enabled: false });
	assert.equal(env.frames.size, 0);
	assert.equal(node.dataset.selectionReady, undefined);
	action.update({ key: "first", enabled: true });
	action.destroy();
	env.flush();
	assert.equal(marker.style.width, undefined);
	assert.equal(marker.style.transform, undefined);
	assert.equal(node.listeners.size, 0);
	assert.equal(env.win.listeners.size, 0);
	assert.ok(env.observers.every(observer => observer.targets.size === 0));
});

function disclosureFixture() {
	const animations = [];
	const content = {
		textContent: "Review contents",
		animate(_frames, options) {
			const animation = { options, cancelled: false, cancel() { this.cancelled = true; } };
			animations.push(animation);
			return animation;
		},
	};
	const details = { tagName: "DETAILS", open: true, querySelector: () => content };
	return { node: eventTarget(), details, content, animations };
}

test("native disclosures remain open and readable when animations are replaced, closed or disabled", (t) => {
	environment(t);
	const { node, details, content, animations } = disclosureFixture();
	const action = disclosureReception(node, true);
	node.emit("toggle", details);
	assert.equal(animations.length, 1);
	assert.equal(details.open, true);
	assert.equal(content.textContent, "Review contents");
	node.emit("toggle", details);
	assert.equal(animations[0].cancelled, true);
	assert.equal(animations.length, 2);
	details.open = false;
	node.emit("toggle", details);
	assert.equal(animations[1].cancelled, true);
	assert.equal(animations.length, 2);
	details.open = true;
	node.emit("toggle", details);
	action.update(false);
	assert.equal(animations[2].cancelled, true);
	node.emit("toggle", details);
	assert.equal(animations.length, 3);
	assert.equal(details.open, true);
	assert.equal(content.style, undefined);
	action.destroy();
	assert.equal(node.listeners.size, 0);
});

test("system reduced motion and missing animation support leave disclosure content untouched", (t) => {
	const env = environment(t);
	const { node, details, content, animations } = disclosureFixture();
	const action = disclosureReception(node, true);
	env.win.reduced = true;
	node.emit("toggle", details);
	assert.equal(animations.length, 0);
	env.win.reduced = false;
	node.emit("toggle", details);
	animations[0].onfinish();
	action.destroy();
	assert.equal(animations[0].cancelled, false);
	delete content.animate;
	const fallback = disclosureReception(node, true);
	assert.doesNotThrow(() => node.emit("toggle", details));
	assert.equal(details.open, true);
	assert.equal(content.textContent, "Review contents");
	fallback.destroy();
});

function feedbackFixture() {
	const animations = [];
	const style = { setProperty(key, value) { this[key] = value; }, removeProperty(key) { delete this[key]; } };
	const ring = {
		style: {},
		animate(frames) {
			const animation = { frames, cancelled: false, cancel() { this.cancelled = true; } };
			animations.push(animation);
			return animation;
		},
	};
	const target = {
		tagName: "BUTTON", dataset: {}, style, isConnected: true, disabled: false,
		getBoundingClientRect: () => ({ left: 100, top: 200, width: 160, height: 60 }),
		closest() { return this; },
		matches(selector) { return selector === ":disabled" ? this.disabled : ["BUTTON", "A"].includes(this.tagName); },
		querySelector: () => ring,
	};
	const node = { ...eventTarget(), contains: (item) => item === target };
	return { node, target, ring, animations };
}

test("pointer lighting coalesces movement and clears on leave, pause and detached content", (t) => {
	const env = environment(t);
	const { node, target } = feedbackFixture();
	const action = surfaceFeedback(node, true);
	node.emit("pointermove", target, { pointerType: "mouse", clientX: 110, clientY: 210 });
	node.emit("pointermove", target, { pointerType: "mouse", clientX: 130, clientY: 215 });
	assert.equal(env.frames.size, 1);
	env.flush();
	assert.equal(target.style["--light-x"], "30px");
	assert.equal(target.style["--light-y"], "15px");
	assert.equal(target.dataset.lightActive, "true");
	node.emit("pointerleave", target);
	assert.equal(target.dataset.lightActive, undefined);
	assert.equal(target.style["--light-x"], undefined);
	node.emit("pointermove", target, { pointerType: "touch" });
	assert.equal(env.frames.size, 0);
	node.emit("pointermove", target, { pointerType: "mouse", clientX: 130, clientY: 215 });
	action.update(false);
	env.flush();
	assert.equal(target.dataset.lightActive, undefined);
	action.update(true);
	target.isConnected = false;
	node.emit("pointermove", target, { pointerType: "mouse", clientX: 130, clientY: 215 });
	env.flush();
	assert.equal(target.dataset.lightActive, undefined);
	action.destroy();
	assert.equal(node.listeners.size, 0);
});

test("press rings preserve native activation and distinguish mouse, keyboard and disabled controls", (t) => {
	environment(t);
	const { node, target, ring, animations } = feedbackFixture();
	const action = surfaceFeedback(node, true);
	let intercepted = false;
	const nativeEvent = { button: 0, clientX: 130, clientY: 215, preventDefault() { intercepted = true; } };
	node.emit("pointerdown", target, nativeEvent);
	assert.equal(animations.length, 1);
	assert.equal(ring.style.left, "30px");
	assert.equal(ring.style.top, "15px");
	node.emit("keydown", target, { key: "Enter", repeat: false });
	assert.equal(animations[0].cancelled, true);
	assert.equal(ring.style.left, "80px");
	assert.equal(ring.style.top, "30px");
	assert.equal(intercepted, false);
	node.emit("keydown", target, { key: "Enter", repeat: true });
	node.emit("pointerdown", target, { ...nativeEvent, button: 2 });
	target.disabled = true;
	node.emit("pointerdown", target, nativeEvent);
	assert.equal(animations.length, 2);
	target.disabled = false;
	target.tagName = "A";
	node.emit("keydown", target, { key: " ", repeat: false });
	assert.equal(animations.length, 2);
	action.update(false);
	assert.equal(animations[1].cancelled, true);
	action.destroy();
	assert.equal(node.listeners.size, 0);
});

test("pointer and keyboard feedback stay centered on scaled map nodes", (t) => {
	const env = environment(t);
	const { node, target, ring } = feedbackFixture();
	target.offsetWidth = 320;
	target.offsetHeight = 120;
	const action = surfaceFeedback(node, true);
	node.emit("pointermove", target, { pointerType: "mouse", clientX: 130, clientY: 215 });
	env.flush();
	assert.equal(target.style["--light-x"], "60px");
	assert.equal(target.style["--light-y"], "30px");
	node.emit("pointerdown", target, { button: 0, clientX: 130, clientY: 215 });
	assert.equal(ring.style.left, "60px");
	assert.equal(ring.style.top, "30px");
	node.emit("keydown", target, { key: "Enter", repeat: false });
	assert.equal(ring.style.left, "160px");
	assert.equal(ring.style.top, "60px");
	action.destroy();
});

test("system reduced motion and touch hover allocate no effects; unmount cancels pending press feedback", (t) => {
	const env = environment(t);
	const { node, target, animations } = feedbackFixture();
	const action = surfaceFeedback(node, true);
	env.win.reduced = true;
	node.emit("pointermove", target, { pointerType: "mouse", clientX: 130, clientY: 215 });
	node.emit("pointerdown", target, { button: 0, clientX: 130, clientY: 215 });
	assert.equal(env.frames.size, 0);
	assert.equal(animations.length, 0);
	env.win.reduced = false;
	env.win.fine = false;
	node.emit("pointermove", target, { pointerType: "mouse", clientX: 130, clientY: 215 });
	assert.equal(env.frames.size, 0);
	node.emit("pointerdown", target, { button: 0, pointerType: "touch", clientX: 130, clientY: 215 });
	assert.equal(animations.length, 1);
	action.destroy();
	assert.equal(animations[0].cancelled, true);
	assert.equal(node.listeners.size, 0);
});
