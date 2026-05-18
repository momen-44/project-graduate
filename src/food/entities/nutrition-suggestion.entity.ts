import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MealTypeEnum } from '../../common/enums/meal-type.enum';
import { FoodRequest } from './food-request.entity';

@Entity('nutrition_suggestions')
@Index('IDX_nutrition_suggestions_request_id', ['requestId'])
@Index('IDX_nutrition_suggestions_created_at', ['createdAt'])
export class NutritionSuggestion {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint', name: 'request_id' })
  requestId!: string;

  @ManyToOne(() => FoodRequest, (request) => request.nutritionSuggestions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'request_id' })
  request!: FoodRequest;

  @Column({
    type: 'enum',
    enum: MealTypeEnum,
    name: 'meal_type',
    nullable: true,
  })
  mealType!: MealTypeEnum | null;

  @Column({ type: 'text', name: 'suggestion_text' })
  suggestionText!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  nutrients!: Record<string, number>;

  @Column({ type: 'int', name: 'total_calories' })
  totalCalories!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
