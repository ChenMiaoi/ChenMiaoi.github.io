<script lang="ts">
import { onDestroy, onMount } from "svelte";
import type { GraphData, GraphNode } from "@utils/graph-utils";

export let data: GraphData;

let container: HTMLDivElement;
let graph: any;
let observer: MutationObserver;
let hoverNode: any = null;

const COLORS: Record<GraphNode["type"], string> = {
	post: "#7c97f8",
	tag: "#f5a97f",
	series: "#8bd5ca",
};
const RADII: Record<GraphNode["type"], number> = {
	post: 6,
	tag: 4,
	series: 5,
};
// zoom level above which post titles are always shown
const LABEL_ZOOM = 1.2;

onMount(() => {
	let isDark = document.documentElement.classList.contains("dark");
	let textColor = isDark ? "rgba(255,255,255,0.9)" : "rgba(30,30,30,0.85)";
	// keep label/link colors in sync with light/dark theme
	observer = new MutationObserver(() => {
		isDark = document.documentElement.classList.contains("dark");
		textColor = isDark ? "rgba(255,255,255,0.9)" : "rgba(30,30,30,0.85)";
	});
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class"],
	});

	// neighbor lookup for hover highlighting
	const neighbors = new Map<string, Set<string>>();
	for (const link of data.links) {
		if (!neighbors.has(link.source)) neighbors.set(link.source, new Set());
		if (!neighbors.has(link.target)) neighbors.set(link.target, new Set());
		neighbors.get(link.source)?.add(link.target);
		neighbors.get(link.target)?.add(link.source);
	}
	const isNeighborOfHover = (node: any) =>
		hoverNode && (node === hoverNode || neighbors.get(hoverNode.id)?.has(node.id));

	// dynamic import: force-graph must only run in the browser
	import("force-graph").then(({ default: ForceGraph }) => {
		graph = new ForceGraph(container)
			.graphData(data)
			.nodeId("id")
			.nodeCanvasObject((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
				const dimmed = hoverNode && !isNeighborOfHover(node);
				const r = RADII[node.type as GraphNode["type"]] ?? 4;
				ctx.beginPath();
				ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
				ctx.fillStyle = COLORS[node.type as GraphNode["type"]];
				ctx.globalAlpha = dimmed ? 0.25 : 1;
				ctx.fill();

				const showLabel =
					node.type !== "post" ||
					globalScale >= LABEL_ZOOM ||
					isNeighborOfHover(node);
				if (!showLabel) {
					ctx.globalAlpha = 1;
					return;
				}
				const fontSize = Math.max(11 / globalScale, 2);
				ctx.font = `${fontSize}px sans-serif`;
				ctx.textAlign = "center";
				ctx.textBaseline = "top";
				ctx.fillStyle = textColor;
				ctx.globalAlpha = dimmed ? 0.25 : isDark ? 1 : 0.85;
				ctx.fillText(node.label, node.x, node.y + r + fontSize * 0.3);
				ctx.globalAlpha = 1;
			})
			.nodePointerAreaPaint((node: any, color: string, ctx: CanvasRenderingContext2D) => {
				const r = (RADII[node.type as GraphNode["type"]] ?? 4) + 2;
				ctx.beginPath();
				ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
				ctx.fillStyle = color;
				ctx.fill();
			})
			.linkColor((link: any) => {
				const hovered =
					hoverNode &&
					(link.source.id === hoverNode.id ||
						link.target.id === hoverNode.id);
				if (isDark)
					return hovered
						? "rgba(255,255,255,0.8)"
						: "rgba(255,255,255,0.38)";
				return hovered ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.22)";
			})
			.onNodeHover((node: any) => {
				hoverNode = node ?? null;
				container.style.cursor = node ? "pointer" : "grab";
			})
			.warmupTicks(300)
			.cooldownTicks(0)
			.onEngineStop(() => {
				graph.zoomToFit(0, 60);
			})
			.onNodeClick((node: any) => {
				window.location.href = node.url;
			})
			.onNodeDragEnd((node: any) => {
				node.fx = node.x;
				node.fy = node.y;
			})
			.width(container.clientWidth)
			.height(container.clientHeight);

		window.addEventListener("resize", handleResize);
	});

	const handleResize = () => {
		graph?.width(container.clientWidth).height(container.clientHeight);
	};
});

onDestroy(() => {
	graph?.pauseAnimation();
	observer?.disconnect();
});
</script>

<div class="graph-wrap">
    <div bind:this={container} class="graph-canvas"></div>
    <div class="legend">
        <span><i style="background:{COLORS.post}"></i>post</span>
        <span><i style="background:{COLORS.series}"></i>series</span>
        <span><i style="background:{COLORS.tag}"></i>tag</span>
    </div>
</div>

<style>
    .graph-wrap {
        position: relative;
        height: 70vh;
        min-height: 28rem;
    }
    .graph-canvas {
        position: absolute;
        inset: 0;
        cursor: grab;
    }
    .graph-canvas:active {
        cursor: grabbing;
    }
    .legend {
        position: absolute;
        right: 0.75rem;
        bottom: 0.75rem;
        display: flex;
        gap: 0.9rem;
        font-size: 0.75rem;
        opacity: 0.75;
        pointer-events: none;
    }
    .legend span {
        display: flex;
        align-items: center;
        gap: 0.3rem;
    }
    .legend i {
        width: 0.6rem;
        height: 0.6rem;
        border-radius: 9999px;
        display: inline-block;
    }
</style>
