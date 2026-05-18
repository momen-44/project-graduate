import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FoodRequest } from './food-request.entity';

@Entity('image_analysis')
@Index('UQ_image_analysis_request_id', ['requestId'], { unique: true })
export class ImageAnalysis {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint', name: 'request_id' })
  requestId!: string;

  @OneToOne(() => FoodRequest, (request) => request.imageAnalysis, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'request_id' })
  request!: FoodRequest;

  @Column({ type: 'text', name: 'image_url' })
  imageUrl!: string;

  @Column({ type: 'varchar', length: 255, name: 'cloudinary_id' })
  cloudinaryId!: string;

  @Column({ type: 'varchar', length: 255, name: 'model_prediction' })
  modelPrediction!: string;

  @Column({ type: 'numeric', precision: 5, scale: 4 })
  confidence!: number;

  @Column({
    type: 'jsonb',
    name: 'nutrition_snapshot',
    nullable: true,
    default: null,
  })
  nutritionSnapshot?: Record<string, unknown> | null;

  @Column({
    type: 'varchar',
    length: 40,
    name: 'nutrition_source',
    nullable: true,
  })
  nutritionSource?: string | null;

  @Column({
    type: 'timestamptz',
    name: 'analyzed_at',
    default: () => 'CURRENT_TIMESTAMP',
  })
  analyzedAt!: Date;
}
