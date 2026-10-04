<script lang="ts">
  import { brandPaths } from "./brand-paths";

  export let name: string;
  export let size = 24;
  export let framed = true;
  $: normalized = name.toLowerCase();
  $: key = normalized === "llvm-project" ? "llvm" : normalized === "email" ? "mail" : normalized === "知乎" ? "zhihu" : normalized;
</script>

<span class="brand-insignia" class:insignia-framed={framed} data-brand={key} style={`--requested-icon-size:${size}px`} aria-hidden="true">
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" focusable="false">
    {#if brandPaths[key]}
      <path fill="currentColor" d={brandPaths[key]}/>
    {:else if key === "cargo"}
      <g stroke="currentColor" stroke-width="1.5" stroke-linejoin="miter"><path d="m12 2 9 5v10l-9 5-9-5V7Z M3 7l9 5 9-5 M12 12v10 M8 4.2l9 5V14 M7 15l2 1.1"/><path d="m3 7 9 5v10l-9-5Z" fill="currentColor" fill-opacity=".1"/></g>
    {:else if key === "mail"}
      <g stroke="currentColor" stroke-width="1.5" stroke-linejoin="miter"><path d="M3 5h15l3 3v11H3Z M3 6l9 7 8-6 M3 19l6-7 M21 19l-6-7"/></g>
    {:else if key === "chip"}
      <g stroke="currentColor" stroke-width="1.5" stroke-linecap="square"><path d="M7 5h10l2 2v12H5V5Z M9 9h6v6H9Z M8 2v3 M12 2v3 M16 2v3 M8 19v3 M12 19v3 M16 19v3 M2 8h3 M2 12h3 M2 16h3 M19 8h3 M19 12h3 M19 16h3"/></g>
    {:else if key === "code"}
      <g stroke="currentColor" stroke-width="1.5" stroke-linecap="square"><path d="m7 6-5 6 5 6 M17 6l5 6-5 6 M14 3l-4 18"/></g>
    {:else}
      <g stroke="currentColor" stroke-width="1.5"><path d="m12 3 9 9-9 9-9-9Z M8 12h8 M12 8v8"/></g>
    {/if}
  </svg>
</span>
