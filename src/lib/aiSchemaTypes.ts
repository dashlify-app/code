/** Respuesta de POST /api/interpret-schema */
export type AISchemaInterpretation = {
  domain: string;
  narrative: string;
  /** Textos breves, accionables, en español */
  priorityInsights: string[];
  /**
   * Nombres de columna EXACTOS (deben existir en headers) o null si no aplica.
   * La API valida contra la lista; el cliente aplica con applyAIRoles.
   */
  columnRoles: Partial<{
    category: string | null;
    family: string | null;
    subfamily: string | null;
    productName: string | null;
    price: string | null;
    cost: string | null;
    stock: string | null;
    minStock: string | null;
    brand: string | null;
    supplier: string | null;
    country: string | null;
    leadDays: string | null;
    warehouse: string | null;
    rating: string | null;
    reviews: string | null;
    dateField: string | null;
  }>;
};

/** Almacenado en rawSchema.interpretation (incluye firma de columnas para invalidar cache) */
export type CachedSchemaInterpretation = AISchemaInterpretation & {
  headersSignature: string;
  savedAt: string;
};
