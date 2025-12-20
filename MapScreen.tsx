import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import Svg, { Path, Ellipse, Text as SvgText, G } from 'react-native-svg';

const { width: screenWidth } = Dimensions.get('window');

// Mock data for friends' weekly stats
interface MuscleGroupStats {
    arms: number;
    legs: number;
    torso: number;
    back: number;
    running: number;
}

interface FriendWeeklyStats {
    id: string;
    userName: string;
    avatar: string;
    weekStreak: number;
    stats: MuscleGroupStats;
}

const MOCK_FRIENDS_WEEKLY_STATS: FriendWeeklyStats[] = [
    {
        id: '1',
        userName: 'Ivan Petrov',
        avatar: '💪',
        weekStreak: 4,
        stats: {
            arms: 120,
            legs: 250,
            torso: 180,
            back: 95,
            running: 300,
        },
    },
    {
        id: '2',
        userName: 'Anna K.',
        avatar: '🔥',
        weekStreak: 8,
        stats: {
            arms: 85,
            legs: 310,
            torso: 145,
            back: 120,
            running: 420,
        },
    },
    {
        id: '3',
        userName: 'Dmitry S.',
        avatar: '⚡',
        weekStreak: 2,
        stats: {
            arms: 210,
            legs: 180,
            torso: 95,
            back: 160,
            running: 150,
        },
    },
    {
        id: '4',
        userName: 'Elena V.',
        avatar: '🏆',
        weekStreak: 12,
        stats: {
            arms: 140,
            legs: 290,
            torso: 220,
            back: 185,
            running: 380,
        },
    },
    {
        id: '5',
        userName: 'Alexey M.',
        avatar: '🎯',
        weekStreak: 6,
        stats: {
            arms: 195,
            legs: 205,
            torso: 160,
            back: 140,
            running: 270,
        },
    },
];

// SVG Icon Components for muscle groups
const ArmsIcon = ({ size = 20 }: { size?: number }) => (
    <Svg width={size} height={size} viewBox="-5 -10 96.9 93.6">
        <G fill="#ff8a00">
            <Path d="M89.3 69.4C64.2 88.8 27.5 80 4.1 63.8c-6-4.1-7.2-8.8-4.8-17L9.7 11C13.2-.3 17-7 26-7h13.6c4 0 7.6 8.2 7.6 14.6q0 2.6-.8 4-.7 1.3-1.9 1.2H42c1.2-3 .5-7.4-.8-10.9a1.6 1.6 0 1 0-3 1.2c1.5 3.6 1.7 7.6.6 9.2q-.3.6-1 .5h-3.3c1.1-3 .4-7.4-.9-10.9a1.6 1.6 0 0 0-3 1.1c1.5 3.7 1.7 7.7.7 9.3q-.4.6-1 .5H29c-2.5.2-4.5.2-7-3.2a1.6 1.6 0 0 0-2.5 1.8c2.9 4.1 6 4.6 8.4 4.6h1.7c.2 4.8.3 14.9-.4 20.1A26 26 0 0 0 20 46.4a1.6 1.6 0 0 0 2.8 1.4c3-6.2 9.3-11 16.4-12.4 5.4-1 13.6-.7 22.4 7q3.7 3.6 5 7.8a1.6 1.6 0 1 0 3-.8c-1-3.5-3-6.4-4.7-8.2 4-3.5 14.7-11.6 24.4-3.7a1.6 1.6 0 0 0 2-2.5c-9.6-7.7-21.2-2.8-28.7 4-7.3-5.9-15.8-8.3-24-6.6q-3.1.5-6 2c.4-5.7.3-14 .2-18.3h11.7q3 0 4.6-2.8 1.2-2.2 1.2-5.7C50.3.4 46.2-10 39.6-10H26C14-10 9.8-.1 6.7 10L-3.7 46c-2.8 9.6-1 15.5 6 20.5a95 95 0 0 0 52.4 17.2c13 0 25.8-3.4 36.6-11.8a1.6 1.6 0 1 0-2-2.4" />
        </G>
    </Svg>
);

const LegsIcon = ({ size = 20 }: { size?: number }) => (
    <Svg width={size} height={size} viewBox="-5 -10 72 96.9">
        <G fill="#16b139">
            <Path d="M29.2 86.9h-30q-3.5-.2-4.1-3.2c-.4-2 .8-4 3-4.8l15-6.5c2.7-1.3 4.2-2.9 3.6-6.7l-6.6-38.6q-1.9-8.9 3.4-14.9c8-9.6 19.7-17.7 32-22.1a1.6 1.6 0 1 1 1 3C34.7-2.8 23.5 5 16 14.1c-3 3.4-3.8 7.2-2.8 12.3l6.7 38.7c1 6.2-2.5 8.6-5.5 10L-.8 81.8q-1.2.7-1 1.3t1 .6h30c2.5-.3 3-1.5 3-3.3q0-1.5-.5-3.7c-.7-3.4-1.5-7.6.4-12.3 3.7-9.2 4.2-26.3-.8-33.7a1.6 1.6 0 0 1 1-2.4C43.6 25.7 58.4 19.5 64 5.1a1.6 1.6 0 0 1 2.9 1.1C61 21.7 45.2 28.2 35 31c4.9 9.5 3.5 26.1 0 34.6-1.5 3.9-.8 7.5-.2 10.6q.5 2.4.5 4.3c0 2.6-1 5.8-5.9 6.5z" />
        </G>
    </Svg>
);

const BackIcon = ({ size = 20 }: { size?: number }) => (
    <Svg width={size} height={size} viewBox="-5 -10 94.1 96.9">
        <G fill="#0026cd">
            <Path d="M88.8 15c-3.1-4.5-8.1-10.3-15.7-10.3h-.5c-2.7-2.5-7-4-12-4q-1.5 0-2.8.2a25 25 0 0 0-2.3-10q-.4-.9-1.4-.9H30q-1 0-1.4.8A25 25 0 0 0 26.3 1L23.5.7c-5 0-9.3 1.5-12 4-7.8-.2-13 5.7-16.2 10.2q-.3.4-.3 1v24.8q0 .6.5 1t1.1.5c3.2-.1 6.7-.3 9.4-1.4a43 43 0 0 0 7.7 25.6v19q.1 1.3 1.5 1.5h53.6q1.5-.1 1.6-1.6v-19c4.4-4.6 8-17 7.7-25.5 2.7 1 6.2 1.3 9.4 1.4q.6 0 1.1-.4t.5-1.1V15.8z" />
        </G>
    </Svg>
);

const TorsoIcon = ({ size = 20 }: { size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M12 2C10.9 2 10 2.9 10 4v2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-2V4c0-1.1-.9-2-2-2zm0 2c.6 0 1 .4 1 1v1h-2V5c0-.6.4-1 1-1zm-4 4h8v12H8V8z" fill="#770072" />
    </Svg>
);

const RunningIcon = ({ size = 20 }: { size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7" fill="#16B139" />
    </Svg>
);

// Exercise Map SVG Component with dynamic size
const ExerciseMapSvg = ({ scale }: { scale: number }) => {
    const baseWidth = screenWidth - 50;
    const baseHeight = (baseWidth / 483.563) * 88.246;
    const svgWidth = baseWidth * scale;
    const svgHeight = baseHeight * scale;

    return (
        <Svg width={svgWidth} height={svgHeight} viewBox="0 0 483.563 88.246" preserveAspectRatio="xMidYMid meet">
            {/* All connecting paths between exercises - from original map.svg */}
            {/* Main pink connection path to advanced exercises */}
            <Path d="M288.333 18.867c.34-.8 1.124-1.322 1.904-1.646.294-.121.602-.204.902-.306 2.218-.595 4.543-.56 6.81-.306.49.055.978.14 1.467.21 1.48.235 2.94.623 4.3 1.266.264.125 1.03.556.78.405-.766-.456-1.548-.883-2.32-1.325 2.032 1.265 4.084 2.501 6.21 3.61.637.334 2.06.702 2.683.882 3.955.97 7.974 1.648 11.996 2.272 2.833.404 5.661.834 8.505 1.15 1.281.077 2.556.29 3.84.321 1.082.026 2.158-.079 3.228-.212l.784-.122-2.973-2.078-.71.155c-.81.128-1.055.188-1.905.226-1.655.074-3.308-.14-4.952-.291-2.765-.335-5.53-.677-8.296-1.007-4.05-.567-8.113-1.178-12.035-2.364-.547-.19-1.102-.36-1.64-.57-.426-.164-1.606-.84-1.25-.553.632.515 1.405.83 2.106 1.25.264.157-.533-.306-.796-.465-.242-.148-.479-.304-.719-.456l-.738-.466c-.592-.34-3.162-1.949-4.584-2.555-1.319-.562-2.729-.858-4.146-1.037-1.134-.129-1.862-.227-3.016-.287a30 30 0 0 0-3.11.004 15 15 0 0 0-1.389.125c-.348.054-.686.163-1.03.245-.336.099-.68.176-1.009.298-.897.332-1.735.893-2.3 1.67z" fill="#ff14a7" fillOpacity="1" strokeWidth=".264583" />

            {/* Connection lines for arms (orange) */}
            <Path d="M59.745 42.116c1.78-1.225 4.187-1.542 6.403-1.748 1.888-.138 3.115-.076 4.716.783.353.147.947.423 1.34.47 1.6.19 3.545-.344 5.092-.657 1.64-.376 3.202-.869 4.366-1.944l-3.959-2.037c-1.093 1-2.608 1.435-4.126 1.802-1.595.319-3.352.777-4.997.429-.356-.076-.978-.377-1.306-.526-1.61-.707-3.03-.716-4.82-.537-2.337.273-4.818.648-6.703 1.933z" fill="#ff8a00" fillOpacity="1" strokeWidth=".0574055" />
            <Path d="M105.427 35.292a7 7 0 0 1 2.515-1.222c1.224-.251 2.48-.249 3.724-.265 1.956-.097 3.897.162 5.832.41 2.026.322 4.042.76 5.952 1.517.455.206 1.116.496 1.558.733.222.12.873.51.652.387-4.635-2.58-2.706-1.616-1.404-.548 1.274 1.15 2.595 2.248 3.823 3.447a106 106 0 0 1 3.263 3.424 81 81 0 0 0 3.32 3.612 22 22 0 0 0 2.976 2.457c1.788 1.242 3.64 2.43 5.62 3.335.47.163.233.093.707.213l-3.125-2.413c-.446-.154-.225-.067-.664-.261-1.21-.633-3.149-1.759 2.321 1.382.13.075-.255-.16-.378-.245-.135-.094-.265-.196-.397-.294l-.435-.295c-1.102-.668-2.083-1.53-3.039-2.39-1.149-1.164-2.272-2.35-3.327-3.6a111 111 0 0 0-3.245-3.439c-1.224-1.214-2.555-2.305-3.82-3.476-2.173-1.92-4.81-3.257-7.45-4.415-1.934-.69-3.94-1.134-5.973-1.42-1.965-.252-3.933-.497-5.92-.405-1.273.019-2.563.018-3.806.333a8.8 8.8 0 0 0-2.635 1.33z" fill="#ff8a00" fillOpacity="1" strokeWidth=".0529167" />
            <Path d="M105.797 33.419a36 36 0 0 0 3.166-.846c.986-.272 1.947-.63 2.917-.954a47 47 0 0 1 3.971-1.173c1.615-.473 3.262-.81 4.908-1.156 1.968-.465 3.967-.77 5.968-1.05 1.972-.355 3.967-.527 5.967-.624 2.125-.067 4.248-.054 6.37-.182 1.481-.053 2.95-.195 4.42-.373 1.416-.097 2.763-.569 4.082-1.062 1.05-.32 2.036-.794 2.988-1.334l-3.28-2.136c-.938.52-1.91.969-2.933 1.296-1.312.48-2.65.88-4.05.976a60 60 0 0 1-4.362.384c-2.12.127-4.242.11-6.364.181-2.01.106-4.009.314-5.994.65-2.003.29-3.999.626-5.975 1.071a64 64 0 0 0-4.948 1.15c-1.35.343-2.687.745-4.01 1.18-.972.314-1.93.674-2.917.944-1.037.307-2.083.643-3.158.777z" fill="#ff8a00" fillOpacity="1" strokeWidth=".0529167" />
            <Path d="M182.185 22.084c1.296.166 2.602.192 3.906.226 1.665.105 3.313-.052 4.95-.343a80 80 0 0 0 6.805-1.7c1.637-.422 3.193-1.058 4.705-1.806 1.37-.703 2.684-1.503 3.993-2.311 1.113-.731 2.314-1.297 3.548-1.789 1.155-.541 2.383-.815 3.643-.956a22 22 0 0 1 3.283-.388c1.827-.067 3.656-.062 5.484-.057 1.803.06 3.582.434 5.298.973 1.824.719 3.57 1.626 5.322 2.502 1.79.934 3.65 1.725 5.554 2.392 2.21.726 4.518 1.082 6.825 1.323 1.058.024 2.16.272 3.217.084.214-.038.42-.112.63-.168 1.096-.386 2.153-.867 3.218-1.33.825-.407 1.565-.973 2.264-1.565.368-.283.2-.142.51-.418l-3.366-2.086c-.285.264-.125.124-.486.416-.677.565-1.385 1.11-2.193 1.474-1.044.45-2.062.972-3.16 1.283-1.236.234-2.49.1-3.738.005-2.288-.236-4.574-.609-6.75-1.382a47 47 0 0 1-5.534-2.435c-1.762-.878-3.514-1.797-5.372-2.457-1.747-.507-3.548-.864-5.373-.888-1.84.01-3.682.01-5.523.055-1.112.06-2.21.203-3.305.406-1.278.179-2.514.506-3.69 1.045-1.249.506-2.453 1.105-3.576 1.853a51 51 0 0 1-3.976 2.276c-1.487.728-3.018 1.345-4.617 1.787a63 63 0 0 1-6.805 1.642c-1.63.247-3.267.376-4.916.274-1.318-.042-2.64-.098-3.943-.308z" fill="#ff8a00" fillOpacity="1" strokeWidth=".0529167" />
            <Path d="M175.295 30.008c1.655-.085 3.306.03 4.957.144 1.933.238 3.855.51 5.797.664 2.575.184 5.142.45 7.673.967a14.6 14.6 0 0 1 3.175 1.071c.8.383 4.223 2.367-2.13-1.235 1.282.766 2.508 1.63 3.704 2.524.953.696 1.8 1.503 2.556 2.407a20.4 20.4 0 0 0 2.464 2.735c1.443 1.229 3.086 1.998 4.773 2.957.528.3 1.107.536 1.675.744 1.112.348 2.27.536 3.416.725.835.136 1.68.174 2.523.191l.807.002-3.186-2.318c-.542-.005-.273-.001-.809-.012-.826-.026-1.653-.08-2.47-.221-1.13-.196-2.274-.378-3.353-.782-.666-.285-.488-.196-1.116-.516-.178-.09-.703-.38-.532-.277 5.32 3.195 2.986 1.825 1.893.99-.894-.833-1.778-1.672-2.484-2.681a13 13 0 0 0-2.536-2.503 45 45 0 0 0-3.689-2.56c-2.569-1.491-4.822-3.05-7.752-3.564-2.54-.476-5.115-.683-7.686-.924-1.95-.175-3.88-.49-5.83-.681a72 72 0 0 0-5.038-.17z" fill="#ff8a00" fillOpacity="1" strokeWidth=".0529167" />

            {/* Connection lines for legs (green) */}
            <Path d="M64.2 65.666c1.331-.355 2.68-.714 4.061-.762 1.15.042 2.25.334 3.354.62.851.282 1.612.766 2.41 1.167-6.122-3.503-1.479-.835.92.483.92.506 1.916.895 2.861 1.35 1.582.656 3.093 1.48 4.722 2.016 1.07.277 2.147.528 3.24.69.737.153 1.436.073 2.162-.067.351-.116.603-.39.916-.579l-3.334-2.144c-.263.178-.5.4-.825.456a5.7 5.7 0 0 1-2.066-.028 26 26 0 0 1-3.166-.721c-1.597-.581-3.114-1.358-4.673-2.033-.758-.362-1.52-.716-2.277-1.081-.208-.1-.82-.423-.623-.302 1.164.721 7.702 4.483-.93-.503-.794-.42-1.585-.871-2.46-1.097-1.116-.282-2.247-.511-3.404-.504-1.4.12-2.757.501-4.13.791z" fill="#16b139" fillOpacity="1" strokeWidth=".0529167" />
            <Path d="M119.14 64.917c.95.161 1.9.336 2.835.569.847.315 1.721.532 2.6.736.82.195 1.658.292 2.497.345.65.029 1.298.021 1.947.018.717.036 1.385-.168 2.032-.457q1.153-.566 2.295-1.154a5.6 5.6 0 0 0 1.597-1.215c.412-.46.772-.962 1.142-1.456.387-.415.764-.837 1.071-1.315a7 7 0 0 0 .936-1.733c.278-.727.633-1.421 1.012-2.1.32-.602.64-1.204.932-1.82q.266-.643.534-1.284c.024-.07.354-.958.23-.576l-3.332-2.202c-.18.254-.224.557-.346.841-.185.42-.347.85-.519 1.276-.286.61-.566 1.22-.886 1.813a15.6 15.6 0 0 0-1.055 2.142 7 7 0 0 1-.904 1.654c-.315.462-.694.871-1.059 1.294-.362.483-.713.974-1.12 1.42a5.5 5.5 0 0 1-1.518 1.11c-.74.407-1.498.786-2.272 1.125-.628.239-1.273.365-1.949.328-.644-.002-1.289 0-1.932-.042a14 14 0 0 1-2.434-.377c-.878-.214-1.736-.486-2.604-.736a63 63 0 0 0-2.898-.566z" fill="#16b139" fillOpacity="1" strokeWidth=".0529167" />
            <Path d="M116.815 71.133c.378-.017.758-.013 1.137-.01.44 0 .88-.006 1.32-.008.667.002 1.332-.067 2-.098.831-.03 1.663-.033 2.494-.06a64 64 0 0 1 4.118.042 27 27 0 0 1 3.306.362c1.206.22 2.412.433 3.607.707.602.149 1.23.247 1.782.54.605.233 1.222.443 1.81.716.86.356 1.7.754 2.55 1.124.616.258 1.237.513 1.885.679.356.09 1.197.262 1.54.333 1.321.266 2.653.523 4 .62l-3.084-2.27c-1.29-.06-2.566-.288-3.826-.562-.276-.066-.554-.125-.828-.197-.92-.245-1.81-.585-2.679-.97-.86-.373-1.712-.772-2.574-1.145-.615-.253-1.24-.484-1.85-.746-.568-.197-1.158-.304-1.746-.415-1.2-.232-2.403-.44-3.6-.68-.339-.054-.773-.127-1.113-.167-.723-.085-1.452-.089-2.178-.121-1.39-.028-2.78-.071-4.17-.065a33 33 0 0 0-2.559.034c-.68.031-1.357.067-2.037.05-.447-.003-.893-.009-1.34-.008-.389.002-.779.006-1.168-.01z" fill="#16b139" fillOpacity="1" strokeWidth=".0529167" />
            <Path d="M181.049 76.497c.63-.432 1.325-.75 2.003-1.098.718-.388 1.445-.748 2.152-1.155.573-.248 1.08-.64 1.664-.857.607-.29 1.248-.493 1.865-.757.704-.267 1.372-.613 2.081-.865.697-.234 1.434-.253 2.16-.274.77-.028 1.532-.023 2.294.087a5 5 0 0 1 1.87.644c3.003 1.664-11.308-6.458.784.443 1.045.596-4.177-2.386-3.127-1.8 4.037 2.25 2.3 1.566 3.871 2.171.218.143.445.265.68.377l-3.078-2.467c-.228-.126-.453-.26-.694-.36-.077-.04-.307-.163-.232-.12 1.041.61 4.18 2.41 3.132 1.814-1.21-.688-2.41-1.399-3.619-2.09-1.043-.596 4.17 2.392 3.12 1.806-1.22-.682-2.419-1.399-3.632-2.092-.089-.05-.183-.093-.274-.139-.624-.268-1.269-.485-1.95-.535-.773-.076-1.548-.05-2.322-.03-.759.035-1.522.088-2.235.375-.704.279-1.39.598-2.096.873-.626.253-1.264.475-1.88.751-.57.274-1.102.626-1.666.913-.7.408-1.437.743-2.147 1.135q-1.02.526-2.032 1.074z" fill="#16b139" fillOpacity="1" strokeWidth=".0529167" />

            {/* Connection lines for TORSO/shoulders (purple) */}
            <Path d="M241.416 56.867c1.172.299 2.31.69 3.44 1.125 1.37.59 2.797 1.03 4.161 1.637 1.12.532 2.244 1.055 3.327 1.66.162.09.647.365.486.272-9.682-5.59 8.687 4.982-1.147-.666 2.14 1.463 4.474 2.477 6.81 3.543 1.126.466 2.306.79 3.458 1.19.564.199 1.148.307 1.74.382l-3.132-2.347c-.572-.1-1.136-.23-1.684-.426-1.142-.37-2.298-.71-3.398-1.192-1.493-.675-6.427-3.134-.154.248-1.255-.722-2.508-1.448-3.764-2.168-.136-.078-.55-.304-.414-.225q1.45.85 2.907 1.687c.153.089-.302-.184-.455-.273q-1.893-1.1-3.79-2.193-.244-.137-.49-.272c-1.084-.578-2.2-1.095-3.316-1.606-1.374-.578-2.793-1.04-4.167-1.619a49 49 0 0 0-3.552-1.17z" fill="#770072" strokeWidth=".0529167" />
            <Path d="M249.744 39.337c.065-.086.156-.148.24-.215.076-.058.14-.132.216-.191q.076-.057.154-.109c.161-.103.325-.21.5-.287q.06-.024.121-.045c.08-.04.17-.056.252-.09.045-.019.086-.045.13-.064.046-.019.095-.031.141-.048l.29-.106c.156-.031.305-.09.458-.133.051-.015.104-.023.154-.038.521-.152-.22.043.355-.104q.1-.023.201-.042c.167-.028.267-.033.435-.049.16-.015.32-.034.48-.043q.136-.006.273-.01c.096-.007.193-.018.29-.022l.6-.006c.283 0 .567-.004.85 0 .555.013 1.11-.007 1.664-.011.11.002.217.007.325.005.118-.002.236-.016.354-.015.133.002.266.014.4.025.371.03.737.085 1.105.146.487.089.967.215 1.437.369.496.124.987.266 1.468.44.363.13.738.267 1.074.46q.09.054.177.111l.406.235c.072.042.15.073.224.11l.743.368.218.102-2.86-2.27-.168-.073a11 11 0 0 1-.695-.35 8 8 0 0 1-.262-.154c1.807 1.043 6.32 3.654-.43-.25-.172-.088-.236-.126-.412-.196-.27-.108-.553-.182-.828-.28-.514-.161-1.032-.31-1.544-.482-.172-.046-.242-.067-.416-.103a6.5 6.5 0 0 0-.928-.116c-.468-.022-.938-.027-1.406-.067-.149-.013-.297-.036-.446-.048-.113-.008-.226-.008-.34-.011-.488-.018-.175-.005-.656-.028q-.15-.01-.303-.014c-.258-.005-.517.01-.775.012-.924.03.425-.012-.553.012l-.564.02c-.098.005-.195.012-.293.013-.108.002-.217-.003-.325-.004-.28.006-.564 0-.844.024-.116.01-.342.048-.457.066l-.232.039q-.104.023-.207.042c-.07.013-.14.02-.21.035-.055.012-.107.031-.16.047-.156.044-.31.084-.46.145-.069.02-.255.075-.324.1-.046.017-.09.04-.135.055-.05.018-.104.028-.155.045-.033.012-.22.093-.252.106-.244.112-.49.22-.72.361q-.082.058-.166.114c-.093.061-.195.109-.286.174a.7.7 0 0 1-.255.159z" fill="#770072" strokeWidth=".0529167" />

            {/* Connection lines for back (blue) */}
            <Path d="M173.763 51.205c1.456-.909 3.065-1.524 4.664-2.129a147 147 0 0 1 5.586-1.917c1.656-.536 3.376-.818 5.102-1.002 2.448-.28 4.908-.147 7.358.012 2.512.2 5.026.363 7.537.583 2.142.222 4.284.442 6.436.538 1.798.086 3.596.15 5.396.15l.443-.002-3.104-2.237-.4.028a44 44 0 0 1-5.176-.028c-2.149-.151-4.292-.354-6.438-.55-2.49-.19-4.983-.32-7.47-.527-1.315-.088-2.627-.176-3.945-.182a54 54 0 0 0-2.456.06q-.57.026-1.14.055c-1.75.203-3.49.495-5.17 1.045-1.842.62-3.644 1.34-5.464 2.02-1.686.63-3.374 1.252-5.045 1.922z" fill="#0026cd" fillOpacity="1" strokeWidth=".0529167" />

            {/* All exercise ellipses with labels */}
            <Ellipse cx="32.679" cy="54.725" rx="32.653" ry="27.963" fill="#202020" fillOpacity="1" stroke="#000" strokeWidth=".0529167" />
            <SvgText x="32.679" y="57" fontSize="4" fill="#fff" textAnchor="middle">ОТЖИМАНИЯ</SvgText>

            <Ellipse cx="102.5" cy="64.625" rx="18.063" ry="11.463" fill="#16b139" fillOpacity="1" stroke="#000" strokeWidth=".0529167" />
            <SvgText x="102.5" y="66" fontSize="3.5" fill="#fff" textAnchor="middle">ПРИСЕДАНИЯ</SvgText>

            <Ellipse cx="163.163" cy="75.186" rx="19.232" ry="11.897" fill="#16b139" fillOpacity="1" stroke="#000" strokeWidth=".0529167" />
            <SvgText x="163.163" y="77" fontSize="3.5" fill="#fff" textAnchor="middle">ВЫПАДЫ</SvgText>

            <Ellipse cx="212.963" cy="73.136" rx="15.284" ry="9.553" fill="#16b139" fillOpacity="1" stroke="#000" strokeWidth=".0529167" />
            <SvgText x="212.963" y="74.5" fontSize="3" fill="#fff" textAnchor="middle">JUMPING JACK</SvgText>

            <Ellipse cx="163.463" cy="21.552" rx="19.626" ry="10.768" fill="#ff8a00" fillOpacity="1" stroke="#000" strokeWidth=".0529167" />
            <SvgText x="163.463" y="20" fontSize="3" fill="#fff" textAnchor="middle">СГИБАНИЕ РУК</SvgText>
            <SvgText x="163.463" y="24" fontSize="3" fill="#fff" textAnchor="middle">НА ТРИЦЕПС</SvgText>

            <Ellipse cx="270.279" cy="15.125" rx="19.8" ry="12.332" fill="#ff8a00" fillOpacity="1" stroke="#000" strokeWidth=".0529167" />
            <SvgText x="270.279" y="14" fontSize="3" fill="#fff" textAnchor="middle">СГИБАНИЕ РУК</SvgText>
            <SvgText x="270.279" y="18" fontSize="3" fill="#fff" textAnchor="middle">НА БИЦЕПС</SvgText>

            <Ellipse cx="92.947" cy="36.141" rx="15.458" ry="10.768" fill="#ff8a00" fillOpacity="1" stroke="#000" strokeWidth=".0529167" />

            <Ellipse cx="229.116" cy="43.61" rx="23.1" ry="15.111" fill="#770072" stroke="#000" strokeWidth=".0529167" />
            <SvgText x="229.116" y="42" fontSize="3" fill="#fff" textAnchor="middle">ЖИМ ГАНТЕЛЕЙ</SvgText>
            <SvgText x="229.116" y="46" fontSize="3" fill="#fff" textAnchor="middle">НА ПЛЕЧИ</SvgText>

            <Ellipse cx="281.742" cy="43.61" rx="21.189" ry="11.637" fill="#770072" stroke="#000" strokeWidth=".0529167" />
            <SvgText x="281.742" y="45" fontSize="3" fill="#fff" textAnchor="middle">ТЯГА ГАНТЕЛЕЙ</SvgText>

            <Ellipse cx="279.831" cy="68.62" rx="21.363" ry="11.289" fill="#770072" stroke="#000" strokeWidth=".0529167" />
            <SvgText x="279.831" y="67" fontSize="2.8" fill="#fff" textAnchor="middle">ПОДЪЁМ ГАНТЕЛЕЙ</SvgText>
            <SvgText x="279.831" y="71" fontSize="2.8" fill="#fff" textAnchor="middle">В СТОРОНЫ</SvgText>

            <Ellipse cx="154.952" cy="49.341" rx="19.105" ry="9.726" fill="#0026cd" fillOpacity="1" stroke="#000" strokeWidth=".0529167" />
            <SvgText x="154.952" y="51" fontSize="3" fill="#fff" textAnchor="middle">ПОДЪЁМ КОРПУСА</SvgText>

            <Ellipse cx="360.942" cy="19.641" rx="30.221" ry="15.111" fill="#ff14a7" fillOpacity="1" strokeWidth=".264583" />
            <SvgText x="360.942" y="21" fontSize="3.5" fill="#fff" textAnchor="middle">ПОДТЯГИВАНИЯ</SvgText>

            <Ellipse cx="355.384" cy="75.741" rx="21.189" ry="12.505" fill="#ff14a7" fillOpacity="1" strokeWidth=".264583" />
            <SvgText x="355.384" y="74" fontSize="3" fill="#fff" textAnchor="middle">ПОДЪЁМ НА ТУРНИК</SvgText>
            <SvgText x="355.384" y="78" fontSize="3" fill="#fff" textAnchor="middle">С ПЕРЕВОРОТОМ</SvgText>

            <Ellipse cx="421.384" cy="52.12" rx="30.221" ry="15.979" fill="#ff14a7" fillOpacity="1" strokeWidth=".264583" />
            <SvgText x="421.384" y="51" fontSize="3.5" fill="#fff" textAnchor="middle">ОТЖИМАНИЯ</SvgText>
            <SvgText x="421.384" y="55" fontSize="3.5" fill="#fff" textAnchor="middle">НА БРУСЬЯХ</SvgText>

            <Ellipse cx="453.689" cy="14.952" rx="29.874" ry="13.547" fill="#ff14a7" fillOpacity="1" strokeWidth=".264583" />
            <SvgText x="453.689" y="16" fontSize="3.5" fill="#fff" textAnchor="middle">ВЫХОД АНГЕЛА</SvgText>

            {/* Lock icons - 13 locks showing locked exercises */}
            <Path d="M95.423 24.707v-1.915a4.15 4.15 0 0 1 8.3 0v1.915h.48c.616 0 1.116.5 1.116 1.117v6.066c0 .617-.5 1.117-1.117 1.117h-9.258c-.617 0-1.117-.5-1.117-1.117v-6.066c0-.617.5-1.117 1.117-1.117zm1.915-1.915a2.235 2.235 0 0 1 4.47 0v1.915h-4.47zm2.873 5.865a1.116 1.116 0 0 0-.638-2.035 1.118 1.118 0 0 0-.638 2.035v1.796a.638.638 0 1 0 1.276 0z" fill="#FFD700" stroke="#000" strokeWidth=".161213" transform="translate(12.316 28.51)" />
            <Path d="M95.423 24.707v-1.915a4.15 4.15 0 0 1 8.3 0v1.915h.48c.616 0 1.116.5 1.116 1.117v6.066c0 .617-.5 1.117-1.117 1.117h-9.258c-.617 0-1.117-.5-1.117-1.117v-6.066c0-.617.5-1.117 1.117-1.117zm1.915-1.915a2.235 2.235 0 0 1 4.47 0v1.915h-4.47zm2.873 5.865a1.116 1.116 0 0 0-.638-2.035 1.118 1.118 0 0 0-.638 2.035v1.796a.638.638 0 1 0 1.276 0z" fill="#FFD700" stroke="#000" strokeWidth=".161213" transform="translate(69.684 13.467)" />
            <Path d="M95.423 24.707v-1.915a4.15 4.15 0 0 1 8.3 0v1.915h.48c.616 0 1.116.5 1.116 1.117v6.066c0 .617-.5 1.117-1.117 1.117h-9.258c-.617 0-1.117-.5-1.117-1.117v-6.066c0-.617.5-1.117 1.117-1.117zm1.915-1.915a2.235 2.235 0 0 1 4.47 0v1.915h-4.47zm2.873 5.865a1.116 1.116 0 0 0-.638-2.035 1.118 1.118 0 0 0-.638 2.035v1.796a.638.638 0 1 0 1.276 0z" fill="#FFD700" stroke="#000" strokeWidth=".161213" transform="translate(75.688 -10.324)" />
            <Path d="M95.423 24.707v-1.915a4.15 4.15 0 0 1 8.3 0v1.915h.48c.616 0 1.116.5 1.116 1.117v6.066c0 .617-.5 1.117-1.117 1.117h-9.258c-.617 0-1.117-.5-1.117-1.117v-6.066c0-.617.5-1.117 1.117-1.117zm1.915-1.915a2.235 2.235 0 0 1 4.47 0v1.915h-4.47zm2.873 5.865a1.116 1.116 0 0 0-.638-2.035 1.118 1.118 0 0 0-.638 2.035v1.796a.638.638 0 1 0 1.276 0z" fill="#FFD700" stroke="#000" strokeWidth=".161213" transform="translate(140.982 11.232)" />
            <Path d="M95.423 24.707v-1.915a4.15 4.15 0 0 1 8.3 0v1.915h.48c.616 0 1.116.5 1.116 1.117v6.066c0 .617-.5 1.117-1.117 1.117h-9.258c-.617 0-1.117-.5-1.117-1.117v-6.066c0-.617.5-1.117 1.117-1.117zm1.915-1.915a2.235 2.235 0 0 1 4.47 0v1.915h-4.47zm2.873 5.865a1.116 1.116 0 0 0-.638-2.035 1.118 1.118 0 0 0-.638 2.035v1.796a.638.638 0 1 0 1.276 0z" fill="#FFD700" stroke="#000" strokeWidth=".161213" transform="translate(124.076 45.283)" />
            <Path d="M95.423 24.707v-1.915a4.15 4.15 0 0 1 8.3 0v1.915h.48c.616 0 1.116.5 1.116 1.117v6.066c0 .617-.5 1.117-1.117 1.117h-9.258c-.617 0-1.117-.5-1.117-1.117v-6.066c0-.617.5-1.117 1.117-1.117zm1.915-1.915a2.235 2.235 0 0 1 4.47 0v1.915h-4.47zm2.873 5.865a1.116 1.116 0 0 0-.638-2.035 1.118 1.118 0 0 0-.638 2.035v1.796a.638.638 0 1 0 1.276 0z" fill="#FFD700" stroke="#000" strokeWidth=".161213" transform="translate(75.561 46.553)" />
            <Path d="M95.423 24.707v-1.915a4.15 4.15 0 0 1 8.3 0v1.915h.48c.616 0 1.116.5 1.116 1.117v6.066c0 .617-.5 1.117-1.117 1.117h-9.258c-.617 0-1.117-.5-1.117-1.117v-6.066c0-.617.5-1.117 1.117-1.117zm1.915-1.915a2.235 2.235 0 0 1 4.47 0v1.915h-4.47zm2.873 5.865a1.116 1.116 0 0 0-.638-2.035 1.118 1.118 0 0 0-.638 2.035v1.796a.638.638 0 1 0 1.276 0z" fill="#FFD700" stroke="#000" strokeWidth=".161213" transform="translate(182.32 -18.642)" />
            <Path d="M95.423 24.707v-1.915a4.15 4.15 0 0 1 8.3 0v1.915h.48c.616 0 1.116.5 1.116 1.117v6.066c0 .617-.5 1.117-1.117 1.117h-9.258c-.617 0-1.117-.5-1.117-1.117v-6.066c0-.617.5-1.117 1.117-1.117zm1.915-1.915a2.235 2.235 0 0 1 4.47 0v1.915h-4.47zm2.873 5.865a1.116 1.116 0 0 0-.638-2.035 1.118 1.118 0 0 0-.638 2.035v1.796a.638.638 0 1 0 1.276 0z" fill="#FFD700" stroke="#000" strokeWidth=".161213" transform="translate(193.782 15.4)" />
            <Path d="M95.423 24.707v-1.915a4.15 4.15 0 0 1 8.3 0v1.915h.48c.616 0 1.116.5 1.116 1.117v6.066c0 .617-.5 1.117-1.117 1.117h-9.258c-.617 0-1.117-.5-1.117-1.117v-6.066c0-.617.5-1.117 1.117-1.117zm1.915-1.915a2.235 2.235 0 0 1 4.47 0v1.915h-4.47zm2.873 5.865a1.116 1.116 0 0 0-.638-2.035 1.118 1.118 0 0 0-.638 2.035v1.796a.638.638 0 1 0 1.276 0z" fill="#FFD700" stroke="#000" strokeWidth=".161213" transform="translate(193.435 40.758)" />
            <Path d="M95.423 24.707v-1.915a4.15 4.15 0 0 1 8.3 0v1.915h.48c.616 0 1.116.5 1.116 1.117v6.066c0 .617-.5 1.117-1.117 1.117h-9.258c-.617 0-1.117-.5-1.117-1.117v-6.066c0-.617.5-1.117 1.117-1.117zm1.915-1.915a2.235 2.235 0 0 1 4.47 0v1.915h-4.47zm2.873 5.865a1.116 1.116 0 0 0-.638-2.035 1.118 1.118 0 0 0-.638 2.035v1.796a.638.638 0 1 0 1.276 0z" fill="#FFD700" stroke="#000" strokeWidth=".161213" transform="translate(265.688 48.4)" />
            <Path d="M95.423 24.707v-1.915a4.15 4.15 0 0 1 8.3 0v1.915h.48c.616 0 1.116.5 1.116 1.117v6.066c0 .617-.5 1.117-1.117 1.117h-9.258c-.617 0-1.117-.5-1.117-1.117v-6.066c0-.617.5-1.117 1.117-1.117zm1.915-1.915a2.235 2.235 0 0 1 4.47 0v1.915h-4.47zm2.873 5.865a1.116 1.116 0 0 0-.638-2.035 1.118 1.118 0 0 0-.638 2.035v1.796a.638.638 0 1 0 1.276 0z" fill="#FFD700" stroke="#000" strokeWidth=".161213" transform="translate(277.15 -7.179)" />
            <Path d="M95.423 24.707v-1.915a4.15 4.15 0 0 1 8.3 0v1.915h.48c.616 0 1.116.5 1.116 1.117v6.066c0 .617-.5 1.117-1.117 1.117h-9.258c-.617 0-1.117-.5-1.117-1.117v-6.066c0-.617.5-1.117 1.117-1.117zm1.915-1.915a2.235 2.235 0 0 1 4.47 0v1.915h-4.47zm2.873 5.865a1.116 1.116 0 0 0-.638-2.035 1.118 1.118 0 0 0-.638 2.035v1.796a.638.638 0 1 0 1.276 0z" fill="#FFD700" stroke="#000" strokeWidth=".161213" transform="translate(337.593 25.821)" />
            <Path d="M95.423 24.707v-1.915a4.15 4.15 0 0 1 8.3 0v1.915h.48c.616 0 1.116.5 1.116 1.117v6.066c0 .617-.5 1.117-1.117 1.117h-9.258c-.617 0-1.117-.5-1.117-1.117v-6.066c0-.617.5-1.117 1.117-1.117zm1.915-1.915a2.235 2.235 0 0 1 4.47 0v1.915h-4.47zm2.873 5.865a1.116 1.116 0 0 0-.638-2.035 1.118 1.118 0 0 0-.638 2.035v1.796a.638.638 0 1 0 1.276 0z" fill="#FFD700" stroke="#000" strokeWidth=".161213" transform="translate(370.94 -12.042)" />
        </Svg>
    );
};

// Weekly Stats Card Component
const WeeklyStatsCard = ({ stats }: { stats: FriendWeeklyStats }) => {
    const totalXP = stats.stats.arms + stats.stats.legs + stats.stats.torso + stats.stats.back + stats.stats.running;

    return (
        <View style={styles.weeklyStatsCard}>
            <View style={styles.weeklyStatsHeader}>
                <Text style={styles.weeklyStatsAvatar}>{stats.avatar}</Text>
                <View style={styles.weeklyStatsUserInfo}>
                    <Text style={styles.weeklyStatsUserName}>{stats.userName}</Text>
                    <View style={styles.weeklyStreakBadge}>
                        <Text style={styles.weeklyStreakText}>🔥 {stats.weekStreak} week streak</Text>
                    </View>
                </View>
            </View>

            <View style={styles.muscleGroupsContainer}>
                <View style={styles.muscleGroupRow}>
                    <ArmsIcon size={18} />
                    <Text style={styles.muscleGroupLabel}>Arms</Text>
                    <Text style={styles.muscleGroupXP}>{stats.stats.arms} XP</Text>
                </View>
                <View style={styles.muscleGroupRow}>
                    <LegsIcon size={18} />
                    <Text style={styles.muscleGroupLabel}>Legs</Text>
                    <Text style={styles.muscleGroupXP}>{stats.stats.legs} XP</Text>
                </View>
                <View style={styles.muscleGroupRow}>
                    <TorsoIcon size={18} />
                    <Text style={styles.muscleGroupLabel}>Torso</Text>
                    <Text style={styles.muscleGroupXP}>{stats.stats.torso} XP</Text>
                </View>
                <View style={styles.muscleGroupRow}>
                    <BackIcon size={18} />
                    <Text style={styles.muscleGroupLabel}>Back</Text>
                    <Text style={styles.muscleGroupXP}>{stats.stats.back} XP</Text>
                </View>
                <View style={styles.muscleGroupRow}>
                    <RunningIcon size={18} />
                    <Text style={styles.muscleGroupLabel}>Running</Text>
                    <Text style={styles.muscleGroupXP}>{stats.stats.running} XP</Text>
                </View>
            </View>

            <View style={styles.totalXPContainer}>
                <Text style={styles.totalXPLabel}>Total Weekly XP</Text>
                <Text style={styles.totalXPValue}>{totalXP}</Text>
            </View>
        </View>
    );
};

function MapScreen() {
    const [mapScale, setMapScale] = useState(1.5);

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.title}>🗺️ Карта упражнений</Text>
                    <Text style={styles.subtitle}>Все доступные упражнения</Text>
                </View>

                <View style={styles.zoomControls}>
                    <Text style={styles.zoomLabel}>Масштаб: {mapScale.toFixed(1)}x</Text>
                    <View style={styles.zoomButtons}>
                        <TouchableOpacity onPress={() => setMapScale(prev => Math.max(prev - 0.5, 1))} style={styles.zoomButton}>
                            <Text style={styles.zoomButtonText}>➖</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setMapScale(1.5)} style={styles.zoomButton}>
                            <Text style={styles.zoomButtonText}>⟲</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setMapScale(prev => Math.min(prev + 0.5, 10))} style={styles.zoomButton}>
                            <Text style={styles.zoomButtonText}>➕</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.mapContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <ScrollView style={{ height: 270 }} showsVerticalScrollIndicator={true}>
                            <ExerciseMapSvg scale={mapScale} />
                        </ScrollView>
                    </ScrollView>
                </View>

                <View style={styles.legend}>
                    <Text style={styles.legendTitle}>Группы мышц</Text>
                    <View style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: '#FF8A00' }]} />
                        <Text style={styles.legendText}>Руки (Arms)</Text>
                    </View>
                    <View style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: '#16B139' }]} />
                        <Text style={styles.legendText}>Ноги (Legs)</Text>
                    </View>
                    <View style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: '#770072' }]} />
                        <Text style={styles.legendText}>Грудь/Плечи (TORSO)</Text>
                    </View>
                    <View style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: '#0026CD' }]} />
                        <Text style={styles.legendText}>Спина (Back)</Text>
                    </View>
                    <View style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: '#FF14A7' }]} />
                        <Text style={styles.legendText}>Продвинутые (Advanced)</Text>
                    </View>
                </View>

                {/* Friends' Weekly Stats Feed */}
                <View style={styles.weeklyStatsFeedSection}>
                    <Text style={styles.weeklyStatsFeedTitle}>🏆 Friends' Weekly Stats</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.weeklyStatsFeedContainer}
                    >
                        {MOCK_FRIENDS_WEEKLY_STATS.map((stats) => (
                            <WeeklyStatsCard key={stats.id} stats={stats} />
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.infoBox}>
                    <Text style={styles.infoText}>
                        🔒 Замочек означает, что упражнение заблокировано{'\n'}
                        💪 Выполняйте упражнения, чтобы открыть новые
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1a1a1a' },
    content: { padding: 20 },
    header: { alignItems: 'center', marginBottom: 20, marginTop: 10 },
    title: { fontSize: 28, fontWeight: 'bold', color: '#FF14A7', marginBottom: 4 },
    subtitle: { fontSize: 14, color: '#999' },
    zoomControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2a2a2a', borderRadius: 12, padding: 15, marginBottom: 15 },
    zoomLabel: { fontSize: 16, color: '#fff', fontWeight: 'bold' },
    zoomButtons: { flexDirection: 'row', gap: 15 },
    zoomButton: { paddingHorizontal: 15, paddingVertical: 5, backgroundColor: '#3a3a3a', borderRadius: 8 },
    zoomButtonText: { fontSize: 24, color: '#FF14A7' },
    mapContainer: { backgroundColor: '#2a2a2a', borderRadius: 12, padding: 15, marginBottom: 20, height: 300, overflow: 'hidden' },
    legend: { backgroundColor: '#2a2a2a', borderRadius: 12, padding: 15, marginBottom: 15 },
    legendTitle: { fontSize: 18, fontWeight: 'bold', color: 'white', marginBottom: 12 },
    legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    legendDot: { width: 16, height: 16, borderRadius: 8, marginRight: 10 },
    legendText: { fontSize: 14, color: '#ccc' },
    infoBox: { backgroundColor: '#2a2a2a', borderRadius: 12, padding: 15, borderWidth: 1, borderColor: '#FF14A7' },
    infoText: { fontSize: 13, color: '#ccc', lineHeight: 20, textAlign: 'center' },
    // Weekly Stats Feed Styles
    weeklyStatsFeedSection: {
        marginBottom: 20,
    },
    weeklyStatsFeedTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FF14A7',
        marginBottom: 15,
        paddingHorizontal: 4,
    },
    weeklyStatsFeedContainer: {
        gap: 15,
        paddingRight: 20,
    },
    weeklyStatsCard: {
        width: 240,
        backgroundColor: '#2a2a2a',
        borderRadius: 16,
        padding: 16,
        borderWidth: 2,
        borderColor: '#FF14A7',
    },
    weeklyStatsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#3a3a3a',
    },
    weeklyStatsAvatar: {
        fontSize: 28,
        marginRight: 12,
    },
    weeklyStatsUserInfo: {
        flex: 1,
    },
    weeklyStatsUserName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    weeklyStreakBadge: {
        backgroundColor: '#3a3a3a',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
        alignSelf: 'flex-start',
    },
    weeklyStreakText: {
        fontSize: 11,
        color: '#FF8A00',
        fontWeight: '600',
    },
    muscleGroupsContainer: {
        gap: 8,
        marginBottom: 12,
    },
    muscleGroupRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    muscleGroupLabel: {
        flex: 1,
        fontSize: 13,
        color: '#ccc',
    },
    muscleGroupXP: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#FF14A7',
    },
    totalXPContainer: {
        marginTop: 8,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#3a3a3a',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    totalXPLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#fff',
    },
    totalXPValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FF14A7',
    },
});

export default MapScreen;
