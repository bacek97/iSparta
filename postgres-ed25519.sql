-- ============================================
-- ВАРИАНТ БЕЗ ВНЕШНЕГО ХОСТИНГА
-- Используем PostgreSQL + pgsodium (Ed25519)
-- ============================================

-- Шаг 1: Установить расширение pgsodium
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- Шаг 2: Таблица для хранения данных
CREATE TABLE workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_key BYTEA NOT NULL,  -- Ed25519 публичный ключ (32 байта)
    exercise_name TEXT NOT NULL,
    reps INT NOT NULL,
    verified_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Шаг 3: Функция для добавления workout с проверкой Ed25519 подписи
CREATE OR REPLACE FUNCTION add_workout_verified(
    p_public_key BYTEA,      -- 32 байта Ed25519 публичный ключ
    p_signature BYTEA,       -- 64 байта Ed25519 подпись
    p_exercise_name TEXT,
    p_reps INT
) RETURNS TABLE(
    id UUID,
    public_key BYTEA,
    exercise_name TEXT,
    reps INT,
    verified_at TIMESTAMPTZ
) AS $$
DECLARE
    v_message BYTEA;
    v_is_valid BOOLEAN;
BEGIN
    -- 1. Создать сообщение для проверки
    v_message := convert_to(
        json_build_object(
            'exerciseName', p_exercise_name,
            'reps', p_reps
        )::TEXT,
        'UTF8'
    );
    
    -- 2. Проверить подпись Ed25519
    v_is_valid := pgsodium.crypto_sign_verify_detached(
        p_signature,
        v_message,
        p_public_key
    );
    
    IF NOT v_is_valid THEN
        RAISE EXCEPTION 'Invalid signature';
    END IF;
    
    -- 3. Вставить данные
    RETURN QUERY
    INSERT INTO workouts (public_key, exercise_name, reps)
    VALUES (p_public_key, p_exercise_name, p_reps)
    RETURNING workouts.id, workouts.public_key, workouts.exercise_name, 
              workouts.reps, workouts.verified_at;
END;
$$ LANGUAGE plpgsql;

-- Использование в Hasura:
-- 1. Track эту функцию в Hasura Console
-- 2. Она автоматически станет доступна в GraphQL

/*
mutation AddWorkout {
  add_workout_verified(
    args: {
      p_public_key: "\\x1234...",  # 32 байта в hex
      p_signature: "\\x5678...",   # 64 байта в hex
      p_exercise_name: "Push-ups",
      p_reps: 20
    }
  ) {
    id
    public_key
    exercise_name
    reps
    verified_at
  }
}
*/
