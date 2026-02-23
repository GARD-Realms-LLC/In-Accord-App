import splashUrl from "../../Images/splash.png";

const css = `/* BEGIN IA LOADER */
/* =============== */

#ia-loading-icon {
  position: fixed;
  bottom: 8px;
  right: 8px;
  z-index: 2147483647;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  pointer-events: none;
  user-select: none;
}

#ia-loading-icon .ia-loading-icon-img {
  width: 100%;
  height: 100%;
  border-radius: 6px;
  image-rendering: auto;
  transform-origin: 50% 50%;
  animation: ia-loading-spin 950ms linear infinite;
  filter: drop-shadow(0 2px 10px rgba(0,0,0,0.35));
}

@keyframes ia-loading-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  #ia-loading-icon .ia-loading-icon-img {
    animation: none;
  }
}

/* =============== */
/*  END IA LOADER  */`;

const iconStyle = document.createElement("style");
iconStyle.id = "ia-loading-icon-style";
iconStyle.textContent = css;

const loadingIcon = document.createElement("div");
loadingIcon.id = "ia-loading-icon";
loadingIcon.className = "ia-loaderv2";
loadingIcon.title = "InAccord is loading...";

const img = document.createElement("img");
img.className = "ia-loading-icon-img";
img.alt = "InAccord";
img.draggable = false;
img.src = splashUrl;
loadingIcon.appendChild(img);

export default class {
  static show() {
    try {
      if (!document.getElementById(iconStyle.id)) document.body.appendChild(iconStyle);
    }
    catch {
      try {
        if (!document.getElementById(iconStyle.id)) document.head.appendChild(iconStyle);
      }
      catch {}
    }

    try {
      if (!document.getElementById("ia-loading-icon")) document.body.appendChild(loadingIcon);
    }
    catch {}
  }

  static hide() {
    if (iconStyle) iconStyle.remove();
    if (loadingIcon) loadingIcon.remove();
  }
}