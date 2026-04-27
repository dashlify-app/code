'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { FilterProvider } from './FilterContext';
import { SortableWidget } from './SortableWidget';

export type SavedWidgetVM = {
  id: string;
  title: string;
  type: string;
  category?: string;
  description?: string;
  config: Record<string, unknown>;
};

function regroupFromWidgets(list: SavedWidgetVM[]) {
  const acc: Record<string, SavedWidgetVM[]> = {};
  for (const w of list) {
    const k = w.category?.trim() || '💡 General';
    if (!acc[k]) acc[k] = [];
    acc[k].push(w);
  }
  return acc;
}

function CategorySection({
  category,
  items,
  onReorder,
}: {
  category: string;
  items: SavedWidgetVM[];
  onReorder: (category: string, next: SavedWidgetVM[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((w) => w.id === active.id);
    const newIndex = items.findIndex((w) => w.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(category, arrayMove(items, oldIndex, newIndex));
  };

  return (
    <section>
      <div className="sb-label" style={{ marginBottom: 12 }}>
        // {category}
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((w) => w.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-4 lg:grid-cols-3 lg:gap-6 mb-4">
            {items.map((w) => (
              <SortableWidget key={w.id} id={w.id} widget={w} theme="modern" isDark={false} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}

/**
 * Panel Visualizar: mismos gráficos que el canvas guardado, agrupados por categoría de IA (emoji + nombre).
 * Arrastrar desde el título para reordenar dentro de cada categoría.
 */
export function SavedDashboardWidgetsGrid({ widgets }: { widgets: SavedWidgetVM[] }) {
  const [groupedState, setGroupedState] = useState<Record<string, SavedWidgetVM[]>>(() => regroupFromWidgets(widgets));

  const idsSignature = useMemo(() => [...widgets].map((w) => w.id).sort().join(','), [widgets]);

  useEffect(() => {
    setGroupedState((prev) => {
      const flatPrev = Object.values(prev).flat();
      const prevSig = [...flatPrev].map((w) => w.id).sort().join(',');
      if (prevSig !== idsSignature) {
        return regroupFromWidgets(widgets);
      }
      const m = new Map(widgets.map((w) => [w.id, w]));
      const out: Record<string, SavedWidgetVM[]> = {};
      for (const [cat, list] of Object.entries(prev)) {
        const merged = list.map((w) => m.get(w.id)).filter(Boolean) as SavedWidgetVM[];
        if (merged.length) out[cat] = merged;
      }
      for (const w of widgets) {
        const k = w.category?.trim() || '💡 General';
        const cur = out[k] ?? [];
        if (!cur.some((x) => x.id === w.id)) {
          if (!out[k]) out[k] = [];
          out[k].push(w);
        }
      }
      return out;
    });
  }, [widgets, idsSignature]);

  const onReorder = useCallback((category: string, next: SavedWidgetVM[]) => {
    setGroupedState((s) => ({ ...s, [category]: next }));
  }, []);

  if (!widgets.length) return null;

  const entries = Object.entries(groupedState).sort(([a], [b]) => a.localeCompare(b, 'es'));

  return (
    <FilterProvider>
      <div className="saved-dashboard-widgets space-y-8 mb-8">
        {entries.map(([category, items]) => (
          <CategorySection key={category} category={category} items={items} onReorder={onReorder} />
        ))}
      </div>
    </FilterProvider>
  );
}
