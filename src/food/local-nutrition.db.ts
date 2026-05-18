export interface LocalNutritionEntry {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  unit: string;
  about: string;
}

export const LOCAL_NUTRITION_DB: Record<string, LocalNutritionEntry> = {
  apple: {
    calories: 52,
    protein: 0.3,
    carbs: 14.0,
    fats: 0.2,
    fiber: 2.4,
    unit: 'per 100g',
    about:
      'A hydrating fruit with fiber and vitamin C that supports digestion and immunity.',
  },
  banana: {
    calories: 89,
    protein: 1.1,
    carbs: 22.8,
    fats: 0.3,
    fiber: 2.6,
    unit: 'per 100g',
    about:
      'A potassium-rich fruit that provides quick energy and supports muscle function.',
  },
  beetroot: {
    calories: 43,
    protein: 1.6,
    carbs: 9.6,
    fats: 0.2,
    fiber: 2.8,
    unit: 'per 100g',
    about:
      'A root vegetable high in folate and nitrates, often linked to better blood flow.',
  },
  'bell pepper': {
    calories: 31,
    protein: 1.0,
    carbs: 6.0,
    fats: 0.3,
    fiber: 2.1,
    unit: 'per 100g',
    about:
      'A crunchy vegetable rich in vitamin C and antioxidants with very low calories.',
  },
  cabbage: {
    calories: 25,
    protein: 1.3,
    carbs: 5.8,
    fats: 0.1,
    fiber: 2.5,
    unit: 'per 100g',
    about:
      'A low-calorie cruciferous vegetable with fiber and vitamin K for gut and bone health.',
  },
  capsicum: {
    calories: 31,
    protein: 1.0,
    carbs: 6.0,
    fats: 0.3,
    fiber: 2.1,
    unit: 'per 100g',
    about:
      'Another name for bell pepper, known for vitamin C and antioxidant compounds.',
  },
  carrot: {
    calories: 41,
    protein: 0.9,
    carbs: 9.6,
    fats: 0.2,
    fiber: 2.8,
    unit: 'per 100g',
    about:
      'A root vegetable rich in beta-carotene that supports eye and skin health.',
  },
  cauliflower: {
    calories: 25,
    protein: 1.9,
    carbs: 5.0,
    fats: 0.3,
    fiber: 2.0,
    unit: 'per 100g',
    about:
      'A versatile cruciferous vegetable with fiber and vitamin C, good for low-carb meals.',
  },
  'chilli pepper': {
    calories: 40,
    protein: 2.0,
    carbs: 8.8,
    fats: 0.4,
    fiber: 1.5,
    unit: 'per 100g',
    about:
      'A spicy pepper containing capsaicin, which may support metabolism and appetite control.',
  },
  corn: {
    calories: 86,
    protein: 3.3,
    carbs: 19.0,
    fats: 1.4,
    fiber: 2.0,
    unit: 'per 100g',
    about:
      'A starchy vegetable that provides energy, fiber, and small amounts of B vitamins.',
  },
  cucumber: {
    calories: 15,
    protein: 0.7,
    carbs: 3.6,
    fats: 0.1,
    fiber: 0.5,
    unit: 'per 100g',
    about:
      'A very hydrating vegetable with low calories, often used in weight-friendly meals.',
  },
  eggplant: {
    calories: 25,
    protein: 1.0,
    carbs: 5.9,
    fats: 0.2,
    fiber: 3.0,
    unit: 'per 100g',
    about:
      'A fiber-rich vegetable with antioxidants, useful for filling and balanced dishes.',
  },
  garlic: {
    calories: 149,
    protein: 6.4,
    carbs: 33.0,
    fats: 0.5,
    fiber: 2.1,
    unit: 'per 100g',
    about:
      'A flavor-packed bulb known for sulfur compounds that may support heart health.',
  },
  ginger: {
    calories: 80,
    protein: 1.8,
    carbs: 17.8,
    fats: 0.8,
    fiber: 2.0,
    unit: 'per 100g',
    about: 'A warming root commonly used to help digestion and reduce nausea.',
  },
  grapes: {
    calories: 69,
    protein: 0.7,
    carbs: 18.1,
    fats: 0.2,
    fiber: 0.9,
    unit: 'per 100g',
    about:
      'A sweet fruit that contains antioxidants such as polyphenols and resveratrol.',
  },
  jalepeno: {
    calories: 30,
    protein: 1.2,
    carbs: 6.0,
    fats: 0.4,
    fiber: 1.2,
    unit: 'per 100g',
    about: 'A spicy green pepper that adds flavor with minimal calories.',
  },
  kiwi: {
    calories: 61,
    protein: 1.1,
    carbs: 14.7,
    fats: 0.5,
    fiber: 3.0,
    unit: 'per 100g',
    about:
      'A vitamin C rich fruit with fiber that supports immunity and digestion.',
  },
  lemon: {
    calories: 29,
    protein: 1.1,
    carbs: 9.3,
    fats: 0.3,
    fiber: 2.8,
    unit: 'per 100g',
    about:
      'A citrus fruit high in vitamin C, often used to boost flavor without many calories.',
  },
  lettuce: {
    calories: 15,
    protein: 1.4,
    carbs: 2.9,
    fats: 0.2,
    fiber: 1.3,
    unit: 'per 100g',
    about: 'A light leafy vegetable that adds volume and hydration to meals.',
  },
  mango: {
    calories: 60,
    protein: 0.8,
    carbs: 15.0,
    fats: 0.4,
    fiber: 1.6,
    unit: 'per 100g',
    about:
      'A tropical fruit rich in vitamin A and C with naturally sweet taste.',
  },
  onion: {
    calories: 40,
    protein: 1.1,
    carbs: 9.3,
    fats: 0.1,
    fiber: 1.7,
    unit: 'per 100g',
    about:
      'A common aromatic vegetable containing antioxidants and prebiotic fibers.',
  },
  orange: {
    calories: 47,
    protein: 0.9,
    carbs: 11.8,
    fats: 0.1,
    fiber: 2.4,
    unit: 'per 100g',
    about: 'A citrus fruit known for vitamin C and hydration support.',
  },
  paprika: {
    calories: 282,
    protein: 14.1,
    carbs: 54.0,
    fats: 12.9,
    fiber: 34.9,
    unit: 'per 100g (powder)',
    about:
      'A dried pepper spice that is concentrated in flavor and antioxidants.',
  },
  pear: {
    calories: 57,
    protein: 0.4,
    carbs: 15.2,
    fats: 0.1,
    fiber: 3.1,
    unit: 'per 100g',
    about:
      'A juicy fruit with soluble fiber that may support satiety and gut health.',
  },
  peas: {
    calories: 81,
    protein: 5.4,
    carbs: 14.5,
    fats: 0.4,
    fiber: 5.7,
    unit: 'per 100g',
    about: 'A legume vegetable with relatively high plant protein and fiber.',
  },
  pineapple: {
    calories: 50,
    protein: 0.5,
    carbs: 13.1,
    fats: 0.1,
    fiber: 1.4,
    unit: 'per 100g',
    about: 'A tropical fruit with vitamin C and bromelain enzymes.',
  },
  pomegranate: {
    calories: 83,
    protein: 1.7,
    carbs: 18.7,
    fats: 1.2,
    fiber: 4.0,
    unit: 'per 100g',
    about:
      'A fruit rich in polyphenol antioxidants linked to heart-friendly benefits.',
  },
  potato: {
    calories: 77,
    protein: 2.0,
    carbs: 17.5,
    fats: 0.1,
    fiber: 2.2,
    unit: 'per 100g',
    about: 'A staple starchy vegetable that provides energy and potassium.',
  },
  raddish: {
    calories: 16,
    protein: 0.7,
    carbs: 3.4,
    fats: 0.1,
    fiber: 1.6,
    unit: 'per 100g',
    about:
      'A crunchy root vegetable with a peppery taste and very low calories.',
  },
  'soy beans': {
    calories: 173,
    protein: 17.0,
    carbs: 9.9,
    fats: 9.0,
    fiber: 5.0,
    unit: 'per 100g (fresh)',
    about: 'A high-protein legume rich in healthy fats and micronutrients.',
  },
  spinach: {
    calories: 23,
    protein: 2.9,
    carbs: 3.6,
    fats: 0.4,
    fiber: 2.2,
    unit: 'per 100g',
    about: 'A leafy green rich in folate, iron, and vitamin K.',
  },
  sweetcorn: {
    calories: 86,
    protein: 3.3,
    carbs: 19.0,
    fats: 1.4,
    fiber: 2.0,
    unit: 'per 100g',
    about:
      'Sweet corn kernels that provide carbohydrates, fiber, and carotenoids.',
  },
  sweetpotato: {
    calories: 86,
    protein: 1.6,
    carbs: 20.1,
    fats: 0.1,
    fiber: 3.0,
    unit: 'per 100g',
    about:
      'A nutrient-dense root rich in beta-carotene and complex carbohydrates.',
  },
  tomato: {
    calories: 18,
    protein: 0.9,
    carbs: 3.9,
    fats: 0.2,
    fiber: 1.2,
    unit: 'per 100g',
    about: 'A low-calorie fruit vegetable rich in lycopene and vitamin C.',
  },
  turnip: {
    calories: 28,
    protein: 0.9,
    carbs: 6.4,
    fats: 0.1,
    fiber: 1.8,
    unit: 'per 100g',
    about: 'A mild root vegetable with vitamin C and fiber for everyday meals.',
  },
  watermelon: {
    calories: 30,
    protein: 0.6,
    carbs: 7.6,
    fats: 0.2,
    fiber: 0.4,
    unit: 'per 100g',
    about:
      'A highly hydrating fruit with refreshing taste and low calorie density.',
  },
};
