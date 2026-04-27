'use client';

import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
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

/**
 * Panel Visualizar: mismos gráficos que el canvas guardado, agrupados por categoría de IA (emoji + nombre).
 */
export function SavedDashboardWidgetsGrid({ widgets }: { widgets: SavedWidgetVM[] }) {
  if (!widgets.length) return null;

  const grouped = widgets.reduce<Record<string, SavedWidgetVM[]>>((acc, w) => {
    const k = w.category?.trim() || '💡 General';
    if (!acc[k]) acc[k] = [];
    acc[k].push(w);
    return acc;
  }, {});

  const entries = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b, 'es'));
  const allIds = widgets.map((w) => w.id);

  return (
    <FilterProvider>
      <DndContext collisionDetection={closestCenter} onDragEnd={() => {}}>
        <SortableContext items={allIds} strategy={rectSortingStrategy}>
          <div className="saved-dashboard-widgets space-y-8 mb-8">
            {entries.map(([category, items]) => (
              <section key={category}>
                <div className="sb-label" style={{ marginBottom: 12 }}>
                  // {category}
                </div>
                <div
                  className="widget-grid"
                  style={{
                    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
                  }}
                >
                  {items.map((w) => (
                    <SortableWidget
                      key={w.id}
                      id={w.id}
                      widget={w}
                      theme="modern"
                      isDark={false}
                      disableDrag
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </FilterProvider>
  );
}
