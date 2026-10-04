<script lang="ts">
  export let name = "article";
  export let size = 24;
  const paths: Record<string, string> = {
    article: "M5 3h14v18H5z M9 7h6 M9 11h6 M9 15h4",
    series: "m12 3 10 5-10 5L2 8z M2 12l10 5 10-5 M2 16l10 5 10-5",
    graph: "m6 17 5-11m2 0 5 11M7 19h10 M12 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4 M5 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4 M19 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4",
    code: "m7 6-5 6 5 6 m10-12 5 6-5 6 M14 3l-4 18",
    about: "M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M4 21v-3c0-3 3-5 8-5s8 2 8 5v3z",
    search: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 m5 12 6 6",
    arrow: "m9 5 7 7-7 7",
    external: "M6 18 18 6 M6 6h12v12",
    close: "m5 5 14 14 M5 19 19 5",
    back: "m10 5-7 7 7 7 M3 12h18",
    sort: "M8 4v16m-4-4 4 4 4-4 M15 6h6 M15 10h4 M15 14h2",
    pause: "M8 5v14 M16 5v14",
    play: "m7 4 12 8-12 8z",
  };
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d={paths[name] || paths.article} /></svg>
