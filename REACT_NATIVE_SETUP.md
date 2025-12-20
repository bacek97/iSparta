# React Native Setup для BIP39 Crypto

## 📦 Установка зависимостей

### Для Expo:

```bash
# Основные библиотеки
npm install @scure/bip39 @scure/bip32 @noble/curves @noble/hashes

# Безопасное хранилище для мнемоники
npx expo install expo-secure-store

# Полифилл для crypto (если нужен)
npm install expo-crypto
```

### Для чистого React Native:

```bash
# Основные библиотеки
npm install @scure/bip39 @scure/bip32 @noble/curves @noble/hashes

# Безопасное хранилище
npm install react-native-keychain

# Полифилл для crypto
npm install react-native-quick-crypto
cd ios && pod install
```

---

## 🔐 Безопасное хранилище мнемоники

### Expo (SecureStore):

```typescript
import * as SecureStore from 'expo-secure-store';

// Сохранение
export async function saveMnemonic(mnemonic: string): Promise<void> {
    await SecureStore.setItemAsync('mnemonic', mnemonic);
}

// Загрузка
export async function loadMnemonic(): Promise<string | null> {
    return await SecureStore.getItemAsync('mnemonic');
}

// Удаление
export async function deleteMnemonic(): Promise<void> {
    await SecureStore.deleteItemAsync('mnemonic');
}
```

### React Native (Keychain):

```typescript
import * as Keychain from 'react-native-keychain';

// Сохранение
export async function saveMnemonic(mnemonic: string): Promise<void> {
    await Keychain.setGenericPassword('mnemonic', mnemonic, {
        service: 'com.yourapp.mnemonic'
    });
}

// Загрузка
export async function loadMnemonic(): Promise<string | null> {
    const credentials = await Keychain.getGenericPassword({
        service: 'com.yourapp.mnemonic'
    });
    return credentials ? credentials.password : null;
}

// Удаление
export async function deleteMnemonic(): Promise<void> {
    await Keychain.resetGenericPassword({
        service: 'com.yourapp.mnemonic'
    });
}
```

---

## 📱 Полный пример для React Native

### App.tsx:

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, Button, TextInput, StyleSheet } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
    generateMnemonic,
    validateMnemonic,
    generateKeysFromMnemonic,
    signData,
    verifySignature
} from './universal-crypto-client';

export default function App() {
    const [mnemonic, setMnemonic] = useState<string>('');
    const [publicKey, setPublicKey] = useState<string>('');
    const [status, setStatus] = useState<string>('');

    // Загрузка мнемоники при старте
    useEffect(() => {
        loadSavedMnemonic();
    }, []);

    async function loadSavedMnemonic() {
        const saved = await SecureStore.getItemAsync('mnemonic');
        if (saved) {
            setMnemonic(saved);
            const { publicKeyHex } = await generateKeysFromMnemonic(saved);
            setPublicKey(publicKeyHex);
            setStatus('Мнемоника загружена');
        }
    }

    async function handleGenerateMnemonic() {
        const newMnemonic = generateMnemonic(12);
        setMnemonic(newMnemonic);
        
        // Сохранение в безопасное хранилище
        await SecureStore.setItemAsync('mnemonic', newMnemonic);
        
        // Генерация ключей
        const { publicKeyHex } = await generateKeysFromMnemonic(newMnemonic);
        setPublicKey(publicKeyHex);
        
        setStatus('✅ Мнемоника сгенерирована и сохранена');
    }

    async function handleSignPublication() {
        if (!mnemonic) {
            setStatus('❌ Сначала сгенерируйте мнемонику');
            return;
        }

        const { privateKey } = await generateKeysFromMnemonic(mnemonic);
        
        const publication = {
            date: new Date().toISOString(),
            text: 'Great workout today! 💪',
            exercises: [
                { exercise: 'SQUATS', sec: 30, reps: 10 }
            ]
        };

        const signature = signData(privateKey, publication);
        
        setStatus(`✅ Подпись: ${signature.substring(0, 20)}...`);
        
        // Отправка в Hasura
        // await sendToHasura(publicKey, signature, publication);
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>BIP39 Crypto Demo</Text>
            
            <Button 
                title="Сгенерировать мнемонику" 
                onPress={handleGenerateMnemonic} 
            />
            
            {mnemonic && (
                <>
                    <Text style={styles.label}>Мнемоника:</Text>
                    <Text style={styles.mnemonic}>{mnemonic}</Text>
                    
                    <Text style={styles.label}>Публичный ключ:</Text>
                    <Text style={styles.key}>{publicKey.substring(0, 32)}...</Text>
                    
                    <Button 
                        title="Подписать публикацию" 
                        onPress={handleSignPublication} 
                    />
                </>
            )}
            
            <Text style={styles.status}>{status}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
        backgroundColor: '#f5f5f5'
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center'
    },
    label: {
        fontSize: 14,
        fontWeight: 'bold',
        marginTop: 15,
        marginBottom: 5
    },
    mnemonic: {
        fontSize: 16,
        padding: 10,
        backgroundColor: '#fff',
        borderRadius: 8,
        fontFamily: 'monospace'
    },
    key: {
        fontSize: 12,
        padding: 10,
        backgroundColor: '#fff',
        borderRadius: 8,
        fontFamily: 'monospace'
    },
    status: {
        marginTop: 20,
        fontSize: 14,
        textAlign: 'center',
        color: '#666'
    }
});
```

---

## ⚠️ Важные замечания

### Безопасность:

1. **НИКОГДА не храните мнемонику в AsyncStorage или localStorage**
   - Используйте SecureStore (Expo) или Keychain (React Native)

2. **Не отправляйте мнемонику на сервер**
   - Только публичный ключ и подпись

3. **Предупреждайте пользователя**
   - Мнемоника = полный доступ к аккаунту
   - Пользователь должен записать её в безопасном месте

### Производительность:

1. **Кешируйте ключи**
   ```typescript
   let cachedKeys: { privateKey: Uint8Array; publicKey: Uint8Array } | null = null;
   
   async function getKeys() {
       if (cachedKeys) return cachedKeys;
       
       const mnemonic = await loadMnemonic();
       if (!mnemonic) throw new Error('No mnemonic');
       
       cachedKeys = await generateKeysFromMnemonic(mnemonic);
       return cachedKeys;
   }
   ```

2. **Используйте useMemo для дорогих операций**
   ```typescript
   const keys = useMemo(() => {
       if (!mnemonic) return null;
       return generateKeysFromMnemonic(mnemonic);
   }, [mnemonic]);
   ```

---

## 🧪 Тестирование

```bash
# Expo
npx expo start

# React Native
npx react-native run-android
npx react-native run-ios
```

---

## 📚 Дополнительные ресурсы

- [Expo SecureStore Docs](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [React Native Keychain](https://github.com/oblador/react-native-keychain)
- [@scure/bip39 Docs](https://github.com/paulmillr/scure-bip39)
- [@noble/curves Docs](https://github.com/paulmillr/noble-curves)
