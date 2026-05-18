import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNutritionSchema1712530000000 implements MigrationInterface {
  name = 'CreateNutritionSchema1712530000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'users_gender_enum') THEN
          CREATE TYPE users_gender_enum AS ENUM ('male', 'female');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'users_activity_level_enum') THEN
          CREATE TYPE users_activity_level_enum AS ENUM ('sedentary', 'light', 'moderate', 'active', 'very_active');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'users_dietary_preference_enum') THEN
          CREATE TYPE users_dietary_preference_enum AS ENUM ('omnivore', 'vegetarian', 'vegan', 'keto', 'low_carb', 'halal', 'none');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'food_requests_request_type_enum') THEN
          CREATE TYPE food_requests_request_type_enum AS ENUM ('image', 'text');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nutrition_suggestions_meal_type_enum') THEN
          CREATE TYPE nutrition_suggestions_meal_type_enum AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(120) NOT NULL,
        email varchar(255) NOT NULL,
        password_hash varchar(255) NOT NULL,
        age integer,
        gender users_gender_enum,
        height numeric(6,2),
        weight numeric(6,2),
        activity_level users_activity_level_enum,
        dietary_preference users_dietary_preference_enum,
        profile_image_url text,
        profile_image_public_id varchar(255),
        created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_users_email ON users(email);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS food_requests (
        id bigserial PRIMARY KEY,
        user_id uuid NOT NULL,
        request_type food_requests_request_type_enum NOT NULL,
        request_data jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT FK_food_requests_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_food_requests_user_id ON food_requests(user_id);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_food_requests_created_at ON food_requests(created_at);`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS image_analysis (
        id bigserial PRIMARY KEY,
        request_id bigint NOT NULL,
        image_url text NOT NULL,
        cloudinary_id varchar(255) NOT NULL,
        model_prediction varchar(255) NOT NULL,
        confidence numeric(5,4) NOT NULL,
        nutrition_snapshot jsonb,
        nutrition_source varchar(40),
        analyzed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT FK_image_analysis_request_id FOREIGN KEY (request_id) REFERENCES food_requests(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS UQ_image_analysis_request_id ON image_analysis(request_id);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_image_analysis_analyzed_at ON image_analysis(analyzed_at);`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS nutrition_suggestions (
        id bigserial PRIMARY KEY,
        request_id bigint NOT NULL,
        meal_type nutrition_suggestions_meal_type_enum,
        suggestion_text text NOT NULL,
        nutrients jsonb NOT NULL DEFAULT '{}'::jsonb,
        total_calories integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT FK_nutrition_suggestions_request_id FOREIGN KEY (request_id) REFERENCES food_requests(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_nutrition_suggestions_request_id ON nutrition_suggestions(request_id);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_nutrition_suggestions_created_at ON nutrition_suggestions(created_at);`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS daily_calculations (
        id bigserial PRIMARY KEY,
        user_id uuid NOT NULL,
        bmr numeric(10,2) NOT NULL,
        tdee numeric(10,2) NOT NULL,
        daily_calories numeric(10,2) NOT NULL,
        recommendations jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT FK_daily_calculations_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_daily_calculations_user_id ON daily_calculations(user_id);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_daily_calculations_created_at ON daily_calculations(created_at);`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id bigserial PRIMARY KEY,
        user_id uuid NOT NULL,
        token varchar(255) NOT NULL,
        expires_at timestamptz NOT NULL,
        used boolean NOT NULL DEFAULT false,
        CONSTRAINT FK_password_resets_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_password_resets_user_id ON password_resets(user_id);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_password_resets_expires_at ON password_resets(expires_at);`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id bigserial PRIMARY KEY,
        service_name varchar(120) NOT NULL,
        action varchar(120) NOT NULL,
        request_data jsonb,
        response_data jsonb,
        status varchar(40) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_system_logs_created_at ON system_logs(created_at);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_system_logs_service_action ON system_logs(service_name, action);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS system_logs;');
    await queryRunner.query('DROP TABLE IF EXISTS password_resets;');
    await queryRunner.query('DROP TABLE IF EXISTS daily_calculations;');
    await queryRunner.query('DROP TABLE IF EXISTS nutrition_suggestions;');
    await queryRunner.query('DROP TABLE IF EXISTS image_analysis;');
    await queryRunner.query('DROP TABLE IF EXISTS food_requests;');
    await queryRunner.query('DROP TABLE IF EXISTS users;');

    await queryRunner.query(
      'DROP TYPE IF EXISTS nutrition_suggestions_meal_type_enum;',
    );
    await queryRunner.query(
      'DROP TYPE IF EXISTS food_requests_request_type_enum;',
    );
    await queryRunner.query(
      'DROP TYPE IF EXISTS users_dietary_preference_enum;',
    );
    await queryRunner.query('DROP TYPE IF EXISTS users_activity_level_enum;');
    await queryRunner.query('DROP TYPE IF EXISTS users_gender_enum;');
  }
}
