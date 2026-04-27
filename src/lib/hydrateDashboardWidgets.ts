/** Rehidrata sampleData de widgets guardados usando datasets actuales (por nombre o índice). */

export type DatasetRow = { name?: string; rawSchema?: { sampleData?: Record<string, unknown>[] } };

export function hydrateDashboardWidgets(
  rawWidgets: Array<{
    id: string;
    type: string;
    title?: string;
    category?: string;
    description?: string;
    config?: Record<string, unknown>;
  }>,
  datasets: DatasetRow[]
): Array<{
  id: string;
  type: string;
  title: string;
  category?: string;
  description?: string;
  config: Record<string, unknown>;
}> {
  return rawWidgets.map((w) => {
    const c = w.config && typeof w.config === 'object' ? { ...w.config } : {};
    const datasetIndex = typeof c.datasetIndex === 'number' ? c.datasetIndex : 0;
    const name =
      typeof c.datasetName === 'string' && c.datasetName.trim() ? c.datasetName.trim() : null;
    const byName = name ? datasets.find((ds) => ds.name === name) : undefined;
    const targetDataset = byName ?? datasets[datasetIndex];
    const fromDataset = targetDataset?.rawSchema?.sampleData || [];
    const embedded = Array.isArray(c.sampleData) ? c.sampleData : [];
    const sampleData = fromDataset.length > 0 ? fromDataset : embedded;
    const resolvedIndex = targetDataset ? Math.max(0, datasets.indexOf(targetDataset)) : datasetIndex;

    const title =
      typeof w.title === 'string' && w.title.trim()
        ? w.title
        : typeof c.title === 'string'
          ? c.title
          : w.type;

    return {
      id: w.id,
      type: w.type,
      title,
      category: typeof w.category === 'string' ? w.category : (c.category as string | undefined),
      description:
        typeof w.description === 'string' ? w.description : (c.description as string | undefined),
      config: {
        ...c,
        sampleData,
        datasetIndex: resolvedIndex,
        datasetName: (c.datasetName as string | undefined) ?? name ?? undefined,
      },
    };
  });
}
