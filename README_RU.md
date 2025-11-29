# DeepFit Utils - Руководство по использованию

## Как получить процент выполнения упражнения и направление

### Быстрый старт

```typescript
import {
  createExerciseState,
  updateExerciseState,
  type ExerciseState
} from './deepfitUtils';

// 1. Создайте начальное состояние упражнения
const state = createExerciseState();

// 2. Обновите состояние на каждом кадре
const updatedState = updateExerciseState(
  'pushups',              // Название упражнения
  state,                  // Текущее состояние
  mediapipeLandmarks      // 33 точки от MediaPipe
);

// 3. Получите результаты
console.log('Процент:', updatedState.percentage);     // 0-100
console.log('Направление:', updatedState.feedback);   // "Go Up" или "Go Down"
console.log('Повторения:', Math.floor(updatedState.count));
```

### Основные функции

#### 1. `createExerciseState()` - Создание начального состояния

```typescript
const state = createExerciseState();
// Возвращает:
// {
//   count: 0,           // Счетчик повторений
//   direction: 0,       // 0 = вниз, 1 = вверх
//   form: 0,           // 0 = плохая форма, 1 = хорошая форма
//   feedback: "Get into starting position",
//   percentage: 0      // Процент выполнения (0-100)
// }
```

#### 2. `updateExerciseState()` - Обновление состояния

```typescript
const newState = updateExerciseState(
  exerciseName,    // 'pushups', 'squats', и т.д.
  currentState,    // Текущее состояние
  landmarks        // 33 точки MediaPipe
);
```

**Возвращает объект `ExerciseState` с:**
- `percentage` - Процент выполнения (0-100)
- `feedback` - Направление: "Go Up", "Go Down" или сообщение об ошибке
- `count` - Количество повторений (увеличивается на 0.5 за каждую фазу)
- `direction` - Текущее направление движения
- `form` - Правильность формы выполнения

### Поддерживаемые упражнения

#### Отжимания (Pushups)
- **Процент**: Основан на угле локтя
  - 0% = локоть согнут на 90° (внизу)
  - 100% = локоть выпрямлен на 160° (вверху)
- **Направления**:
  - "Go Up" - когда внизу (локоть ≤ 90°)
  - "Go Down" - когда вверху (локоть ≥ 160°)
- **Проверка формы**: Прямое тело, правильные углы плеч и бедер

#### Приседания (Squats)
- **Процент**: Основан на угле колена
  - 0% = колено согнуто на 90° (внизу)
  - 100% = колено выпрямлено на 160° (вверху)
- **Направления**:
  - "Go Up" - когда внизу (колено < 90°)
  - "Go Down" - когда вверху (колено > 169°)

### Дополнительные функции

#### `calculateBodyAngles()` - Расчет углов тела

```typescript
const angles = calculateBodyAngles(mediapipeLandmarks);
// Возвращает:
// {
//   elbowLeft: number,
//   elbowRight: number,
//   shoulderLeft: number,
//   shoulderRight: number,
//   hipLeft: number,
//   hipRight: number,
//   kneeLeft: number,
//   kneeRight: number
// }
```

#### `calculateAngle()` - Расчет угла между тремя точками

```typescript
const angle = calculateAngle(point1, point2, point3);
// Возвращает угол в градусах (0-180)
```

### Пример использования в React Native

```typescript
import { useState } from 'react';
import { createExerciseState, updateExerciseState } from './deepfitUtils';

function WorkoutTracker() {
  const [state, setState] = useState(createExerciseState());
  const [exercise, setExercise] = useState('pushups');
  
  // В вашем frame processor
  const processFrame = (landmarks) => {
    const newState = updateExerciseState(exercise, state, landmarks);
    setState(newState);
  };
  
  return (
    <View>
      <Text>Упражнение: {exercise}</Text>
      <Text>Повторения: {Math.floor(state.count)}</Text>
      <Text>Прогресс: {state.percentage.toFixed(0)}%</Text>
      <Text>Подсказка: {state.feedback}</Text>
      
      {/* Прогресс-бар */}
      <View style={{ width: '100%', height: 20, backgroundColor: '#ddd' }}>
        <View 
          style={{ 
            width: `${state.percentage}%`, 
            height: '100%', 
            backgroundColor: state.form === 1 ? '#4CAF50' : '#FF9800'
          }} 
        />
      </View>
    </View>
  );
}
```

### Интеграция с моделью DeepFit

```typescript
import { 
  extractDeepFitKeypoints, 
  normalizeKeypoints,
  getExerciseName 
} from './deepfitUtils';

// 1. Извлеките 18 ключевых точек из 33 точек MediaPipe
const deepfitKeypoints = extractDeepFitKeypoints(mediapipeLandmarks);

// 2. Нормализуйте для модели
const normalizedInput = normalizeKeypoints(deepfitKeypoints);

// 3. Запустите модель
const output = model.runSync(normalizedInput);

// 4. Получите название упражнения
const exerciseName = getExerciseName(output[0]);
// Возвращает: 'squats', 'pushups', 'lunges', и т.д.
```

### Типы данных

```typescript
interface Keypoint {
  x: number;
  y: number;
  confidence?: number;
}

interface ExerciseState {
  count: number;        // Счетчик повторений
  direction: number;    // 0 = вниз, 1 = вверх
  form: number;        // 0 = плохая форма, 1 = хорошая
  feedback: string;    // Текущая подсказка
  percentage: number;  // Процент выполнения (0-100)
}

interface BodyAngles {
  elbowLeft: number;
  elbowRight: number;
  shoulderLeft: number;
  shoulderRight: number;
  hipLeft: number;
  hipRight: number;
  kneeLeft: number;
  kneeRight: number;
}
```

### Важные замечания

1. **Счетчик повторений**: Увеличивается на 0.5 за каждую фазу (вниз/вверх), поэтому используйте `Math.floor(state.count)` для отображения целых повторений.

2. **Проверка формы**: Упражнение начинает отслеживаться только после того, как пользователь примет правильную начальную позицию (`form === 1`).

3. **MediaPipe landmarks**: Требуется массив из 33 точек от MediaPipe Pose Detection.

4. **Направление**: Обновляется только в критических точках (0% или 100% прогресса), а не постоянно.

### Добавление новых упражнений

Чтобы добавить новое упражнение, создайте функцию типа `updatePushupState()`:

```typescript
export function updateMyExerciseState(
  state: ExerciseState, 
  angles: BodyAngles
): ExerciseState {
  const newState = { ...state };
  
  // Рассчитайте процент на основе соответствующего угла
  newState.percentage = interpolate(angles.someAngle, minAngle, maxAngle, 0, 100);
  
  // Проверьте форму
  if (/* условия правильной формы */) {
    newState.form = 1;
  }
  
  // Отслеживайте движение
  if (newState.form === 1) {
    if (newState.percentage <= 5) {
      // Логика для нижней позиции
      newState.feedback = "Go Up";
      if (newState.direction === 0) {
        newState.count += 0.5;
        newState.direction = 1;
      }
    }
    
    if (newState.percentage >= 95) {
      // Логика для верхней позиции
      newState.feedback = "Go Down";
      if (newState.direction === 1) {
        newState.count += 0.5;
        newState.direction = 0;
      }
    }
  }
  
  return newState;
}
```

Затем добавьте его в `updateExerciseState()` switch statement.
