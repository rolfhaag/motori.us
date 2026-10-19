"use client";

import { useEffect } from "react";
import "photoswipe/style.css";

/**
 * Photo viewer for a Build's gallery, built on PhotoSwipe: pinch, double-tap
 * to zoom, one-finger pan when zoomed, swipe between photos at normal size,
 * swipe down to close. Navigation never fires while zoomed or pinching, which
 * is what the old hand-rolled lightbox got wrong.
 *
 * It attaches to the gallery grid that BuildPageView renders (the markup is
 * server-rendered; the filter tabs and "show more" are handled in site.js),
 * so there is nothing to wire per photo. Styling lives in site.css (.pswp).
 */
export default function GalleryLightbox() {
  useEffect(() => {
    const grid = document.getElementById("gallery-grid");
    if (!grid) return;
    let opening = false;

    // Photos in the category currently shown (the tab), in page order.
    function currentButtons(): HTMLElement[] {
      const active = document.querySelector<HTMLElement>(".gtab.active");
      const cat = active?.getAttribute("data-cat") ?? "all";
      const all = Array.from(grid!.querySelectorAll<HTMLElement>(".photo"));
      return cat === "all" ? all : all.filter((b) => b.getAttribute("data-cat") === cat);
    }

    async function onClick(e: Event) {
      const btn = (e.target as HTMLElement).closest<HTMLElement>(".photo");
      if (!btn || !grid!.contains(btn) || opening) return;
      e.preventDefault();
      opening = true;
      try {
        const { default: PhotoSwipe } = await import("photoswipe");
        const buttons = currentButtons();
        const index = Math.max(0, buttons.indexOf(btn));
        const dataSource = buttons.map((b) => {
          const img = b.querySelector("img") as HTMLImageElement | null;
          const cap = b.querySelector(".cap")?.textContent ?? "";
          const loaded = !!img && img.naturalWidth > 0;
          return {
            src: img?.currentSrc || img?.src || "",
            // PhotoSwipe needs a size up front; if a thumbnail has not loaded
            // yet we correct it as soon as the full image arrives (below).
            width: loaded ? img!.naturalWidth : 1600,
            height: loaded ? img!.naturalHeight : 1067,
            alt: img?.alt || "",
            caption: cap,
            sized: loaded,
          };
        });

        const pswp = new PhotoSwipe({
          dataSource,
          index,
          bgOpacity: 0.97,
          secondaryZoomLevel: 2, // double-tap goes to 2x
          maxZoomLevel: 5,
          wheelToZoom: true,
          closeTitle: "Close",
          zoomTitle: "Zoom",
          arrowPrevTitle: "Previous photo",
          arrowNextTitle: "Next photo",
          errorMsg: "This photo could not be loaded.",
          showHideAnimationType: "fade",
          preload: [1, 2],
        });

        // Caption under the photo.
        pswp.on("uiRegister", () => {
          pswp.ui?.registerElement({
            name: "motori-caption",
            order: 9,
            isButton: false,
            appendTo: "root",
            onInit: (el, p) => {
              const update = () => {
                const item = p.currSlide?.data as { caption?: string } | undefined;
                el.textContent = item?.caption ?? "";
                el.style.display = item?.caption ? "" : "none";
              };
              p.on("change", update);
              p.on("afterInit", update);
            },
          });
        });

        // Fix the size of photos whose thumbnails had not loaded yet.
        pswp.on("loadComplete", ({ content }) => {
          const data = content.data as { sized?: boolean };
          const el = content.element as HTMLImageElement | undefined;
          if (data.sized || !el || !el.naturalWidth) return;
          content.data.width = el.naturalWidth;
          content.data.height = el.naturalHeight;
          data.sized = true;
          content.slide?.updateContentSize(true);
        });

        // Keep the page from scrolling behind the viewer; hand focus back on close.
        pswp.on("destroy", () => btn.focus({ preventScroll: true }));
        pswp.init();
      } finally {
        opening = false;
      }
    }

    grid.addEventListener("click", onClick);
    return () => grid.removeEventListener("click", onClick);
  }, []);

  return null;
}
