import { BadRequestException, Injectable } from '@nestjs/common';
import { DietaryPreferenceEnum } from '../common/enums/dietary-preference.enum';
import { MealTypeEnum } from '../common/enums/meal-type.enum';
import { NutritionAiResult } from '../ai/gemini.service';

export const TEXT_ANALYSIS_DESCRIPTION_OPTIONS = [
  'Grilled chicken with rice',
  'Chicken breast with salad',
  'Eggs and toast',
  'Oats with milk and banana',
  'Greek yogurt with fruit',
  'Falafel sandwich',
  'Koshari',
  'Lentil soup',
  'Grilled fish with salad',
  'Tuna sandwich',
  'Kofta with rice',
  'Pasta with chicken',
  'Vegetable salad with feta',
  'Hummus with pita',
  'Avocado toast',
  'Protein shake',
  'Fruit bowl',
  'Baked potato with yogurt',
  'White cheese with bread',
  'Vegetable soup',
  'Ful medames',
  'Taameya',
  'Molokhia',
  'Mahshi',
  'Feteer meshaltet',
  'Hawawshi',
  'Egyptian chicken shawarma',
  'Egyptian beef shawarma',
  'Sayadiya',
  'Bamia',
  'Besara',
  'Roz bel laban',
  'Om ali',
  'Basbousa',
  'Kunafa',
  'Macarona bechamel',
  'Fatta',
  'Shish taouk',
  'Alexandrian liver',
  'Egyptian goulash',
  'Roast lamb with rice',
  'Stuffed vine leaves',
  'Egyptian lentil salad',
  'Grilled shrimp with rice',
  'Molokhia with chicken',
  'Shish kebab',
  'Grilled lamb kofta',
  'Stuffed pigeon',
] as const;

type TextAnalysisDescription =
  (typeof TEXT_ANALYSIS_DESCRIPTION_OPTIONS)[number];

type NutritionProfile = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  healthyAlternatives: string[];
  dailyAdvice: string;
  suggestionText: string;
  mealType: MealTypeEnum;
  servingSizeGrams?: number;
};

const TEXT_ANALYSIS_PROFILE_MAP: Record<
  TextAnalysisDescription,
  NutritionProfile
> = {
  'Grilled chicken with rice': {
    calories: 216,
    protein: 16,
    carbs: 19,
    fats: 6,
    healthyAlternatives: [
      'Brown rice with chicken',
      'Grilled chicken with salad',
      'Chicken with vegetables',
    ],
    dailyAdvice:
      'Keep the rice portion moderate and add vegetables to make the meal more balanced.',
    suggestionText: 'A balanced high-protein meal with a moderate carb load.',
    mealType: MealTypeEnum.LUNCH,
    servingSizeGrams: 100,
  },
  'Chicken breast with salad': {
    calories: 128,
    protein: 14,
    carbs: 4,
    fats: 5,
    healthyAlternatives: [
      'Turkey breast with salad',
      'Grilled fish with salad',
      'Chicken with steamed vegetables',
    ],
    dailyAdvice:
      'This is a strong lean-protein option, especially useful for lunch or dinner.',
    suggestionText: 'Lean protein with low carbs and a light vegetable side.',
    mealType: MealTypeEnum.DINNER,
    servingSizeGrams: 100,
  },
  'Eggs and toast': {
    calories: 124,
    protein: 7,
    carbs: 10,
    fats: 6,
    healthyAlternatives: [
      'Eggs with whole wheat toast',
      'Oats with yogurt',
      'Avocado toast',
    ],
    dailyAdvice:
      'A solid breakfast choice. Use whole grain bread if you want more fiber.',
    suggestionText:
      'Classic breakfast with protein and enough carbs for energy.',
    mealType: MealTypeEnum.BREAKFAST,
    servingSizeGrams: 100,
  },
  'Oats with milk and banana': {
    calories: 136,
    protein: 5,
    carbs: 21,
    fats: 4,
    healthyAlternatives: [
      'Oats with berries',
      'Greek yogurt with fruit',
      'Overnight oats',
    ],
    dailyAdvice: 'Good for breakfast or a light snack. Keep added sugar low.',
    suggestionText: 'Fiber-rich breakfast with slow-digesting carbs.',
    mealType: MealTypeEnum.BREAKFAST,
    servingSizeGrams: 100,
  },
  'Greek yogurt with fruit': {
    calories: 88,
    protein: 6,
    carbs: 10,
    fats: 2,
    healthyAlternatives: [
      'Yogurt with nuts',
      'Fruit bowl',
      'Cottage cheese with fruit',
    ],
    dailyAdvice:
      'A good snack or breakfast option when you want protein without a heavy meal.',
    suggestionText:
      'Light, protein-friendly option with natural sweetness from fruit.',
    mealType: MealTypeEnum.SNACK,
    servingSizeGrams: 100,
  },
  'Falafel sandwich': {
    calories: 168,
    protein: 6,
    carbs: 20,
    fats: 6,
    healthyAlternatives: [
      'Falafel with salad',
      'Hummus with pita',
      'Lentil soup',
    ],
    dailyAdvice:
      'Nice plant-based meal, but keep an eye on portion size if it is fried.',
    suggestionText: 'Plant-based option with a moderate carb and fat load.',
    mealType: MealTypeEnum.LUNCH,
    servingSizeGrams: 100,
  },
  Koshari: {
    calories: 188,
    protein: 6,
    carbs: 29,
    fats: 5,
    healthyAlternatives: [
      'Koshari with salad',
      'Lentil soup',
      'Small portion koshari',
    ],
    dailyAdvice:
      'This is carb-heavy, so pair it with salad or keep the portion controlled.',
    suggestionText:
      'Classic Egyptian comfort food with a high carbohydrate profile.',
    mealType: MealTypeEnum.LUNCH,
    servingSizeGrams: 100,
  },
  'Lentil soup': {
    calories: 72,
    protein: 4,
    carbs: 10,
    fats: 2,
    healthyAlternatives: [
      'Vegetable soup',
      'Lentils with salad',
      'Soup with whole grain bread',
    ],
    dailyAdvice: 'A good lighter meal that still provides protein and fiber.',
    suggestionText:
      'Warm, filling soup with balanced nutrition for a light meal.',
    mealType: MealTypeEnum.DINNER,
    servingSizeGrams: 100,
  },
  'Grilled fish with salad': {
    calories: 116,
    protein: 14,
    carbs: 4,
    fats: 4,
    healthyAlternatives: [
      'Baked fish with vegetables',
      'Fish with rice and salad',
      'Tuna salad',
    ],
    dailyAdvice:
      'This is a strong dinner choice with lean protein and useful fats.',
    suggestionText: 'Protein-rich meal with low carbs and heart-friendly fats.',
    mealType: MealTypeEnum.DINNER,
    servingSizeGrams: 100,
  },
  'Tuna sandwich': {
    calories: 132,
    protein: 10,
    carbs: 11,
    fats: 5,
    healthyAlternatives: [
      'Tuna with salad',
      'Egg sandwich',
      'Whole grain tuna wrap',
    ],
    dailyAdvice:
      'Choose whole grain bread and avoid too much mayo if you want a healthier version.',
    suggestionText: 'Quick meal with high protein and moderate carbs.',
    mealType: MealTypeEnum.LUNCH,
    servingSizeGrams: 100,
  },
  'Kofta with rice': {
    calories: 160,
    protein: 9,
    carbs: 13,
    fats: 7,
    healthyAlternatives: [
      'Kofta with salad',
      'Grilled chicken with rice',
      'Kofta with vegetables',
    ],
    dailyAdvice:
      'A heavier meal, so portion control is useful if you want to stay within your calorie target.',
    suggestionText: 'Traditional protein meal with a filling carb side.',
    mealType: MealTypeEnum.LUNCH,
    servingSizeGrams: 100,
  },
  'Pasta with chicken': {
    calories: 244,
    protein: 14,
    carbs: 27,
    fats: 7,
    healthyAlternatives: [
      'Whole wheat pasta with chicken',
      'Chicken with vegetables',
      'Pasta with salad',
    ],
    dailyAdvice: 'Good around training, but keep the pasta portion balanced.',
    suggestionText: 'Filling mixed meal with both carbs and protein.',
    mealType: MealTypeEnum.DINNER,
  },
  'Vegetable salad with feta': {
    calories: 84,
    protein: 4,
    carbs: 6,
    fats: 5,
    healthyAlternatives: [
      'Greek salad',
      'Cucumber and tomato salad',
      'Salad with grilled chicken',
    ],
    dailyAdvice:
      'This is a good light meal or side dish. Add protein if you need more fullness.',
    suggestionText:
      'Light vegetable-forward option with a small amount of dairy fat.',
    mealType: MealTypeEnum.SNACK,
  },
  'Hummus with pita': {
    calories: 144,
    protein: 5,
    carbs: 17,
    fats: 6,
    healthyAlternatives: [
      'Hummus with vegetables',
      'Falafel with salad',
      'Hummus and whole grain toast',
    ],
    dailyAdvice:
      'A balanced snack or light meal, especially if you need a plant-based option.',
    suggestionText: 'Plant-based snack with decent fiber and healthy fats.',
    mealType: MealTypeEnum.SNACK,
  },
  'Avocado toast': {
    calories: 112,
    protein: 3,
    carbs: 10,
    fats: 6,
    healthyAlternatives: [
      'Avocado with eggs',
      'Whole grain toast with peanut butter',
      'Greek yogurt with fruit',
    ],
    dailyAdvice:
      'A good breakfast or snack. Add eggs if you want more protein.',
    suggestionText: 'Healthy fat-forward option with moderate carbs.',
    mealType: MealTypeEnum.BREAKFAST,
  },
  'Protein shake': {
    calories: 76,
    protein: 11,
    carbs: 4,
    fats: 2,
    healthyAlternatives: [
      'Greek yogurt with fruit',
      'Milk and oats',
      'Boiled eggs',
    ],
    dailyAdvice:
      'Best used after training or as a quick protein top-up between meals.',
    suggestionText: 'Fast, protein-heavy option with minimal prep.',
    mealType: MealTypeEnum.SNACK,
  },
  'Fruit bowl': {
    calories: 64,
    protein: 1,
    carbs: 15,
    fats: 0,
    healthyAlternatives: [
      'Fruit with yogurt',
      'Apple with peanut butter',
      'Fresh berries',
    ],
    dailyAdvice:
      'A light choice, good for hydration and quick energy, but low in protein.',
    suggestionText: 'Light fruit-based option with mostly natural carbs.',
    mealType: MealTypeEnum.SNACK,
  },
  'Baked potato with yogurt': {
    calories: 69,
    protein: 2,
    carbs: 10,
    fats: 2,
    healthyAlternatives: [
      'Sweet potato with yogurt',
      'Baked potato with salad',
      'Rice with yogurt',
    ],
    dailyAdvice:
      'A filling option; keeping it baked instead of fried helps a lot.',
    suggestionText:
      'Comfort meal with a balanced carb base and light protein side.',
    mealType: MealTypeEnum.LUNCH,
    servingSizeGrams: 100,
  },
  'White cheese with bread': {
    calories: 136,
    protein: 6,
    carbs: 12,
    fats: 6,
    healthyAlternatives: [
      'Low-fat cheese with bread',
      'Eggs with toast',
      'Greek yogurt with fruit',
    ],
    dailyAdvice:
      'A simple breakfast, but portion control matters because the fat and sodium can add up.',
    suggestionText: 'Classic breakfast with a mix of protein, carbs, and fats.',
    mealType: MealTypeEnum.BREAKFAST,
  },
  'Vegetable soup': {
    calories: 31,
    protein: 1,
    carbs: 4,
    fats: 1,
    healthyAlternatives: [
      'Lentil soup',
      'Chicken soup',
      'Vegetable broth with beans',
    ],
    dailyAdvice:
      'A light meal or starter. Add protein if you need something more filling.',
    suggestionText:
      'Low-calorie, vegetable-based option suitable for a light meal.',
    mealType: MealTypeEnum.DINNER,
    servingSizeGrams: 100,
  },
  'Ful medames': {
    calories: 140,
    protein: 7,
    carbs: 16,
    fats: 4,
    healthyAlternatives: ['Ful with salad', 'Lentil soup', 'Hummus with pita'],
    dailyAdvice:
      'A traditional breakfast with beans — good fiber and plant protein.',
    suggestionText: 'Hearty bean-based breakfast common in Egypt.',
    mealType: MealTypeEnum.BREAKFAST,
  },
  Taameya: {
    calories: 152,
    protein: 5,
    carbs: 18,
    fats: 6,
    healthyAlternatives: [
      'Baked falafel',
      'Falafel with salad',
      'Hummus with pita',
    ],
    dailyAdvice: 'Plant-based and filling; prefer baked versions to lower fat.',
    suggestionText: 'Egyptian style falafel made from fava beans.',
    mealType: MealTypeEnum.LUNCH,
  },
  Molokhia: {
    calories: 128,
    protein: 12,
    carbs: 4,
    fats: 5,
    healthyAlternatives: [
      'Molokhia with rice and salad',
      'Chicken soup',
      'Lentil soup',
    ],
    dailyAdvice:
      'Leafy stew high in minerals; pair with lean protein for balance.',
    suggestionText: 'Green leafy stew often served with rice or bread.',
    mealType: MealTypeEnum.DINNER,
  },
  Mahshi: {
    calories: 160,
    protein: 3,
    carbs: 20,
    fats: 6,
    healthyAlternatives: [
      'Grilled vegetables',
      'Stuffed vine leaves',
      'Lentil salad',
    ],
    dailyAdvice:
      'Stuffed vegetables can be carb-heavy depending on stuffing; watch portion sizes.',
    suggestionText: 'Vegetables stuffed with rice and herbs.',
    mealType: MealTypeEnum.LUNCH,
  },
  'Feteer meshaltet': {
    calories: 192,
    protein: 3,
    carbs: 20,
    fats: 10,
    healthyAlternatives: [
      'Small portion feteer',
      'Whole grain toast with toppings',
      'Fruit bowl',
    ],
    dailyAdvice:
      'Pastry-forward dish — enjoy occasionally due to high fat content.',
    suggestionText:
      'Traditional Egyptian layered pastry, often eaten with toppings.',
    mealType: MealTypeEnum.SNACK,
  },
  Hawawshi: {
    calories: 224,
    protein: 12,
    carbs: 18,
    fats: 11,
    healthyAlternatives: [
      'Lean meat with salad',
      'Grilled kebab with veg',
      'Small hawawshi portion',
    ],
    dailyAdvice:
      'Hearty meat-filled bread; consider smaller portions for calorie control.',
    suggestionText: 'Spiced meat baked inside bread.',
    mealType: MealTypeEnum.LUNCH,
  },
  'Egyptian chicken shawarma': {
    calories: 168,
    protein: 12,
    carbs: 13,
    fats: 7,
    healthyAlternatives: [
      'Chicken with salad',
      'Grilled chicken wrap with veg',
      'Tuna sandwich',
    ],
    dailyAdvice:
      'Good protein option; use whole grain wrap and light sauces when possible.',
    suggestionText: 'Popular street-food chicken shawarma.',
    mealType: MealTypeEnum.LUNCH,
  },
  'Egyptian beef shawarma': {
    calories: 192,
    protein: 11,
    carbs: 14,
    fats: 9,
    healthyAlternatives: [
      'Beef with salad',
      'Grilled beef skewer with veg',
      'Lean beef sandwich',
    ],
    dailyAdvice: 'Be mindful of sauces and portion sizes to reduce added fats.',
    suggestionText: 'Beef shawarma served with bread and condiments.',
    mealType: MealTypeEnum.LUNCH,
  },
  Sayadiya: {
    calories: 180,
    protein: 11,
    carbs: 20,
    fats: 5,
    healthyAlternatives: [
      'Grilled fish with salad',
      'Fish with brown rice',
      'Tuna salad',
    ],
    dailyAdvice:
      'Fish-based rice dish — choose vegetables on the side for balance.',
    suggestionText: 'Seasoned fish served over rice.',
    mealType: MealTypeEnum.LUNCH,
  },
  Bamia: {
    calories: 120,
    protein: 8,
    carbs: 12,
    fats: 4,
    healthyAlternatives: [
      'Okra stew with lean meat',
      'Lentil soup',
      'Vegetable stew',
    ],
    dailyAdvice: 'Okra stew can be balanced and nutritious with lean protein.',
    suggestionText: 'Okra-based stew commonly served with rice.',
    mealType: MealTypeEnum.DINNER,
  },
  Besara: {
    calories: 104,
    protein: 4,
    carbs: 12,
    fats: 4,
    healthyAlternatives: ['Ful medames', 'Hummus with pita', 'Lentil soup'],
    dailyAdvice:
      'Broad bean dip that pairs well with salads for a lighter meal.',
    suggestionText:
      'Mashed fava bean dip often seasoned with herbs and spices.',
    mealType: MealTypeEnum.SNACK,
  },
  'Roz bel laban': {
    calories: 96,
    protein: 2,
    carbs: 18,
    fats: 2,
    healthyAlternatives: [
      'Fruit bowl',
      'Greek yogurt with fruit',
      'Low-fat pudding',
    ],
    dailyAdvice: 'Rice pudding is a sweet treat — enjoy in small portions.',
    suggestionText: 'Creamy rice pudding dessert.',
    mealType: MealTypeEnum.SNACK,
  },
  'Om ali': {
    calories: 168,
    protein: 3,
    carbs: 24,
    fats: 7,
    healthyAlternatives: [
      'Small portion om ali',
      'Fruit bowl',
      'Low-fat yogurt with honey',
    ],
    dailyAdvice: 'Rich dessert — keep portions small.',
    suggestionText: 'Sweet baked pastry and milk dessert.',
    mealType: MealTypeEnum.SNACK,
  },
  Basbousa: {
    calories: 140,
    protein: 2,
    carbs: 20,
    fats: 5,
    healthyAlternatives: [
      'Fruit bowl',
      'Small sweet portion',
      'Greek yogurt with honey',
    ],
    dailyAdvice: 'Semolina cake with syrup — higher in sugar.',
    suggestionText: 'Sweet semolina cake common in Egypt.',
    mealType: MealTypeEnum.SNACK,
  },
  Kunafa: {
    calories: 168,
    protein: 2,
    carbs: 18,
    fats: 8,
    healthyAlternatives: [
      'Small kunafa portion',
      'Fruit bowl',
      'Low-fat yogurt',
    ],
    dailyAdvice: 'High in sugar and fat; enjoy as an occasional treat.',
    suggestionText: 'Shredded pastry dessert with sweet cheese or cream.',
    mealType: MealTypeEnum.SNACK,
  },
  'Macarona bechamel': {
    calories: 260,
    protein: 12,
    carbs: 28,
    fats: 11,
    healthyAlternatives: [
      'Smaller portion',
      'Pasta with vegetables and lean protein',
      'Salad on the side',
    ],
    dailyAdvice:
      'High-calorie pasta bake; consider sharing or reducing portion size.',
    suggestionText: 'Egyptian-style pasta baked with béchamel and meat.',
    mealType: MealTypeEnum.DINNER,
  },
  Fatta: {
    calories: 280,
    protein: 16,
    carbs: 24,
    fats: 12,
    healthyAlternatives: [
      'Smaller portion',
      'Grilled meat with salad',
      'Lentil soup',
    ],
    dailyAdvice:
      'Rich celebratory dish — large portions are common, eat mindfully.',
    suggestionText: 'Rice and bread layered with meat and broth.',
    mealType: MealTypeEnum.LUNCH,
  },
  'Shish taouk': {
    calories: 152,
    protein: 13,
    carbs: 8,
    fats: 6,
    healthyAlternatives: [
      'Grilled chicken with salad',
      'Chicken breast with salad',
      'Shish kebab',
    ],
    dailyAdvice: 'Lean chicken skewer option — good for protein-focused meals.',
    suggestionText:
      'Marinated chicken skewers often served with rice or bread.',
    mealType: MealTypeEnum.LUNCH,
  },
  'Alexandrian liver': {
    calories: 132,
    protein: 11,
    carbs: 4,
    fats: 8,
    healthyAlternatives: [
      'Grilled liver small portion',
      'Lean beef with salad',
      'Shish kebab',
    ],
    dailyAdvice:
      'High in iron and protein; portion and added oil matter for calories.',
    suggestionText: 'Spiced liver dish popular in Alexandria.',
    mealType: MealTypeEnum.LUNCH,
  },
  'Egyptian goulash': {
    calories: 192,
    protein: 11,
    carbs: 19,
    fats: 8,
    healthyAlternatives: [
      'Smaller slice',
      'Salad side',
      'Lean meat with vegetables',
    ],
    dailyAdvice:
      'Pastry-based meat dish; limit portion size for calorie control.',
    suggestionText: 'Savory pastry often filled with minced meat.',
    mealType: MealTypeEnum.LUNCH,
  },
  'Roast lamb with rice': {
    calories: 260,
    protein: 16,
    carbs: 20,
    fats: 14,
    healthyAlternatives: [
      'Roast lamb small portion',
      'Grilled lamb with salad',
      'Lean chicken with rice',
    ],
    dailyAdvice:
      'High-calorie roast — pair with vegetables and moderate portion.',
    suggestionText: 'Hearty roast lamb served with rice.',
    mealType: MealTypeEnum.DINNER,
  },
  'Stuffed vine leaves': {
    calories: 128,
    protein: 2,
    carbs: 16,
    fats: 5,
    healthyAlternatives: ['Mahshi', 'Grilled vegetables', 'Lentil salad'],
    dailyAdvice:
      'Often served as a side; provides moderate carbs from rice stuffing.',
    suggestionText: 'Vine leaves stuffed with rice and herbs.',
    mealType: MealTypeEnum.LUNCH,
  },
  'Egyptian lentil salad': {
    calories: 92,
    protein: 5,
    carbs: 12,
    fats: 2,
    healthyAlternatives: [
      'Lentil soup',
      'Greek yogurt with fruit',
      'Salad with chickpeas',
    ],
    dailyAdvice: 'Protein-rich vegetarian option with good fiber content.',
    suggestionText: 'Light lentil-based salad commonly eaten in Egypt.',
    mealType: MealTypeEnum.SNACK,
  },
  'Grilled shrimp with rice': {
    calories: 144,
    protein: 12,
    carbs: 12,
    fats: 3,
    healthyAlternatives: [
      'Grilled fish with salad',
      'Shrimp salad',
      'Tuna sandwich',
    ],
    dailyAdvice: 'Lean seafood option; good protein with moderate carbs.',
    suggestionText: 'Shrimp served with a portion of rice.',
    mealType: MealTypeEnum.LUNCH,
  },
  'Molokhia with chicken': {
    calories: 144,
    protein: 14,
    carbs: 5,
    fats: 4,
    healthyAlternatives: [
      'Molokhia with rice',
      'Grilled chicken with salad',
      'Lentil soup',
    ],
    dailyAdvice: 'Leafy stew paired with chicken for balanced protein.',
    suggestionText: 'Molokhia served together with chicken pieces.',
    mealType: MealTypeEnum.DINNER,
  },
  'Shish kebab': {
    calories: 168,
    protein: 14,
    carbs: 3,
    fats: 10,
    healthyAlternatives: ['Grilled chicken kebab', 'Shish taouk', 'Salad side'],
    dailyAdvice: 'Skewer-based grilled meat — choose lean cuts when possible.',
    suggestionText: 'Grilled skewered meat typically served with sides.',
    mealType: MealTypeEnum.LUNCH,
  },
  'Grilled lamb kofta': {
    calories: 224,
    protein: 13,
    carbs: 14,
    fats: 11,
    healthyAlternatives: [
      'Kofta with salad',
      'Grilled chicken with rice',
      'Lean beef skewer',
    ],
    dailyAdvice: 'Hearty and rich — balance with vegetables.',
    suggestionText: 'Seasoned minced lamb shaped into kofta and grilled.',
    mealType: MealTypeEnum.LUNCH,
  },
  'Stuffed pigeon': {
    calories: 192,
    protein: 16,
    carbs: 8,
    fats: 11,
    healthyAlternatives: [
      'Roast chicken small portion',
      'Grilled fish with salad',
      'Lentil soup',
    ],
    dailyAdvice: 'Traditional dish often rich — enjoy in moderation.',
    suggestionText:
      'Small roasted pigeon typically stuffed and served as a celebratory meal.',
    mealType: MealTypeEnum.DINNER,
  },
};

@Injectable()
export class FoodTextAnalysisService {
  private static readonly DEFAULT_QUANTITY_GRAMS = 100;

  getDescriptionOptions(): readonly TextAnalysisDescription[] {
    return TEXT_ANALYSIS_DESCRIPTION_OPTIONS;
  }

  validateDescription(description: string): void {
    const normalizedDescription = this.normalizeDescription(description);
    if (!this.isSupportedDescription(normalizedDescription)) {
      throw new BadRequestException(
        'Description must be selected from the available food options.',
      );
    }
  }

  generateNutrition(input: {
    mealType: MealTypeEnum;
    description: string;
    dietaryPreference?: DietaryPreferenceEnum | null;
    userContext?: string;
    quantityGrams?: number;
  }): NutritionAiResult {
    const normalizedDescription = this.normalizeDescription(input.description);
    const profile = this.resolveProfile(normalizedDescription, input.mealType);
    const adjustment = this.getPreferenceAdjustment(
      input.dietaryPreference ?? null,
      normalizedDescription,
    );
    const contextAdvice = this.getContextAdvice(input.userContext ?? '');

    const servingSize = profile.servingSizeGrams ?? 100;
    const quantity =
      input.quantityGrams ?? FoodTextAnalysisService.DEFAULT_QUANTITY_GRAMS;
    const scale = Math.max(0.01, quantity / servingSize);

    return {
      calories: this.clamp(
        Math.round(profile.calories * adjustment.calories * scale),
        0,
        5000,
      ),
      protein: this.clamp(
        Math.round(profile.protein * adjustment.protein * scale),
        0,
        1000,
      ),
      carbs: this.clamp(
        Math.round(profile.carbs * adjustment.carbs * scale),
        0,
        5000,
      ),
      fats: this.clamp(
        Math.round(profile.fats * adjustment.fats * scale),
        0,
        2000,
      ),
      healthyAlternatives: profile.healthyAlternatives,
      dailyAdvice: `${profile.dailyAdvice}${contextAdvice}`.trim(),
      suggestionText: profile.suggestionText,
      mealType: input.mealType,
    };
  }

  getOptionsForMealType(
    mealType?: MealTypeEnum,
  ): readonly TextAnalysisDescription[] {
    if (!mealType) return TEXT_ANALYSIS_DESCRIPTION_OPTIONS;
    return TEXT_ANALYSIS_DESCRIPTION_OPTIONS.filter((opt) => {
      const profile = TEXT_ANALYSIS_PROFILE_MAP[opt as TextAnalysisDescription];
      return profile ? profile.mealType === mealType : false;
    });
  }

  getProfile(description: string): NutritionProfile | null {
    const normalized = this.normalizeDescription(description);
    const key = TEXT_ANALYSIS_DESCRIPTION_OPTIONS.find(
      (item) => this.normalizeDescription(item) === normalized,
    );
    if (!key) return null;
    return TEXT_ANALYSIS_PROFILE_MAP[key as TextAnalysisDescription] ?? null;
  }

  private resolveProfile(
    normalizedDescription: string,
    mealType: MealTypeEnum,
  ): NutritionProfile {
    const profile =
      TEXT_ANALYSIS_PROFILE_MAP[this.toDescriptionKey(normalizedDescription)];
    if (profile) {
      return profile;
    }

    const fallbackProfile = Object.values(TEXT_ANALYSIS_PROFILE_MAP).find(
      (item) => item.mealType === mealType,
    );

    if (fallbackProfile) {
      return fallbackProfile;
    }

    throw new BadRequestException(
      'Description must be selected from the available food options.',
    );
  }

  private getPreferenceAdjustment(
    dietaryPreference: DietaryPreferenceEnum | null,
    normalizedDescription: string,
  ): { calories: number; protein: number; carbs: number; fats: number } {
    if (dietaryPreference === DietaryPreferenceEnum.KETO) {
      return this.containsCarbHeavyWords(normalizedDescription)
        ? { calories: 0.95, protein: 1, carbs: 0.8, fats: 1.05 }
        : { calories: 1, protein: 1, carbs: 0.95, fats: 1.02 };
    }

    if (dietaryPreference === DietaryPreferenceEnum.LOW_CARB) {
      return this.containsCarbHeavyWords(normalizedDescription)
        ? { calories: 0.96, protein: 1, carbs: 0.85, fats: 1 }
        : { calories: 1, protein: 1, carbs: 0.96, fats: 1 };
    }

    if (dietaryPreference === DietaryPreferenceEnum.VEGAN) {
      return { calories: 1, protein: 1, carbs: 1, fats: 1 };
    }

    if (dietaryPreference === DietaryPreferenceEnum.VEGETARIAN) {
      return { calories: 1, protein: 1, carbs: 1, fats: 1 };
    }

    return { calories: 1, protein: 1, carbs: 1, fats: 1 };
  }

  private getContextAdvice(userContext: string): string {
    const normalizedContext = this.normalizeDescription(userContext);
    if (
      /(workout|gym|training|post workout|post-workout)/.test(normalizedContext)
    ) {
      return ' Since this looks related to training, prioritize protein and hydration.';
    }

    if (/(cut|diet|weight loss|lose weight)/.test(normalizedContext)) {
      return ' Since you are aiming for weight control, keep the portion size moderate.';
    }

    return '';
  }

  private containsCarbHeavyWords(normalizedDescription: string): boolean {
    return /(rice|bread|toast|pita|koshari|pasta|potato|sandwich|oats|banana|pita)/.test(
      normalizedDescription,
    );
  }

  private isSupportedDescription(normalizedDescription: string): boolean {
    return Object.keys(TEXT_ANALYSIS_PROFILE_MAP).some(
      (option) => this.normalizeDescription(option) === normalizedDescription,
    );
  }

  private toDescriptionKey(
    normalizedDescription: string,
  ): TextAnalysisDescription {
    const option = TEXT_ANALYSIS_DESCRIPTION_OPTIONS.find(
      (item) => this.normalizeDescription(item) === normalizedDescription,
    );

    if (!option) {
      throw new BadRequestException(
        'Description must be selected from the available food options.',
      );
    }

    return option;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private normalizeDescription(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
