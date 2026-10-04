import { onSwupReady } from "./lifecycle";
import "./scrollbars";
import { siteConfig } from "../config";
import {
	BANNER_HEIGHT,
	BANNER_HEIGHT_EXTEND,
	BANNER_HEIGHT_HOME,
	MAIN_PANEL_OVERLAPS_BANNER_HEIGHT,
} from "../constants/constants";
import {
	getHue,
	getStoredTheme,
	setHue,
	setTheme,
} from "../utils/setting-utils";
import { isHomePath } from "../utils/url-utils";

const bannerEnabled = !!document.getElementById("banner-wrapper");

function setClickOutsideToClose(panel: string, ignores: string[]) {
	document.addEventListener("click", (event) => {
		const panelDom = document.getElementById(panel);
		const tDom = event.target;
		if (!(tDom instanceof Node)) return; // Ensure the event target is an HTML Node
		for (const ig of ignores) {
			const ie = document.getElementById(ig);
			if (ie === tDom || ie?.contains(tDom)) {
				return;
			}
		}
		panelDom?.classList.add("float-panel-closed");
	});
}
setClickOutsideToClose("display-setting", [
	"display-setting",
	"display-settings-switch",
]);
setClickOutsideToClose("nav-menu-panel", ["nav-menu-panel", "nav-menu-switch"]);
setClickOutsideToClose("search-panel", [
	"search-panel",
	"search-bar",
	"search-switch",
]);

function loadTheme() {
	const theme = getStoredTheme();
	setTheme(theme);
}

function loadHue() {
	setHue(getHue());
}

function showBanner() {
	if (!siteConfig.banner.enable) return;

	const banner = document.getElementById("banner");
	if (!banner) {
		console.error("Banner element not found");
		return;
	}

	banner.classList.remove("opacity-0", "scale-105");
}

function init() {
	loadTheme();
	loadHue();
	showBanner();
}

/* Load settings when entering the site */
init();

const setup = () => {
	window.swup.hooks.on("link:click", () => {
		// Remove the delay for the first time page load
		document.documentElement.style.setProperty("--content-delay", "0ms");

		// prevent elements from overlapping the navbar
		if (!bannerEnabled) {
			return;
		}
		const threshold = window.innerHeight * (BANNER_HEIGHT / 100) - 72 - 16;
		const navbar = document.getElementById("navbar-wrapper");
		if (!navbar || !document.body.classList.contains("lg:is-home")) {
			return;
		}
		if (
			document.body.scrollTop >= threshold ||
			document.documentElement.scrollTop >= threshold
		) {
			navbar.classList.add("navbar-hidden");
		}
	});
	window.swup.hooks.on("visit:start", (visit: { to: { url: string } }) => {
		// change banner height immediately when a link is clicked
		const bodyElement = document.querySelector("body");
		if (isHomePath(visit.to.url)) {
			bodyElement?.classList.add("lg:is-home");
		} else {
			bodyElement?.classList.remove("lg:is-home");
		}

		// increase the page height during page transition to prevent the scrolling animation from jumping
		const heightExtend = document.getElementById("page-height-extend");
		if (heightExtend) {
			heightExtend.classList.remove("hidden");
		}

		// Hide the TOC while scrolling back to top
		const toc = document.getElementById("toc-wrapper");
		if (toc) {
			toc.classList.add("toc-not-ready");
		}
	});
	window.swup.hooks.on("page:view", () => {
		// hide the temp high element when the transition is done
		const heightExtend = document.getElementById("page-height-extend");
		if (heightExtend) {
			heightExtend.classList.remove("hidden");
		}
	});
	window.swup.hooks.on("visit:end", (_visit: { to: { url: string } }) => {
		setTimeout(() => {
			const heightExtend = document.getElementById("page-height-extend");
			if (heightExtend) {
				heightExtend.classList.add("hidden");
			}

			// Just make the transition looks better
			const toc = document.getElementById("toc-wrapper");
			if (toc) {
				toc.classList.remove("toc-not-ready");
			}
		}, 200);
	});
};
onSwupReady(setup);

function scrollFunction() {
	const backToTopBtn = document.getElementById("back-to-top-btn");
	const toc = document.getElementById("toc-wrapper");
	const navbar = document.getElementById("navbar-wrapper");
	const bannerHeight = window.innerHeight * (BANNER_HEIGHT / 100);

	if (backToTopBtn) {
		if (
			document.body.scrollTop > bannerHeight ||
			document.documentElement.scrollTop > bannerHeight
		) {
			backToTopBtn.classList.remove("hide");
		} else {
			backToTopBtn.classList.add("hide");
		}
	}

	if (bannerEnabled && toc) {
		if (
			document.body.scrollTop > bannerHeight ||
			document.documentElement.scrollTop > bannerHeight
		) {
			toc.classList.remove("toc-hide");
		} else {
			toc.classList.add("toc-hide");
		}
	}

	if (!bannerEnabled) return;
	if (navbar) {
		const NAVBAR_HEIGHT = 72;
		const MAIN_PANEL_EXCESS_HEIGHT = MAIN_PANEL_OVERLAPS_BANNER_HEIGHT * 16; // The height the main panel overlaps the banner

		let bannerHeight = BANNER_HEIGHT;
		if (
			document.body.classList.contains("lg:is-home") &&
			window.innerWidth >= 1024
		) {
			bannerHeight = BANNER_HEIGHT_HOME;
		}
		const threshold =
			window.innerHeight * (bannerHeight / 100) -
			NAVBAR_HEIGHT -
			MAIN_PANEL_EXCESS_HEIGHT -
			16;
		if (
			document.body.scrollTop >= threshold ||
			document.documentElement.scrollTop >= threshold
		) {
			navbar.classList.add("navbar-hidden");
		} else {
			navbar.classList.remove("navbar-hidden");
		}
	}
}
window.addEventListener("scroll", scrollFunction, { passive: true });

function resize() {
	// calculate the --banner-height-extend, which needs to be a multiple of 4 to avoid blurry text
	let offset = Math.floor(window.innerHeight * (BANNER_HEIGHT_EXTEND / 100));
	offset = offset - (offset % 4);
	document.documentElement.style.setProperty(
		"--banner-height-extend",
		`${offset}px`,
	);
}

window.addEventListener("resize", resize);
resize();
