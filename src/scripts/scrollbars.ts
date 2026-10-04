import "overlayscrollbars/overlayscrollbars.css";
import { OverlayScrollbars } from "overlayscrollbars";
import { registerPageLifecycle } from "./lifecycle";

function mountScrollbars() {
	const bodyElement = document.querySelector("body");
	if (!bodyElement) return;
	OverlayScrollbars(
		// docs say that a initialization to the body element would affect native functionality like window.scrollTo
		// but just leave it here for now
		{
			target: bodyElement,
			cancel: {
				nativeScrollbarsOverlaid: true, // don't initialize the overlay scrollbar if there is a native one
			},
		},
		{
			scrollbars: {
				theme: "scrollbar-base scrollbar-auto py-1",
				autoHide: "move",
				autoHideDelay: 500,
				autoHideSuspend: false,
			},
		},
	);

	const instances: ReturnType<typeof OverlayScrollbars>[] = [];
	const katexElements = document.querySelectorAll(
		".katex-display",
	) as NodeListOf<HTMLElement>;

	const katexObserverOptions = {
		root: null,
		rootMargin: "100px",
		threshold: 0.1,
	};

	const processKatexElement = (element: HTMLElement) => {
		if (!element.parentNode) return;
		if (element.hasAttribute("data-scrollbar-initialized")) return;

		const container = document.createElement("div");
		container.className = "katex-display-container";
		container.setAttribute("aria-label", "scrollable container for formulas");

		element.parentNode.insertBefore(container, element);
		container.appendChild(element);

		instances.push(
			OverlayScrollbars(container, {
				scrollbars: {
					theme: "scrollbar-base scrollbar-auto",
					autoHide: "leave",
					autoHideDelay: 500,
					autoHideSuspend: false,
				},
			}),
		);

		element.setAttribute("data-scrollbar-initialized", "true");
	};

	const katexObserver = new IntersectionObserver((entries, observer) => {
		entries.forEach((entry) => {
			if (entry.isIntersecting) {
				processKatexElement(entry.target as HTMLElement);
				observer.unobserve(entry.target);
			}
		});
	}, katexObserverOptions);

	katexElements.forEach((element) => {
		katexObserver.observe(element);
	});
	return () => {
		katexObserver.disconnect();
		for (const instance of instances) instance.destroy();
	};
}

registerPageLifecycle(mountScrollbars);
