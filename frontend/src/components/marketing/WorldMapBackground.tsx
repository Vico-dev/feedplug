"use client";

/**
 * Carte du monde épurée en arrière-plan — DA FeedPlug (gris discret)
 * Forme simplifiée équirectangulaire, teinte #e5e7eb / #d1d5db
 */
export default function WorldMapBackground() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <svg
        viewBox="0 0 1000 500"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "160%",
          height: "160%",
          opacity: 0.22,
        }}
      >
        <defs>
          <linearGradient id="mapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#9ca3af" />
            <stop offset="100%" stopColor="#d1d5db" />
          </linearGradient>
        </defs>
        {/* Amérique du Nord */}
        <path
          fill="url(#mapGradient)"
          d="M 100 130 Q 180 80 280 100 L 320 130 L 330 180 L 310 240 L 270 280 L 200 270 L 140 230 L 90 180 Z"
        />
        {/* Amérique du Sud */}
        <path
          fill="url(#mapGradient)"
          d="M 250 270 L 290 260 L 320 300 L 310 380 L 260 430 L 200 420 L 170 360 L 180 300 Z"
        />
        {/* Europe */}
        <path
          fill="url(#mapGradient)"
          d="M 480 100 L 550 90 L 600 120 L 610 180 L 580 230 L 520 240 L 470 210 L 450 160 Z"
        />
        {/* Afrique */}
        <path
          fill="url(#mapGradient)"
          d="M 470 250 L 530 245 L 540 320 L 510 400 L 460 420 L 430 380 L 440 300 Z"
        />
        {/* Asie */}
        <path
          fill="url(#mapGradient)"
          d="M 560 90 L 700 70 L 850 100 L 920 160 L 900 250 L 820 310 L 700 300 L 600 250 L 540 180 Z"
        />
        {/* Inde / Asie du Sud */}
        <path
          fill="url(#mapGradient)"
          d="M 620 240 L 700 230 L 730 290 L 700 340 L 640 330 L 610 280 Z"
        />
        {/* Australie */}
        <path
          fill="url(#mapGradient)"
          d="M 720 320 L 880 300 L 920 350 L 900 420 L 820 450 L 740 420 L 700 370 Z"
        />
      </svg>
    </div>
  );
}
