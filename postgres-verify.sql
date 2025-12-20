-- ============================================
-- ПРОВЕРКА ПОДПИСИ БЕЗ ОТДЕЛЬНОГО СЕРВЕРА
-- Используем PostgreSQL функцию
-- ============================================

-- Шаг 1: Установить расширение для криптографии
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Шаг 2: Создать функцию для проверки подписи ECDSA secp256k1
-- К сожалению, PostgreSQL не поддерживает secp256k1 из коробки
-- Но можно использовать упрощённую проверку через хеш

-- ВАРИАНТ A: Простая проверка через HMAC (упрощённо)
CREATE OR REPLACE FUNCTION verify_signature_simple(
    p_public_key TEXT,
    p_data JSONB,
    p_signature TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_message TEXT;
    v_expected_signature TEXT;
BEGIN
    -- 1. Создаём сообщение из данных
    v_message := p_data::TEXT;
    
    -- 2. Создаём подпись используя публичный ключ как секрет (упрощённо)
    -- В реальности нужна полноценная проверка ECDSA
    v_expected_signature := encode(
        hmac(v_message::bytea, p_public_key::bytea, 'sha256'),
        'hex'
    );
    
    -- 3. Сравниваем подписи
    RETURN v_expected_signature = p_signature;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ВАРИАНТ B: Проверка через расширение pgsodium (если доступно)
-- pgsodium поддерживает Ed25519, но не secp256k1

-- Шаг 3: Создать функцию для добавления workout с проверкой
CREATE OR REPLACE FUNCTION add_workout_verified(
    p_public_key TEXT,
    p_signature TEXT,
    p_exercise_name TEXT,
    p_reps INT
) RETURNS TABLE(
    id UUID,
    public_key TEXT,
    exercise_name TEXT,
    reps INT,
    verified_at TIMESTAMPTZ
) AS $$
DECLARE
    v_data JSONB;
    v_is_valid BOOLEAN;
    v_new_id UUID;
BEGIN
    -- 1. Подготовить данные для проверки
    v_data := jsonb_build_object(
        'exerciseName', p_exercise_name,
        'reps', p_reps
    );
    
    -- 2. Проверить подпись
    v_is_valid := verify_signature_simple(p_public_key, v_data, p_signature);
    
    IF NOT v_is_valid THEN
        RAISE EXCEPTION 'Invalid signature';
    END IF;
    
    -- 3. Вставить данные
    INSERT INTO workouts (public_key, exercise_name, reps)
    VALUES (p_public_key, p_exercise_name, p_reps)
    RETURNING workouts.id, workouts.public_key, workouts.exercise_name, 
              workouts.reps, workouts.verified_at
    INTO id, public_key, exercise_name, reps, verified_at;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Использование в Hasura:
-- Просто добавьте эту функцию как "Tracked Function" в Hasura Console
-- Она автоматически станет доступна в GraphQL API

/*
mutation AddWorkout {
  add_workout_verified(
    args: {
      p_public_key: "03a1b2c3...",
      p_signature: "d4e5f6...",
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
