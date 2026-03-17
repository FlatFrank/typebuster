import opentype, { type Font } from "opentype.js";

export type WorkbenchFontKey =
  | "archivo"
  | "dmSans"
  | "dmSerif"
  | "playfair"
  | "bricolage";

export type WorkbenchFontOption = {
  key: WorkbenchFontKey;
  label: string;
  licensePath: string;
};

type WorkbenchFontConfig = WorkbenchFontOption & {
  masters: {
    regular: string;
    thin?: string;
    black?: string;
  };
};

export type LoadedWorkbenchFontFamily = {
  key: WorkbenchFontKey;
  label: string;
  licensePath: string;
  thin: Font | null;
  regular: Font;
  black: Font | null;
};

export const WORKBENCH_FONT_OPTIONS: WorkbenchFontOption[] = [
  { key: "archivo", label: "Archivo", licensePath: "/licenses/Archivo-OFL.txt" },
  { key: "dmSans", label: "DM Sans", licensePath: "/licenses/DMSans-OFL.txt" },
  { key: "dmSerif", label: "DM Serif", licensePath: "/licenses/DMSerifDisplay-OFL.txt" },
  { key: "playfair", label: "Playfair", licensePath: "/licenses/PlayfairDisplay-OFL.txt" },
  {
    key: "bricolage",
    label: "Bricolage Grotesque",
    licensePath: "/licenses/BricolageGrotesque-OFL.txt"
  }
];

const WORKBENCH_FONT_CONFIGS: Record<WorkbenchFontKey, WorkbenchFontConfig> = {
  archivo: {
    key: "archivo",
    label: "Archivo",
    licensePath: "/licenses/Archivo-OFL.txt",
    masters: {
      thin: "/fonts/Archivo-VarThin.ttf",
      regular: "/fonts/Archivo-VarRegular.ttf",
      black: "/fonts/Archivo-VarBlack.ttf"
    }
  },
  dmSans: {
    key: "dmSans",
    label: "DM Sans",
    licensePath: "/licenses/DMSans-OFL.txt",
    masters: {
      thin: "/fonts/DMSans-Thin.ttf",
      regular: "/fonts/DMSans-Regular.ttf",
      black: "/fonts/DMSans-Black.ttf"
    }
  },
  dmSerif: {
    key: "dmSerif",
    label: "DM Serif",
    licensePath: "/licenses/DMSerifDisplay-OFL.txt",
    masters: {
      regular: "/fonts/DMSerifDisplay-Regular.ttf"
    }
  },
  playfair: {
    key: "playfair",
    label: "Playfair",
    licensePath: "/licenses/PlayfairDisplay-OFL.txt",
    masters: {
      thin: "/fonts/PlayfairDisplay-Thin.ttf",
      regular: "/fonts/PlayfairDisplay-Regular.ttf",
      black: "/fonts/PlayfairDisplay-Black.ttf"
    }
  },
  bricolage: {
    key: "bricolage",
    label: "Bricolage Grotesque",
    licensePath: "/licenses/BricolageGrotesque-OFL.txt",
    masters: {
      thin: "/fonts/BricolageGrotesque-Thin.ttf",
      regular: "/fonts/BricolageGrotesque-Regular.ttf",
      black: "/fonts/BricolageGrotesque-Black.ttf"
    }
  }
};

const workbenchFontPromises = new Map<WorkbenchFontKey, Promise<LoadedWorkbenchFontFamily>>();

async function loadFontFromUrl(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Unable to fetch font: ${url} (${response.status})`);
  }

  const buffer = await response.arrayBuffer();
  return opentype.parse(buffer);
}

export async function loadWorkbenchFontFamily(
  key: WorkbenchFontKey
): Promise<LoadedWorkbenchFontFamily> {
  const cached = workbenchFontPromises.get(key);

  if (cached) {
    return cached;
  }

  const config = WORKBENCH_FONT_CONFIGS[key];
  const promise = Promise.all([
    config.masters.thin ? loadFontFromUrl(config.masters.thin) : Promise.resolve(null),
    loadFontFromUrl(config.masters.regular),
    config.masters.black ? loadFontFromUrl(config.masters.black) : Promise.resolve(null)
  ]).then(([thin, regular, black]) => ({
    key: config.key,
    label: config.label,
    licensePath: config.licensePath,
    thin,
    regular,
    black
  }));

  workbenchFontPromises.set(key, promise);
  return promise;
}
