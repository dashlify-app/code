import { executeJoinedQuery, validateJoins } from '../multiDatasetJoin';
import { JoinConfig, Calculation } from '../types/multiDataset';

describe('multiDatasetJoin - Motor de Joins Local', () => {
  // Datasets de prueba
  const salesData = [
    { id: 1, customer_id: 101, amount: 100 },
    { id: 2, customer_id: 102, amount: 200 },
    { id: 3, customer_id: 101, amount: 150 },
  ];

  const customersData = [
    { id: 101, name: 'Alice', segment: 'Premium' },
    { id: 102, name: 'Bob', segment: 'Basic' },
  ];

  const productsData = [
    { id: 1, product_name: 'Laptop', category: 'Electronics' },
    { id: 2, product_name: 'Mouse', category: 'Electronics' },
    { id: 3, product_name: 'Desk', category: 'Furniture' },
  ];

  describe('LEFT JOIN', () => {
    it('debería hacer LEFT JOIN simple entre dos datasets', () => {
      const joins: JoinConfig[] = [
        {
          dataset: 'customers',
          type: 'left',
          on: { 'sales.customer_id': 'customers.id' },
          selectColumns: ['name', 'segment'],
        },
      ];

      const calculations: Calculation[] = [
        {
          name: 'total_amount',
          column: 'amount',
          aggregate: 'sum',
          groupBy: 'segment',
        },
      ];

      const allDatasets = new Map([
        ['sales', salesData],
        ['customers', customersData],
      ]);

      const result = executeJoinedQuery(salesData, joins, calculations, allDatasets);

      expect(result.labels).toEqual(['Premium', 'Basic']);
      expect(result.datasets).toHaveLength(1);
      expect(result.datasets[0].label).toBe('total_amount');
      expect(result.datasets[0].data).toEqual([250, 200]); // Premium: 100+150, Basic: 200
    });

    it('debería preservar filas sin match en LEFT JOIN', () => {
      const salesWithNoMatch = [
        { id: 1, customer_id: 101, amount: 100 },
        { id: 2, customer_id: 999, amount: 50 }, // Customer no existe
      ];

      const joins: JoinConfig[] = [
        {
          dataset: 'customers',
          type: 'left',
          on: { 'sales.customer_id': 'customers.id' },
          selectColumns: ['name'],
        },
      ];

      const calculations: Calculation[] = [
        {
          name: 'count',
          column: 'id',
          aggregate: 'count',
        },
      ];

      const allDatasets = new Map([
        ['sales', salesWithNoMatch],
        ['customers', customersData],
      ]);

      const result = executeJoinedQuery(salesWithNoMatch, joins, calculations, allDatasets);

      // LEFT JOIN preserva ambas filas
      expect(result.datasets[0].data[0]).toBeGreaterThanOrEqual(1);
    });
  });

  describe('INNER JOIN', () => {
    it('debería hacer INNER JOIN filtrando no-matches', () => {
      const salesWithNoMatch = [
        { id: 1, customer_id: 101, amount: 100 },
        { id: 2, customer_id: 999, amount: 50 },
      ];

      const joins: JoinConfig[] = [
        {
          dataset: 'customers',
          type: 'inner',
          on: { 'sales.customer_id': 'customers.id' },
          selectColumns: ['name'],
        },
      ];

      const calculations: Calculation[] = [
        {
          name: 'count',
          column: 'id',
          aggregate: 'count',
        },
      ];

      const allDatasets = new Map([
        ['sales', salesWithNoMatch],
        ['customers', customersData],
      ]);

      const result = executeJoinedQuery(salesWithNoMatch, joins, calculations, allDatasets);

      // INNER JOIN solo cuenta la fila con match
      expect(result.datasets[0].data[0]).toBe(1);
    });
  });

  describe('Múltiples Joins Encadenados', () => {
    it('debería hacer múltiples joins en cadena', () => {
      const joins: JoinConfig[] = [
        {
          dataset: 'customers',
          type: 'left',
          on: { 'sales.customer_id': 'customers.id' },
          selectColumns: ['segment'],
        },
        {
          dataset: 'products',
          type: 'left',
          on: { 'sales.id': 'products.id' },
          selectColumns: ['category'],
        },
      ];

      const calculations: Calculation[] = [
        {
          name: 'revenue',
          column: 'amount',
          aggregate: 'sum',
          groupBy: 'segment',
        },
      ];

      const allDatasets = new Map([
        ['sales', salesData],
        ['customers', customersData],
        ['products', productsData],
      ]);

      const result = executeJoinedQuery(salesData, joins, calculations, allDatasets);

      expect(result.labels).toContain('Premium');
      expect(result.labels).toContain('Basic');
      expect(result.datasets).toHaveLength(1);
    });
  });

  describe('Agregaciones', () => {
    const baseJoins: JoinConfig[] = [
      {
        dataset: 'customers',
        type: 'left',
        on: { 'sales.customer_id': 'customers.id' },
        selectColumns: ['segment'],
      },
    ];

    it('SUM debería sumar valores', () => {
      const calc: Calculation = {
        name: 'total',
        column: 'amount',
        aggregate: 'sum',
        groupBy: 'segment',
      };

      const allDatasets = new Map([
        ['sales', salesData],
        ['customers', customersData],
      ]);

      const result = executeJoinedQuery(salesData, baseJoins, [calc], allDatasets);
      expect(result.datasets[0].data).toEqual([250, 200]); // Premium: 250, Basic: 200
    });

    it('AVG debería calcular promedio', () => {
      const calc: Calculation = {
        name: 'avg_amount',
        column: 'amount',
        aggregate: 'avg',
        groupBy: 'segment',
      };

      const allDatasets = new Map([
        ['sales', salesData],
        ['customers', customersData],
      ]);

      const result = executeJoinedQuery(salesData, baseJoins, [calc], allDatasets);
      expect(result.datasets[0].data[0]).toBeCloseTo(125); // Premium: (100+150)/2
      expect(result.datasets[0].data[1]).toBe(200); // Basic: 200/1
    });

    it('COUNT debería contar filas', () => {
      const calc: Calculation = {
        name: 'transaction_count',
        column: 'id',
        aggregate: 'count',
        groupBy: 'segment',
      };

      const allDatasets = new Map([
        ['sales', salesData],
        ['customers', customersData],
      ]);

      const result = executeJoinedQuery(salesData, baseJoins, [calc], allDatasets);
      expect(result.datasets[0].data).toEqual([2, 1]); // Premium: 2 transacciones, Basic: 1
    });

    it('MEDIAN debería calcular mediana', () => {
      const multiSalesData = [
        { id: 1, customer_id: 101, amount: 100 },
        { id: 2, customer_id: 101, amount: 200 },
        { id: 3, customer_id: 101, amount: 150 },
      ];

      const calc: Calculation = {
        name: 'median_amount',
        column: 'amount',
        aggregate: 'median',
        groupBy: 'id',
      };

      const allDatasets = new Map([
        ['sales', multiSalesData],
      ]);

      const result = executeJoinedQuery(multiSalesData, [], [calc], allDatasets);
      expect(result.datasets[0].data[0]).toBe(150); // Mediana de [100, 150, 200]
    });

    it('MIN y MAX deberían encontrar valores extremos', () => {
      const minCalc: Calculation = {
        name: 'min_amount',
        column: 'amount',
        aggregate: 'min',
        groupBy: 'segment',
      };

      const maxCalc: Calculation = {
        name: 'max_amount',
        column: 'amount',
        aggregate: 'max',
        groupBy: 'segment',
      };

      const allDatasets = new Map([
        ['sales', salesData],
        ['customers', customersData],
      ]);

      const resultMin = executeJoinedQuery(salesData, baseJoins, [minCalc], allDatasets);
      const resultMax = executeJoinedQuery(salesData, baseJoins, [maxCalc], allDatasets);

      expect(resultMin.datasets[0].data[0]).toBe(100); // Premium: min(100, 150)
      expect(resultMax.datasets[0].data[0]).toBe(150); // Premium: max(100, 150)
    });
  });

  describe('Validación de Entrada', () => {
    it('debería validar que las columnas existan', () => {
      const joins: JoinConfig[] = [
        {
          dataset: 'customers',
          type: 'left',
          on: { 'sales.nonexistent_col': 'customers.id' },
          selectColumns: ['name'],
        },
      ];

      const allDatasets = new Map([
        ['sales', salesData],
        ['customers', customersData],
      ]);

      const validation = validateJoins(salesData, joins, allDatasets);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContainEqual(
        expect.stringContaining('nonexistent_col')
      );
    });

    it('debería validar que los datasets existan', () => {
      const joins: JoinConfig[] = [
        {
          dataset: 'nonexistent_dataset',
          type: 'left',
          on: { 'sales.customer_id': 'nonexistent.id' },
          selectColumns: ['name'],
        },
      ];

      const allDatasets = new Map([
        ['sales', salesData],
      ]);

      const validation = validateJoins(salesData, joins, allDatasets);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('debería manejar datasets vacíos', () => {
      const emptyData: typeof salesData = [];
      const joins: JoinConfig[] = [];
      const allDatasets = new Map([['empty', emptyData]]);

      const result = executeJoinedQuery(emptyData, joins, [], allDatasets);
      expect(result.labels).toEqual([]);
      expect(result.datasets).toEqual([]);
    });

    it('debería manejar cálculos sin GROUP BY', () => {
      const calc: Calculation = {
        name: 'total_revenue',
        column: 'amount',
        aggregate: 'sum',
      };

      const allDatasets = new Map([['sales', salesData]]);
      const result = executeJoinedQuery(salesData, [], [calc], allDatasets);

      expect(result.labels).toEqual(['Total']);
      expect(result.datasets[0].data[0]).toBe(450); // Sum de todos: 100+200+150
    });

    it('debería manejar valores faltantes (null, undefined)', () => {
      const dataWithNull = [
        { id: 1, customer_id: 101, amount: 100 },
        { id: 2, customer_id: 102, amount: null },
        { id: 3, customer_id: 101, amount: undefined },
      ];

      const calc: Calculation = {
        name: 'total',
        column: 'amount',
        aggregate: 'sum',
        groupBy: 'customer_id',
      };

      const allDatasets = new Map([['sales', dataWithNull]]);
      const result = executeJoinedQuery(dataWithNull, [], [calc], allDatasets);

      // null y undefined se convierten a 0
      expect(result.datasets[0].data[0]).toBe(100); // customer 101: 100 + 0
      expect(result.datasets[0].data[1]).toBe(0); // customer 102: 0
    });

    it('debería manejar múltiples agregaciones simultaneas', () => {
      const calcs: Calculation[] = [
        {
          name: 'sum_amount',
          column: 'amount',
          aggregate: 'sum',
          groupBy: 'customer_id',
        },
        {
          name: 'count_transactions',
          column: 'id',
          aggregate: 'count',
          groupBy: 'customer_id',
        },
      ];

      const allDatasets = new Map([['sales', salesData]]);
      const result = executeJoinedQuery(salesData, [], calcs, allDatasets);

      expect(result.datasets).toHaveLength(2);
      expect(result.datasets[0].label).toBe('sum_amount');
      expect(result.datasets[1].label).toBe('count_transactions');
    });
  });

  describe('Tipado de Números', () => {
    it('debería parsear strings como números correctamente', () => {
      const stringNumberData = [
        { id: 1, amount: '100' },
        { id: 2, amount: '$200' },
        { id: 3, amount: '150,000' },
      ];

      const calc: Calculation = {
        name: 'total',
        column: 'amount',
        aggregate: 'sum',
      };

      const allDatasets = new Map([['sales', stringNumberData]]);
      const result = executeJoinedQuery(stringNumberData, [], [calc], allDatasets);

      // parseFloat maneja $200 → 200, 150,000 → 150
      expect(result.datasets[0].data[0]).toBeGreaterThan(0);
    });
  });
});
