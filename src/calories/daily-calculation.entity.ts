import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/entities/user.entity';

@Entity('daily_calculations')
@Index('IDX_daily_calculations_user_id', ['userId'])
@Index('IDX_daily_calculations_created_at', ['createdAt'])
export class DailyCalculation {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.dailyCalculations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  bmr!: number;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  tdee!: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, name: 'daily_calories' })
  dailyCalories!: number;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  recommendations!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
