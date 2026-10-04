import React from "react";

// Decorative artwork only. UI text and all controls remain real HTML.
export function HeaderArt() {
  return (
    <img
      className="header-art"
      src={import.meta.env.BASE_URL + "illustrations/windowsill.webp"}
      alt=""
      aria-hidden="true"
      width="1200"
      height="400"
      decoding="async"
    />
  );
}
