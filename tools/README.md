# Shirt mockup asset pipeline

Rebuilds `assets/mockups/*` from the source artwork. Run in order, from this folder:

```bash
node logo_1_render_ai.js    # rasterize assets/source/*.ai  -> page1.png (2400px)
node logo_2_measure.js      # measure the artwork's two lines + the old logo footprint
node logo_3_build_assets.js # write {tee,crop}-base.jpg / -hyrox.png / -koda.png
node logo_4_verify_sheet.js # contact sheet to eyeball the result
```

The scripts write intermediates into a scratchpad dir (see the constant at the top of each
file) and only the final three files per garment into `assets/mockups/`.

## How the mockups work

Each garment renders as three stacked layers, in `index.html` (CSS `mask-image` for the live
preview) and again on a `<canvas>` in `renderMockJpeg()` for the confirmation email:

| Layer | File | Behavior |
|---|---|---|
| Garment | `{tee,crop}-base.jpg` | blank black shirt, no print |
| HYROX wordmark | `{tee,crop}-hyrox.png` | white+alpha mask, **tinted** to the chosen vinyl color |
| KODA CROSSFIT | `{tee,crop}-koda.png` | white+alpha mask, **always white** |

`GARMENTS[g].logoY` in `index.html` is the HYROX line's vertical span as a fraction of the
frame — the gold/silver metallic gradients are positioned with it. **If you rebuild the assets
at a different size or position, update `logoY` to the values printed by
`logo_3_build_assets.js`,** or the metallics will band in the wrong place.

## Placement

The new lockup is matched to the OLD logo's chest position: the HYROX line takes the old
wordmark's width and horizontal centre, and the whole lockup is centred on the old lockup's
vertical centre. Source garment photos (which still carry the old print) live in
`../../koda-hyrox-shirts/assets/`; the build erases that old print by infilling the green
wordmark and the white sub-text with the shirt's own black.

Source artwork: `assets/source/HYROX-Designs-01.ai` (PDF-based .ai — pdf.js can rasterize it
directly; no Ghostscript needed on this machine).
