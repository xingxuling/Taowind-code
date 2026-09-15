export type WorldConfig = { seed: number; biomes: string[] };

export class WorldGenerator {
  constructor(private config: WorldConfig) {}

  generate() {
    return {
      seed: this.config.seed,
      regions: this.config.biomes.map((biome, index) => ({ id: index + 1, biome })),
      status: 'ready',
    };
  }
}
