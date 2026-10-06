<script lang="ts">
  import { useTranslations } from "../../features/orbital/i18n/context";
  const { t } = useTranslations();
  import { tick } from "svelte";
  import { revealSequence } from "./motion";
  import { fly } from "svelte/transition";
  import TerminalIcon from "./TerminalIcon.svelte";
  import type { ArchivePost, ArchiveSeries } from "./types";

  export let posts: ArchivePost[];
  export let series: ArchiveSeries[];
  export let reducedMotion = false;
  export let onRead: (post: ArchivePost) => void;
  export let onBrowse: (slug: string) => void;

  type MapNode = {
    id: string; kind: "series" | "post"; title: string; label: string;
    parent: string; depth: number; x: number; y: number; w: number; h: number;
    cx: number; cy: number; above?: boolean; leftLabel?: boolean;
    collection?: ArchiveSeries; post?: ArchivePost; ordinal: number;
  };
  const shortTitle = (title: string) => title.split(/[：:]/)[0];
  const seriesOrder = (a: ArchiveSeries, b: ArchiveSeries) =>
    (a.order ?? Number.POSITIVE_INFINITY) - (b.order ?? Number.POSITIVE_INFINITY) || a.title.localeCompare(b.title);
  const articleOrder = (a: ArchivePost, b: ArchivePost) =>
    (a.seriesOrder ?? Number.POSITIVE_INFINITY) - (b.seriesOrder ?? Number.POSITIVE_INFINITY) || a.timestamp - b.timestamp || a.slug.localeCompare(b.slug);

  let scope = "";
  let selectedId = "";
  let hoveredId = "";
  let focusedId = "";
  let viewport: HTMLDivElement;
  let viewportWidth = 800;
  let viewportHeight = 540;
  let zoom = 1;
  let dragging = false;
  let dragOrigin: { x: number; y: number; left: number; top: number } | null = null;

  $: roots = series.filter((item) => !item.parent && item.posts.length).sort(seriesOrder);
  $: current = roots.find((item) => item.slug === scope) ?? [...roots].sort((a, b) => b.posts.length - a.posts.length)[0];
  $: compact = viewportWidth < 650;
  $: sceneWidth = Math.max(780, viewportWidth - 24);
  $: map = current ? buildMap(current, sceneWidth) : { nodes: [] as MapNode[], height: 600 };
  $: selected = map.nodes.find((node) => node.id === selectedId) ?? map.nodes.find((node) => node.kind === "post") ?? map.nodes[0];
  $: activePath = ancestorPath(selected, map.nodes);
  $: previewNode = map.nodes.find((node) => node.id === (hoveredId || focusedId));
  $: previewPath = ancestorPath(previewNode, map.nodes);
  $: collectionNodes = map.nodes.filter((node) => node.kind === "series");
  $: articleNodes = map.nodes.filter((node) => node.kind === "post");
  $: focusedSeries = selected?.collection ?? series.find((item) => item.slug === selected?.post?.series);
  $: scopeTitle = current ? shortTitle(current.title) : t("暂无主题");
  $: if (compact && current && viewport) centerCore(current.slug);

  function buildMap(root: ArchiveSeries, width: number) {
    const nodes: MapNode[] = [];
    const height = 600;
    const center = { x: width * .47, y: height * .5 };
    let ordinal = 0;
    const radians = (degrees: number) => degrees * Math.PI / 180;
    const collectionNode = (collection: ArchiveSeries, depth: number, parent: string, cx: number, cy: number): MapNode => {
      const above = depth > 0 && cy < center.y - 30;
      return { id: `series:${collection.slug}`, kind: "series", title: collection.title, label: shortTitle(collection.title), collection, parent, depth, cx, cy, x: cx - (depth ? 75 : 82), y: cy - (depth ? above ? 62 : 18 : 82), w: depth ? 150 : 164, h: depth ? 82 : 164, above, ordinal: 0 };
    };
    const rootNode = collectionNode(root, 0, "", center.x, center.y);
    nodes.push(rootNode);
    const pendingPosts: { post: ArchivePost; parent: MapNode; cx: number; cy: number }[] = [];
    const addBranch = (collection: ArchiveSeries, parent: MapNode, angle: number, depth: number) => {
      const radiusX = depth === 1 ? width * .265 : 115;
      const radiusY = depth === 1 ? 158 : 90;
      const node = collectionNode(collection, depth, parent.id, parent.cx + Math.cos(radians(angle)) * radiusX, parent.cy + Math.sin(radians(angle)) * radiusY);
      nodes.push(node);
      const childSeries = series.filter((item) => item.parent === collection.slug).sort(seriesOrder);
      childSeries.forEach((child, index) => { addBranch(child, node, angle + (index - (childSeries.length - 1) / 2) * 70, depth + 1); });
      const documents = posts.filter((post) => post.series === collection.slug).sort(articleOrder);
      documents.forEach((post, index) => {
        const spread = documents.length > 1 ? 120 : 0;
        const direction = angle + (documents.length > 1 ? index / (documents.length - 1) - .5 : 0) * spread;
        pendingPosts.push({ post, parent: node, cx: node.cx + Math.cos(radians(direction)) * 105, cy: node.cy + Math.sin(radians(direction)) * 88 });
      });
    };
    const children = series.filter((item) => item.parent === root.slug).sort(seriesOrder);
    children.forEach((child, index) => { addBranch(child, rootNode, children.length === 1 ? -35 : children.length === 2 ? -45 + index * 180 : -60 + index * 360 / children.length, 1); });
    posts.filter((post) => post.series === root.slug).sort(articleOrder).forEach((post, index, list) => {
      const angle = children.length ? 120 + index * 40 : list.length === 1 ? -20 : -120 + index * 240 / (list.length - 1);
      pendingPosts.push({ post, parent: rootNode, cx: center.x + Math.cos(radians(angle)) * width * .30, cy: center.y + Math.sin(radians(angle)) * 244 });
    });
    const overlaps = (a: MapNode, b: MapNode) => a.x < b.x + b.w + 9 && a.x + a.w + 9 > b.x && a.y < b.y + b.h + 9 && a.y + a.h + 9 > b.y;
    for (const { post, parent, cx, cy } of pendingPosts) {
      const leftLabel = cx < center.x;
      const offsets = [0, -45, 45, -90, 90, -135, 135];
      let chosen: MapNode | undefined;
      for (const dx of [0, -45, 45, -90, 90]) {
        for (const dy of offsets) {
          const x = Math.max(16, Math.min(width - 184, cx + dx - (leftLabel ? 156 : 12)));
          const y = Math.max(22, Math.min(height - 74, cy + dy - 26));
          const candidate: MapNode = { id: `post:${post.slug}`, kind: "post", title: post.title, label: post.title.split("：")[0], post, parent: parent.id, depth: parent.depth + 1, x, y, w: 168, h: 52, cx: x + (leftLabel ? 156 : 12), cy: y + 26, leftLabel, ordinal: ordinal + 1 };
          if (!nodes.some((placed) => overlaps(candidate, placed))) { chosen = candidate; break; }
        }
        if (chosen) break;
      }
      if (!chosen) {
        const y = height + 40 + ordinal * 65;
        chosen = { id: `post:${post.slug}`, kind: "post", title: post.title, label: post.title.split("：")[0], post, parent: parent.id, depth: parent.depth + 1, x: width - 200, y, w: 168, h: 52, cx: width - 188, cy: y + 26, ordinal: ordinal + 1 };
      }
      nodes.push(chosen);
      ordinal++;
    }
    const bottom = Math.max(height, ...nodes.map((node) => node.y + node.h + 20));
    return { nodes, height: bottom };
  }

  function ancestorPath(node: MapNode | undefined, nodes: MapNode[]) {
    const path = new Set<string>();
    let currentNode = node;
    while (currentNode && !path.has(currentNode.id)) {
      path.add(currentNode.id);
      currentNode = nodes.find((item) => item.id === currentNode?.parent);
    }
    return path;
  }

  function connection(node: MapNode) {
    const parent = map.nodes.find((item) => item.id === node.parent);
    if (!parent) return "";
    const dx = node.cx - parent.cx;
    const dy = node.cy - parent.cy;
    const length = Math.hypot(dx, dy) || 1;
    const startRadius = parent.depth === 0 ? 80 : 19;
    const endRadius = node.kind === "post" ? 10 : 19;
    const start = { x: parent.cx + dx / length * startRadius, y: parent.cy + dy / length * startRadius };
    const end = { x: node.cx - dx / length * endRadius, y: node.cy - dy / length * endRadius };
    return `M${start.x} ${start.y}Q${(start.x + end.x) / 2 - dy / length * 17} ${(start.y + end.y) / 2 + dx / length * 17} ${end.x} ${end.y}`;
  }

  function fitMap() {
    zoom = Math.min(1, (viewportWidth - 24) / sceneWidth, (viewportHeight - 24) / map.height);
  }

  function observeViewport(node: HTMLDivElement) {
    const observer = new ResizeObserver(() => {
      viewportWidth = node.clientWidth;
      viewportHeight = node.clientHeight;
    });
    observer.observe(node);
    return { destroy: () => observer.disconnect() };
  }

  async function changeScope() {
    selectedId = "";
    hoveredId = "";
    focusedId = "";
    zoom = 1;
    await tick();
    viewport?.scrollTo({ top: 0, left: compact ? map.nodes[0].cx - viewport.clientWidth / 2 : 0, behavior: "instant" });
  }

  async function centerCore(_slug: string) {
    await tick();
    if (compact && viewport) viewport.scrollTo({ left: map.nodes[0].cx - viewport.clientWidth / 2, top: 45, behavior: "instant" });
  }

  async function locateNode(id: string) {
    selectedId = id;
    await tick();
    const node = map.nodes.find((item) => item.id === id);
    if (node) viewport.scrollTo({ left: node.cx * zoom - viewport.clientWidth / 2, top: node.cy * zoom - viewport.clientHeight / 2, behavior: "instant" });
  }

  async function resetView() {
    fitMap();
    await tick();
    viewport?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }

  async function changeZoom(direction: number) {
    const previous = zoom;
    const centerX = (viewport.scrollLeft + viewport.clientWidth / 2) / previous;
    const centerY = (viewport.scrollTop + viewport.clientHeight / 2) / previous;
    zoom = Math.max(.35, Math.min(1.8, Math.round((zoom + direction * .2) * 100) / 100));
    await tick();
    viewport.scrollTo({ left: centerX * zoom - viewport.clientWidth / 2, top: centerY * zoom - viewport.clientHeight / 2, behavior: "instant" });
  }

  function startDrag(event: PointerEvent) {
    if (event.pointerType !== "mouse" || event.button !== 0 || (event.target as Element).closest("button")) return;
    event.preventDefault();
    dragging = true;
    dragOrigin = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
    viewport.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent) {
    if (!dragOrigin) return;
    viewport.scrollLeft = dragOrigin.left - (event.clientX - dragOrigin.x);
    viewport.scrollTop = dragOrigin.top - (event.clientY - dragOrigin.y);
  }

  function endDrag() { dragging = false; dragOrigin = null; }
</script>

<section class="topology-console" class:compact aria-label={t("知识星图探索")}>
  <div class="topology-toolbar">
    <label class="topology-scope"><span>{t("探索主题")}</span><select value={current?.slug ?? ''} onchange={(event) => { scope = event.currentTarget.value; changeScope(); }} aria-label={t("选择地图主题")}>{#each roots as root}<option value={root.slug}>{shortTitle(root.title)}</option>{/each}</select><TerminalIcon name="arrow" size={14}/></label>
    <div class="topology-key" aria-label={t("节点图例")}><span><i class="series-symbol"></i>{t("系列")}</span><span><i class="article-symbol"></i>{t("文章")}</span></div>
    <div class="topology-tools"><button aria-label={t("缩小地图")} disabled={zoom <= .35} onclick={() => changeZoom(-1)}>−</button><span aria-live="polite">{Math.round(zoom * 100)}%</span><button aria-label={t("放大地图")} disabled={zoom >= 1.8} onclick={() => changeZoom(1)}>+</button><button class="topology-reset" onclick={resetView}>{t("完整星图")}</button></div>
  </div>

  <div class="topology-map">
    <div class="topology-map-label"><span>{t("星图")} <i>/</i> {t("知识星图")}</span><span>{t("{v0} 个系列节点", { v0: collectionNodes.length })} <i>·</i> {t("{v0} 篇文章", { v0: articleNodes.length })}</span></div>
    <div class="topology-viewport" class:dragging bind:this={viewport} use:observeViewport role="region" aria-label={t("{v0}关系图，可滚动或拖动查看", { v0: scopeTitle })} tabindex="0" onpointerdown={startDrag} onpointermove={moveDrag} onpointerup={endDrag} onpointercancel={endDrag} onlostpointercapture={endDrag}>
      <div class="topology-plane" style={`width:${sceneWidth * zoom}px;height:${map.height * zoom}px`}>
        <div class="topology-scene" use:revealSequence={{key: current?.slug ?? "", enabled: !reducedMotion, selector: ".stellar-series-label, .topology-article-title", wait: 80}} style={`width:${sceneWidth}px;height:${map.height}px;transform:scale(${zoom})`}>
          <svg class="stellar-environment" viewBox={`0 0 ${sceneWidth} ${map.height}`} aria-hidden="true">
            {#each Array.from({length:48}, (_, index) => index) as index}<circle class="stellar-dust" cx={(index * 137.51 + 23) % sceneWidth} cy={(index * 83.17 + 41) % 600} r={index % 7 === 0 ? 1.2 : .6}/>{/each}
            {#if map.nodes[0]}
              {@const core = map.nodes[0]}
              <g class="stellar-orbits" transform={`rotate(-17 ${core.cx} ${core.cy})`}>
                <ellipse cx={core.cx} cy={core.cy} rx={sceneWidth * .43} ry="215"/>
                <ellipse class="orbit-measure" cx={core.cx} cy={core.cy} rx={sceneWidth * .39} ry="191"/>
                <ellipse class="orbit-inner" cx={core.cx} cy={core.cy} rx={sceneWidth * .285} ry="135"/>
                <path class="orbit-highlight" d={`M${core.cx-sceneWidth*.43} ${core.cy}a${sceneWidth*.43} 215 0 0 1 ${sceneWidth*.15} -162`}/>
              </g>
              <g class="stellar-rotor" style={`transform-origin:${core.cx}px ${core.cy}px`}><circle cx={core.cx} cy={core.cy} r="106"/><circle class="rotor-ticks" cx={core.cx} cy={core.cy} r="119"/></g>
            {/if}
          </svg>
          <svg class="topology-lines" viewBox={`0 0 ${sceneWidth} ${map.height}`} aria-hidden="true">
            {#each map.nodes.filter((node) => node.parent).sort((a, b) => Number(activePath.has(a.id)) - Number(activePath.has(b.id))) as node}<path class:lit={activePath.has(node.id)} d={connection(node)}/>{/each}
            {#key selected?.id}
              {#each map.nodes.filter((node) => node.parent && activePath.has(node.id)) as node}<path class="map-acquisition" pathLength="1" d={connection(node)} style={`--path-delay:${Math.max(0, node.depth - 1) * 100}ms`}/><path class="map-flow" pathLength="1" d={connection(node)} style={`--path-delay:${Math.max(0, node.depth - 1) * -1.1}s`}/>{/each}
              {#each map.nodes.filter((node) => node.parent === selected?.id) as node, index}<path class="map-outbound" pathLength="1" d={connection(node)} style={`--path-delay:${index * 65}ms`}/>{/each}
            {/key}
            {#key previewNode?.id}
              {#each map.nodes.filter((node) => node.parent && previewPath.has(node.id)) as node}<path class="map-preview" pathLength="1" d={connection(node)} style={`--path-delay:${Math.max(0, node.depth - 1) * 70}ms`}/>{/each}
            {/key}
          </svg>
          {#each map.nodes as node (node.id)}
            <button class="topology-node" class:root-node={node.depth === 0} class:series-node={node.kind === 'series'} class:article-node={node.kind === 'post'} class:label-above={node.above} class:label-left={node.leftLabel} class:selected={selected?.id === node.id} class:on-path={activePath.has(node.id)} class:previewed={previewPath.has(node.id)} style={`left:${node.x}px;top:${node.y}px;width:${node.w}px;height:${node.h}px;--anchor-x:${node.cx-node.x}px;--anchor-y:${node.cy-node.y}px`} aria-label={t(node.kind === 'post' ? "预览：{v0}" : "查看节点：{v0}", { v0: node.title })} aria-pressed={selected?.id === node.id} title={node.title} onpointermove={(event) => { if (event.pointerType === 'mouse' && !dragging) hoveredId = node.id; }} onpointerleave={() => { if (hoveredId === node.id) hoveredId = ''; }} onfocus={() => { focusedId = node.id; hoveredId = ''; }} onblur={() => { if (focusedId === node.id) focusedId = ''; }} onclick={() => { selectedId = node.id; }}>
              {#if node.depth === 0}<span class="core-overline">{t("当前主题")}</span><strong>{node.label}</strong><small>{t("{v0} 篇文章", { v0: node.collection?.posts.length ?? 0 })}</small>
              {:else if node.kind === "series"}<span class="stellar-hub" aria-hidden="true"><i></i></span><span class="stellar-series-label"><strong>{node.label}</strong><small>{t("{v0} 篇文章", { v0: node.collection?.posts.length ?? 0 })}</small></span>
              {:else}<span class="topology-document-dot" aria-hidden="true">{String(node.ordinal).padStart(2, '0')}</span><span class="topology-article-title">{node.label}</span>{/if}
            </button>
          {/each}
        </div>
      </div>
    </div>
    <div class="topology-map-foot"><span><i></i>{t("系列归属路径")}</span><span>{t("选择节点聚焦 · 拖动探索")}</span></div>
    {#if compact}<label class="stellar-mobile-locate"><span>{t("定位节点")}</span><select aria-label={t("定位星图节点")} value={selected?.id} onchange={(event) => locateNode(event.currentTarget.value)}>{#each map.nodes as node}<option value={node.id}>{node.title}</option>{/each}</select></label>{/if}
  </div>

  {#if selected}
    <section class="topology-inspector" aria-labelledby="topology-selection-title">
      <div class="topology-selection-mark" aria-hidden="true"><TerminalIcon name={selected.kind === 'post' ? 'article' : 'series'} size={24}/></div>
      {#key selected.id}<div class="topology-selection-content" in:fly={{x: reducedMotion ? 0 : 8, duration: reducedMotion ? 0 : 240}}><p class="topology-selection-meta"><span>{selected.kind === 'post' ? t("文章节点") : selected.depth ? t("子系列节点") : t("主题节点")}</span><i>/</i>{selected.post?.date ?? t("{v0} 篇文章", { v0: selected.collection?.posts.length ?? 0 })}</p><h2 id="topology-selection-title">{selected.title}</h2><p class="topology-selection-description">{selected.post?.description ?? selected.collection?.description}</p><span class="topology-selection-parent">{selected.kind === 'post' ? focusedSeries?.title : selected.depth ? series.find((item) => item.slug === selected.collection?.parent)?.title : t("选择分支，探索主题下的文章。")}</span></div>{/key}
      <button class="topology-open" onclick={() => { if (selected.post) onRead(selected.post); else if (selected.collection) onBrowse(selected.collection.slug); }}>{selected.kind === 'post' ? t("进入阅读") : t("浏览系列")}<TerminalIcon name="external" size={20}/></button>
    </section>
  {/if}
</section>
