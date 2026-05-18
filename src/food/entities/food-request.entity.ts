import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RequestTypeEnum } from '../../common/enums/request-type.enum';
import { User } from '../../users/entities/user.entity';
import { ImageAnalysis } from './image-analysis.entity';
import { NutritionSuggestion } from './nutrition-suggestion.entity';

@Entity('food_requests')
@Index('IDX_food_requests_user_id', ['userId'])
@Index('IDX_food_requests_created_at', ['createdAt'])
export class FoodRequest {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.foodRequests, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'enum', enum: RequestTypeEnum, name: 'request_type' })
  requestType!: RequestTypeEnum;

  @Column({ type: 'jsonb', name: 'request_data', default: () => "'{}'::jsonb" })
  requestData!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @OneToOne(() => ImageAnalysis, (analysis) => analysis.request)
  imageAnalysis?: ImageAnalysis;

  @OneToMany(() => NutritionSuggestion, (suggestion) => suggestion.request)
  nutritionSuggestions!: NutritionSuggestion[];
}
