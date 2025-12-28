export type WallpaperId = "hpx-amber" | "hpx-night" | "hpx-steel" | "custom-url";

export type Wallpaper = {
  id: WallpaperId;
  nameHu: string;
  css: (customUrl?: string) => string;
};

export const WALLPAPERS: Wallpaper[] = [
  {
    id: "hpx-amber",
    nameHu: "HPX Borostyán",
    css: () => `
      radial-gradient(900px 520px at 30% 20%, rgba(255, 216, 76, 0.20), transparent 60%),
      radial-gradient(820px 520px at 80% 55%, rgba(120, 180, 255, 0.12), transparent 60%),
      linear-gradient(180deg, rgba(6, 7, 12, 0.72), rgba(8, 10, 18, 0.52))
    `,
  },
  {
    id: "hpx-night",
    nameHu: "Éjszaka",
    css: () => `
      radial-gradient(900px 520px at 60% 25%, rgba(180, 120, 255, 0.16), transparent 60%),
      radial-gradient(820px 520px at 20% 70%, rgba(255, 216, 76, 0.10), transparent 60%),
      linear-gradient(180deg, rgba(5, 6, 10, 0.80), rgba(10, 12, 20, 0.52))
    `,
  },
  {
    id: "hpx-steel",
    nameHu: "Acél",
    css: () => `
      radial-gradient(900px 520px at 35% 25%, rgba(255, 255, 255, 0.10), transparent 60%),
      radial-gradient(820px 520px at 80% 60%, rgba(255, 216, 76, 0.12), transparent 60%),
      linear-gradient(180deg, rgba(8, 10, 16, 0.76), rgba(10, 12, 20, 0.50))
    `,
  },
  {
    id: "custom-url",
    nameHu: "Egyedi URL",
    css: (customUrl?: string) => {
      const url = (customUrl ?? "").trim();
      if (!url) {
        return `
          radial-gradient(900px 520px at 50% 35%, rgba(255, 216, 76, 0.14), transparent 60%),
          linear-gradient(180deg, rgba(6, 7, 12, 0.78), rgba(8, 10, 18, 0.55))
        `;
      }

      // Magyar komment: kép + “film” overlay (hogy olvasható maradjon)
      return `
        linear-gradient(180deg, rgba(0,0,0,0.40), rgba(0,0,0,0.18)),
        url("${url}")
      `;
    },
  },
];
