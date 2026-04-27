/**
 * SERVICE CONFIGURATION
 * Parámetros centrales del servicio: planes, límites, precios, etc.
 */

export const SERVICE_PLANS = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;

export type ServicePlan = (typeof SERVICE_PLANS)[keyof typeof SERVICE_PLANS];

export interface PlanConfig {
  name: string;
  displayName: string;
  price: number; // USD/mes
  currency: string;
  billing: 'monthly' | 'yearly';
  limits: {
    widgets: number; // Número máximo de gráficas/widgets
    datasets: number; // Número máximo de datasets
    dashboards: number; // Número máximo de dashboards
    datasetRows: number; // Máximo de filas por dataset
    datasetColumns: number; // Máximo de columnas por dataset
    multiDatasetAnalysis: number; // Máximo de datasets en análisis cruzado
    aiTokensPerMonth: number | null; // Tokens de IA por mes (null = ilimitado)
    exportFormats: string[]; // Formatos de exportación permitidos
    customBranding: boolean;
    apiAccess: boolean;
    prioritySupport: boolean;
    sso: boolean;
  };
  features: {
    semanticViews: boolean;
    crossDatasetAnalysis: boolean;
    advancedCharts: boolean;
    aiInsights: boolean;
    customDashboards: boolean;
    dataQuality: boolean;
    correlationAnalysis: boolean;
    customWidgets: boolean;
  };
}

export const PLANS: Record<ServicePlan, PlanConfig> = {
  [SERVICE_PLANS.FREE]: {
    name: 'Free',
    displayName: 'Plan Gratuito',
    price: 0,
    currency: 'USD',
    billing: 'monthly',
    limits: {
      widgets: 20,
      datasets: 5,
      dashboards: 2,
      datasetRows: 1000,
      datasetColumns: 50,
      multiDatasetAnalysis: 2,
      aiTokensPerMonth: 100000, // ~500 análisis
      exportFormats: ['png', 'csv'],
      customBranding: false,
      apiAccess: false,
      prioritySupport: false,
      sso: false,
    },
    features: {
      semanticViews: true,
      crossDatasetAnalysis: true,
      advancedCharts: true,
      aiInsights: true,
      customDashboards: true,
      dataQuality: false,
      correlationAnalysis: true,
      customWidgets: false,
    },
  },
  [SERVICE_PLANS.PRO]: {
    name: 'Pro',
    displayName: 'Plan Profesional',
    price: 29,
    currency: 'USD',
    billing: 'monthly',
    limits: {
      widgets: 500,
      datasets: 100,
      dashboards: 50,
      datasetRows: 100000,
      datasetColumns: 200,
      multiDatasetAnalysis: 10,
      aiTokensPerMonth: 2000000, // ~10,000 análisis
      exportFormats: ['png', 'csv', 'pdf', 'json'],
      customBranding: true,
      apiAccess: true,
      prioritySupport: true,
      sso: false,
    },
    features: {
      semanticViews: true,
      crossDatasetAnalysis: true,
      advancedCharts: true,
      aiInsights: true,
      customDashboards: true,
      dataQuality: true,
      correlationAnalysis: true,
      customWidgets: true,
    },
  },
  [SERVICE_PLANS.ENTERPRISE]: {
    name: 'Enterprise',
    displayName: 'Plan Empresarial',
    price: 0, // Custom pricing
    currency: 'USD',
    billing: 'yearly',
    limits: {
      widgets: 10000,
      datasets: 1000,
      dashboards: 500,
      datasetRows: 10000000, // Sin límite práctico
      datasetColumns: 500,
      multiDatasetAnalysis: 50,
      aiTokensPerMonth: null, // Ilimitado
      exportFormats: ['png', 'csv', 'pdf', 'json', 'excel', 'powerpoint'],
      customBranding: true,
      apiAccess: true,
      prioritySupport: true,
      sso: true,
    },
    features: {
      semanticViews: true,
      crossDatasetAnalysis: true,
      advancedCharts: true,
      aiInsights: true,
      customDashboards: true,
      dataQuality: true,
      correlationAnalysis: true,
      customWidgets: true,
    },
  },
};

/**
 * Precios de API y recursos
 */
export const PRICING = {
  ai: {
    gpt4o: {
      inputTokenPrice: 0.000005, // USD por token
      outputTokenPrice: 0.000015, // USD por token
      model: 'gpt-4o',
    },
    gpt35turbo: {
      inputTokenPrice: 0.0000015,
      outputTokenPrice: 0.000006,
      model: 'gpt-3.5-turbo',
    },
  },
  storage: {
    costPerGB: 0.023, // USD por GB/mes
    freeGB: 1, // GB gratis por plan
  },
  support: {
    email: 'free',
    priority: 29, // USD/mes adicionales
    phone: 99, // USD/mes adicionales
  },
};

/**
 * Límites de rate limiting
 */
export const RATE_LIMITS = {
  free: {
    requestsPerMinute: 10,
    requestsPerHour: 500,
  },
  pro: {
    requestsPerMinute: 60,
    requestsPerHour: 10000,
  },
  enterprise: {
    requestsPerMinute: 1000,
    requestsPerHour: null, // Sin límite
  },
};

/**
 * Obtener configuración de plan del usuario
 */
export function getPlanConfig(plan: ServicePlan): PlanConfig {
  return PLANS[plan] || PLANS[SERVICE_PLANS.FREE];
}

/**
 * Verificar si un usuario tiene acceso a una característica
 */
export function hasFeature(
  plan: ServicePlan,
  feature: keyof PlanConfig['features']
): boolean {
  const config = getPlanConfig(plan);
  return config.features[feature] === true;
}

/**
 * Verificar si se ha excedido un límite
 */
export function checkLimit(
  plan: ServicePlan,
  limitType: 'widgets' | 'datasets' | 'dashboards' | 'datasetRows' | 'datasetColumns' | 'multiDatasetAnalysis' | 'aiTokensPerMonth',
  currentValue: number
): { exceeded: boolean; limit: number | null; remaining: number | null } {
  const config = getPlanConfig(plan);
  const limit = config.limits[limitType] as number | null;

  if (limit === null) {
    // Sin límite
    return { exceeded: false, limit: null, remaining: null };
  }

  const exceeded = currentValue >= limit;
  const remaining = Math.max(0, limit - currentValue);

  return { exceeded, limit, remaining };
}

/**
 * Tabla de comparación de planes para mostrar en UI
 */
export const COMPARISON_TABLE = [
  {
    category: 'Límites Básicos',
    items: [
      {
        label: 'Widgets/Gráficas',
        free: '20',
        pro: '500',
        enterprise: '10,000',
      },
      {
        label: 'Dashboards',
        free: '2',
        pro: '50',
        enterprise: '500',
      },
      {
        label: 'Datasets',
        free: '5',
        pro: '100',
        enterprise: '1,000',
      },
      {
        label: 'Filas por Dataset',
        free: '1,000',
        pro: '100,000',
        enterprise: '10,000,000',
      },
      {
        label: 'Columnas por Dataset',
        free: '50',
        pro: '200',
        enterprise: '500',
      },
    ],
  },
  {
    category: 'Análisis de Datos',
    items: [
      {
        label: 'Análisis Cruzado Multi-Dataset',
        free: 'Hasta 2',
        pro: 'Hasta 10',
        enterprise: 'Hasta 50',
      },
      {
        label: 'Vistas Semánticas',
        free: '✓',
        pro: '✓',
        enterprise: '✓',
      },
      {
        label: 'Gráficos Avanzados',
        free: '✓',
        pro: '✓',
        enterprise: '✓',
      },
      {
        label: 'Insights con IA',
        free: '✓ (100K tokens/mes)',
        pro: '✓ (2M tokens/mes)',
        enterprise: '✓ (Ilimitado)',
      },
      {
        label: 'Análisis de Correlación',
        free: '✓',
        pro: '✓',
        enterprise: '✓',
      },
      {
        label: 'Calidad de Datos',
        free: '✗',
        pro: '✓',
        enterprise: '✓',
      },
    ],
  },
  {
    category: 'Exportación y Integración',
    items: [
      {
        label: 'Formatos de Exportación',
        free: 'PNG, CSV',
        pro: 'PNG, CSV, PDF, JSON',
        enterprise: 'PNG, CSV, PDF, JSON, Excel, PowerPoint',
      },
      {
        label: 'API Access',
        free: '✗',
        pro: '✓',
        enterprise: '✓',
      },
      {
        label: 'Widgets Personalizados',
        free: '✗',
        pro: '✓',
        enterprise: '✓',
      },
      {
        label: 'Branding Personalizado',
        free: '✗',
        pro: '✓',
        enterprise: '✓',
      },
    ],
  },
  {
    category: 'Soporte y Seguridad',
    items: [
      {
        label: 'Soporte',
        free: 'Email',
        pro: 'Email Prioritario',
        enterprise: 'Prioritario + Phone',
      },
      {
        label: 'SSO/SAML',
        free: '✗',
        pro: '✗',
        enterprise: '✓',
      },
      {
        label: 'Rate Limiting',
        free: '10 req/min',
        pro: '60 req/min',
        enterprise: '1000 req/min',
      },
    ],
  },
  {
    category: 'Precio',
    items: [
      {
        label: 'Costo Mensual',
        free: 'Gratis',
        pro: '$29/mes',
        enterprise: 'Custom',
      },
    ],
  },
];
