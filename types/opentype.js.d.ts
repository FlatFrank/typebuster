declare module "opentype.js" {
  export type Command = {
    type: string;
    x?: number;
    y?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  };

  export type Path = {
    commands: Command[];
    toPathData: (options?: { decimalPlaces?: number }) => string;
  };

  export type Glyph = {
    index: number;
    unicode?: number;
    advanceWidth: number;
    getPath: (x: number, y: number, fontSize: number) => Path;
  };

  export type Font = {
    unitsPerEm: number;
    charToGlyph: (value: string) => Glyph;
    getKerningValue: (left: Glyph, right: Glyph) => number;
  };

  const opentype: {
    parse: (buffer: ArrayBuffer) => Font;
  };

  export default opentype;
}
