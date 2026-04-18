import { inventoryService } from './inventory';

export const seedMockData = async () => {
  const testProducts = [
    {
      name: 'FILTERS',
      category: 'FILTRATION',
      brand: 'Watcon',
      description: 'Sand filters, laminated with polyester/fibreglass resin',
      attributes: [
        { name: 'Size', values: ['18"', '24"', '36"'] },
        { name: 'Type', values: ['Top Mount', 'Side Mount'] }
      ]
    },
    {
      name: 'PUMPS with pre filter',
      category: 'PUMPING',
      brand: 'Astral',
      description: 'All pump parts manufactured of engineering plastics to prevent problems with corrosion.',
      attributes: [
        { name: 'Voltage', values: ['220V', '380V'] },
        { name: 'Capacity', values: ['0.75HP', '1HP', '1.5HP', '2HP'] }
      ]
    },
    {
      name: 'MEDIA',
      category: 'FILTRATION',
      brand: 'Quartz',
      description: 'High-grade quartz sand and gravel for filtration systems.',
      attributes: [
        { name: 'Size', values: ['0.5-1.0mm', '1.0-2.0mm'] },
        { name: 'Type', values: ['Sand', 'Gravel'] }
      ]
    },
    {
      name: 'BASIN EQUIPMENT',
      category: 'FINISHING',
      brand: 'PoolCo',
      description: 'High-quality stainless steel basin equipment',
      attributes: [
        { name: 'Finish', values: ['Polished', 'Brushed'] },
        { name: 'Type', values: ['Standard', 'Luxury'] }
      ]
    }
  ];

  for (const product of testProducts) {
    // Generate variants similar to the UI logic
    const combinations = generateCombinations(product.attributes);
    const variants = combinations.map(combo => {
      const prefix = product.name.substring(0, 3).toUpperCase();
      const attrStr = Object.values(combo).map((v: unknown) => (v as string).toString().substring(0, 3).toUpperCase()).join('-');
      return {
        sku: `${prefix}-${attrStr}-${Date.now().toString().slice(-4)}`,
        attributes: combo,
        price: Math.floor(Math.random() * 500) + 100
      };
    });

    await inventoryService.createProduct(
      { name: product.name, category: product.category, brand: product.brand, description: product.description },
      variants
    );
  }
};

const generateCombinations = (attrs: any[]): any[] => {
  if (attrs.length === 0) return [{}];
  const result: any[] = [];
  const restCombos = generateCombinations(attrs.slice(1));
  const currentAttr = attrs[0];
  for (const val of currentAttr.values) {
    for (const c of restCombos) {
      result.push({ [currentAttr.name]: val, ...c });
    }
  }
  return result;
};
