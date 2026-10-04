# Orbital icon sources

`BrandIcon.svelte` and `orbital-icons.css` share one monochrome icon treatment:
optically adjusted sizes, graphite cut-corner frames, pale green neutral marks,
and yellow selection, hover and keyboard-focus states. Small inline uses omit
the frame. The same symbols identify the same projects throughout the preview.
Text labels remain visible; adjacent decorative SVGs are hidden from assistive
technology to avoid repeating the label. Everything is bundled locally.

## Brand silhouettes

The Linux, LLVM, GitHub and Zhihu paths in `brand-paths.ts` are unchanged geometry
from [Simple Icons](https://github.com/simple-icons/simple-icons), version 16.33.0,
distributed via [Iconify's icon sets](https://github.com/iconify/icon-sets/blob/master/json/simple-icons.json).
Simple Icons distributes these paths under [CC0-1.0](https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md).
Color and optical scale are presentation styles, not a claim of endorsement.
Individual brand names and marks belong to their respective owners.

LLVM's dragon identity was checked against the [LLVM logo page](https://llvm.org/Logo.html).

## Original interface symbols

Cargo uses a purpose-drawn isometric package crate with a strap and a shipping
mark, inspired by its package-management role and the crate motif shown in the
[Cargo Book](https://doc.rust-lang.org/cargo/). It is an interface symbol, not an
exact reproduction of the official Cargo logo. The chip, code and envelope
symbols are also original vectors, using 1.5-unit strokes on a 24-unit grid.

Contact icons follow the configured GitHub, Zhihu and email destinations.
Unknown platform names receive a neutral terminal symbol, with their text label
and existing destination retained.
