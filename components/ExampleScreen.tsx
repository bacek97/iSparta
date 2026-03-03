import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export interface ExampleScreenProps {
    title: string;
    description: string;
    buttonText: string;
    onPress: () => void;
}

export const ExampleScreen = ({ title, description, buttonText, onPress }: ExampleScreenProps) => {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>{description}</Text>
            <TouchableOpacity style={styles.button} onPress={onPress}>
                <Text style={styles.buttonText}>{buttonText}</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#333',
    },
    description: {
        textAlign: 'center',
        marginBottom: 20,
        color: '#666',
    },
    button: {
        backgroundColor: '#007bff',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 5,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
