import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/** Plasis mark: a text caret above a card ("type it, get the UI"). */
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1a1a19", borderRadius: 112 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 34, width: 300 }}>
          <div style={{ width: 26, height: 96, borderRadius: 13, background: "#3b5bdb", marginLeft: 30 }} />
          <div style={{ width: 300, height: 150, borderRadius: 40, background: "#ffffff" }} />
        </div>
      </div>
    ),
    size,
  );
}
