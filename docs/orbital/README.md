# Orbital archive

Run locally from the repository root:

```powershell
pnpm.cmd dev --host 127.0.0.1 --port 4321
```

Open <http://127.0.0.1:4321/hello-world/>.

The orbital welcome portal lives at `/hello-world/`, including its localized
routes under `/en/`, `/zh_TW/` and `/ja/`. The home routes redirect to these
entrances; legacy home URLs with search or category filters redirect to
`/articles/` while preserving the query and fragment. Enter the archive to reach
`/articles/`. The entrance focuses on the welcome message and entry action. A restrained
orbital instrument, staggered copy and a short departure share the site's existing
scenery and motion preference. Direct section/article links bypass the welcome
screen, as do legacy home URLs containing search or category filters. Back/forward
restore the entrance and archive by URL; reduced motion skips the departure
animation. The welcome screen remains usable without JavaScript.
The wordmark returns to the current locale's welcome route within the same page:
the archive fades out before the welcome copy and instrument arrive, keeping the
station scenery continuous. Modified clicks retain native link behavior. Back/forward,
reduced motion and component destruction cancel pending navigation delays.

The welcome and all section views share `SiteHeader.svelte` and the same shell
width, gutters and header height. Branding, language selection, article search
and GitHub stay in the same positions, including the shared mobile layout.
Welcome search opens the article archive on Enter, preserving the query and
input focus; typing alone keeps the welcome screen in place for IME composition.
Ctrl/Cmd+K focuses search on both the welcome and section views.

Orbital is the only production interface.

The site shares one visual system across the entrance, section views and readers.
`src/styles/orbital/tokens.css` defines the cool charcoal surfaces, warm-white
headings, four foreground levels and lemon-yellow signal. Self-hosted variable
fonts pair Noto Serif SC / Source Serif 4 headings with Noto Sans SC prose and
controls, Oswald display numbers and JetBrains Mono code. The blog wordmark and
profile signature use the self-hosted Allura script, with natural letter spacing
to keep its connections intact; compact card titles use a lighter serif weight than page
headings. Fontsource's Unicode ranges load only the required font segments, with
system fonts available while they load. Font licenses are included under
`public/fonts/licenses/`. Reading links use a softer yellow, and
merged/closed records retain distinct semantic colors. `theme.css` applies the
shared heading hierarchy and navigation proportions;
feature styles retain their layout and semantic status colors. New sections should
use these shared tokens rather than introducing their own palette or sidebar sizing.

It reads published Chinese posts and series from the existing Astro content
collections. The reader
uses the same rendered Markdown as the blog. Search, category and series filters,
chronological sorting, archive selection, in-page reading and section navigation
are interactive. The knowledge map displays actual series-to-series and
series-to-article relationships. Choose a topic, inspect a node and follow its
highlighted ancestry; articles open in the reader and series open the filtered
archive. The subject forms a circular core, child series form diamond hubs, and
articles appear as numbered satellites. Curved connections represent actual
ancestry; the faint orbital rings are decorative. Labels are placed to avoid
overlap. Zoom controls, fit-to-view, native scrolling and mouse dragging navigate
the canvas. Narrow screens retain the same spatial map, with a node selector for
locating articles and branches. The slow calibration-ring rotation respects
reduced-motion preferences.
The map is implemented in `KnowledgeAtlas.svelte` and `src/styles/orbital/map.css`.
The series directory
groups child series under their parents. The source and profile pages read the
existing contribution and profile configuration rather than placeholder data.
The source view uses suspended project ports, a contribution rail and a cut-corner
reading projection with a visible backplane. On desktop the workspace fits the
viewport, with aligned pane edges and independent scrolling for the record list
and reading content. A measured light path connects the selected visible record
to the reader and follows selection, scrolling and resizing. Its arrival motion
and the decorative orbital arc respect reduced-motion preferences. The reader's
crown shows the actual repository and selected record position; the scenery does
not represent live telemetry. Narrow screens omit the connecting path and backplane.
The panel shows the original commit message or PR/issue description, changed
files with expandable diffs, verified source references and recent discussions.
Commit trailers and discussions start collapsed. File summaries use GitHub's actual
addition/deletion counts, and diffs preserve the original unified patch text. Missing or
incomplete GitHub patches have an explicit source-link fallback. The compact record
identifier can be copied; repository and discussion links remain directly accessible.
Previous/next controls reveal the corresponding record in the rail and reset the
reader; on mobile the rail scrolls horizontally and the reader follows page scrolling.
This view uses `SourceDock.svelte`, `ContributionReader.svelte`, `src/styles/orbital/source.css`
and `src/styles/orbital/contribution-reader.css`.
It also reads `src/data/contribution-activity.json`, the public GitHub snapshot
used by the existing contribution page. The LLVM and Cargo docks include authored
or assigned open issues and pull requests from their upstream repositories, plus
open issues commented on by the account. The rail can filter PRs and issues, and
the inspector distinguishes draft/open status, authorship/assignment/discussion
participation, record numbers, update dates and the original URLs. These records
are not presented as merged commits. The snapshot time is shown in Beijing
time. Refresh with `pnpm sync:contributions`; the site itself uses no credentials
and does not make live GitHub requests from the browser. On the VPS, a separate
service refreshes persistent snapshots every 15 minutes and serves the same
`/contributions.json` URL. GitHub Pages keeps the build snapshot. Previously
tracked PRs/issues remain visible when merged or closed. See
[deployment](../deployment.md) for setup, data retention and rate limits.

Refresh the reading content with `pnpm sync:contribution-details` after refreshing
activity. This reads commit references from the shared `src/data/contribution-projects.json` and public activity from the existing snapshot. It writes
`src/data/contribution-details.json` only after all required requests succeed.
Repositories are checked against the activity allowlist. The details snapshot
includes all paginated discussion comments, inline replies and published review
conclusions (including approvals without body text). Bot records are retained and
labelled. Empty COMMENTED review envelopes are represented by their inline comments;
unsubmitted PENDING reviews are excluded. PR commit history and current head/base
SHAs identify the version of the aggregate file diff. References come from record
bodies or issue timeline cross-references; these are not inferred fixes.
Builds sanitize Markdown server-side, discard unsafe HTML and convert embedded
images into source links. Run `node scripts/test-contribution-reader.mjs` (Node 24)
to check HTML safety, patch classification and lossless text handling. No network access or GitHub
credentials are needed by the rendered reading panel.

Changed files use a unified patch view without a line-number gutter or table
headers. Raw `@@` hunk headers, `+`/`-` prefixes and indentation are preserved;
additions and deletions receive restrained color bands. Long lines scroll inside
the patch pane without widening the surrounding reader.

The revised UI uses a shared orbital environment, a curved navigation spine,
open document rows, and a dark reading terminal. The selected document is
highlighted on the archive rail and connected to its reading preview; the connection
tracks the preview while scrolling. All matching articles are available immediately
in a scrollable archive pane, with the preview kept alongside it. On smaller screens
the archive follows normal page scrolling. The document controls reveal the selected
article in the pane; search and category changes return the list to its beginning.
The series view puts its compact index and reading path directly below the page
heading. The empty-series toggle sits in the index, and the reading action sits
alongside the introduction to bring the article directory higher into view.
Desktop panels use the remaining viewport height with independent scrolling;
on narrow screens the series selector becomes a single horizontal rail that keeps
the current selection visible. Branch shortcuts jump to child-series chapters,
and article titles open the reader directly. Directory
ordering uses series `order`; article ordering respects `seriesOrder` and publication
dates. Empty series can be included with the directory toggle. Its layout is in
`src/styles/orbital/series.css` and `src/components/orbital/SeriesExplorer.svelte`.
The profile is the visual reference for all sections. The shared finishing layer in
`src/styles/orbital/articles.css` uses translucent graphite surfaces, fine
rules and restrained yellow selection marks. Article rows keep consistent type
and spacing when selected; the reading preview floats beside the scrollable index.
Series keep their compact reading layout, while the map and source projection
retain their orbital geometry with lighter surface treatment.
The profile view uses `ProfileDossier.svelte` and `src/styles/orbital/profile.css`: an orbital
portrait mount, a clear name and biography, topic shortcuts and a compact contact
directory. The avatar, name, biography and contact destinations come from the
existing profile configuration. Topic shortcuts open the Linux or hardware archive
filter and the source view. The decorative portrait orbit respects reduced motion;
the page contains no invented personal history or live status.
Project and contact symbols use the shared `BrandIcon.svelte` component and
`src/styles/orbital/icons.css`. Their geometry, provenance and monochrome treatment are
documented in [ICON-SOURCES.md](./ICON-SOURCES.md). Brand SVG paths are bundled
locally; the site does not depend on a remote icon service.
Desktop and mobile use the same design tokens; reduced-motion preferences are
respected. The immersive shell is in `src/styles/orbital/shell.css`, while the
quiet reading styles remain in `src/styles/orbital/reader.css`.

`src/styles/orbital/motion.css` adds staggered page reveals, selection feedback,
brief connector pulses and a slow moving backdrop. The footer motion control
stores a local on/off preference; the system's reduced-motion preference always
takes precedence. Ambient movement pauses while the article reader is open or
the page is hidden. Phones omit the large background transform and use fewer
ambient particles. Reveals of measured archive/source containers change opacity
only, so connector coordinates and scrolling geometry remain stable.

The richer interaction pass adds a navigation beacon measured from the active
navigation link, staggered row content on filter changes, branch-line reveals, moving
highlights along the selected graph's real ancestry, and reader open/close motion.
`src/components/orbital/motion.ts` cancels pending frames, delayed work and Web
Animations when a view unmounts or effects are disabled. Search reveals wait for
typing to settle. Desktop fine pointers also shift only the background by a few
pixels; touch layouts keep a fixed camera. Row hit targets and connection anchors
do not move with the animated text.

The shared environment at `public/images/orbital/station.webp` was generated using
the built-in image generation tool from the approved concept. The article panels,
labels, controls and transitions are HTML/CSS/Svelte, not baked into the image.
The background prompt asked to remove every UI element from the approved concept,
preserve its graphite orbital-station architecture and upper-right planetary
crescent, reconstruct the obscured scenery, and leave a quiet text-free surface.

Orbital is the production interface. Local development and preview commands do
not publish changes; pushes to `main` run the verified deployment workflow.

All page routes use `src/features/orbital/Page.astro`. Home, sections and dated article permalinks are generated by `src/pages/[...path].astro` into `dist/`. The article reader loads static article content on demand; contribution details load when the source view opens. See [architecture](../architecture.md) for maintenance boundaries and verification commands.
