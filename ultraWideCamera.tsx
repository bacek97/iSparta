// https://github.com/mrousavy/react-native-vision-camera/issues/3451#issuecomment-3501299730
// import { useIsFocused } from '@react-navigation/native'
import { useRef, useState } from 'react'
import { Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View, Dimensions } from 'react-native'
import { Camera, CameraDevice, getCameraDevice, useCameraDevice } from 'react-native-vision-camera'

const isAndroid = Platform.OS === 'android'
const isIOS = Platform.OS === 'ios'
const SCREEN_W = Dimensions.get('window').width

const CameraScreen: React.FC<any> = () => {
    const [cameraID, setCameraID] = useState(1)
    const cameraRef = useRef<Camera | null>(null)
    //   const isFocused = useIsFocused()
    const isFocused = true
    const isForeground = true

    const isActive = isFocused && isForeground
    const physicalCameras = Camera.getAvailableCameraDevices()
    const backCameras = physicalCameras?.filter((d) => d.position === 'front')
    let supportedDevice: CameraDevice | undefined = useCameraDevice('front', {
        physicalDevices: ['wide-angle-camera', 'ultra-wide-angle-camera', 'telephoto-camera'],
    })
    const hasWideAngleSupport = supportedDevice?.physicalDevices.includes('ultra-wide-angle-camera')
    let ultraWideCamera: CameraDevice | undefined
    let ultraWideDevice: CameraDevice | undefined

    if (isAndroid && !hasWideAngleSupport) {
        ultraWideCamera = backCameras?.find((item) => item?.physicalDevices.includes('ultra-wide-angle-camera'))
    }
    ultraWideDevice = getCameraDevice([backCameras[cameraID]], 'front')
    if (ultraWideCamera && isAndroid) {
    }
    console.log('ultraWideDevice', ultraWideDevice);
    console.log('supportedDevice', supportedDevice);
    console.log('ultraWideCamera', ultraWideCamera);
    console.log('physicalCameras', physicalCameras);
    const { minZoom, maxZoom, neutralZoom } = supportedDevice || {}
    const ultraWideZoom = ultraWideCamera && isAndroid ? ultraWideCamera?.minZoom : minZoom
    const defaultZoom = neutralZoom
    const zoom2xFactor = isIOS ? 0.125 : 0.198
    const zoom2x = Math.min(neutralZoom! * 10, maxZoom!) * zoom2xFactor
    const [zoom, setZoom] = useState(defaultZoom)
    const [isUltraWideSelected, setIsUltraWideSelected] = useState(false)

    const selectedFormat = ultraWideDevice?.formats.find(
        (f) => f.videoWidth === 640 && f.videoHeight === 480
    ) || ultraWideDevice?.formats[0];


    const zoomLevels = Platform.select({
        ios: [
            ...(hasWideAngleSupport ? [{ zoomValue: ultraWideZoom, label: 0.5 }] : []),
            { zoomValue: defaultZoom, label: 1 },
            { zoomValue: zoom2x, label: 2 },
        ],
        android: [
            ...(ultraWideCamera || hasWideAngleSupport
                ? [
                    {
                        zoomValue: hasWideAngleSupport ? ultraWideZoom : 0.5,
                        label: hasWideAngleSupport ? ultraWideZoom?.toFixed(1) : 0.5,
                    },
                ]
                : []),
            { zoomValue: defaultZoom, label: 1 },
            { zoomValue: zoom2x, label: 2 },
            // { zoomValue: zoom2x < 2 ? 3 : 2, label: zoom2x < 2 ? 3 : 2 },
        ],
    })

    const handleZoomChange = (zoomValue: number | string) => {
        if (isAndroid && ultraWideCamera && Number(zoomValue) < 1) {
            setIsUltraWideSelected(true)
        } else if (!hasWideAngleSupport) {
            setIsUltraWideSelected(false)
        }
        setZoom(Number(zoomValue) || defaultZoom)
    }

    const renderCameraView = () => {
        const cameraDevice = isAndroid && isUltraWideSelected && ultraWideCamera ? ultraWideDevice : supportedDevice

        if (!cameraDevice) {
            return (
                <View style={styles.noCameraView}>
                    <Text>Camera not support</Text>
                </View>
            )
        }
        return (
            <View>
                <View>
                    <Camera
                        zoom={zoom}
                        photo={true}
                        ref={cameraRef}
                        enableZoomGesture
                        resizeMode="cover"
                        isActive={isActive}
                        style={styles.camera}
                        device={ultraWideDevice!}
                        format={selectedFormat}
                        frameProcessor={frameProcessor}
                    />
                </View>
                {/* <View style={styles.zoomOptionsView}>
                    {zoomLevels?.map((item: any) => (
                        <TouchableOpacity onPress={() => handleZoomChange(item?.zoomValue)} style={styles.zoomOption}>
                            <Text>{item?.label}x</Text>
                        </TouchableOpacity>
                    ))}
                </View> */}
                <View style={styles.zoomOptionsView}>
                    {backCameras?.map((item: any, id: number) => (
                        <TouchableOpacity onPress={() => setCameraID(id)} style={styles.zoomOption}>
                            <Text>cam{id}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        )
    }

    return (
        <SafeAreaView style={styles.safeAreaView}>
            <View>{renderCameraView()}</View>
        </SafeAreaView>
    )
}
const styles = StyleSheet.create({
    safeAreaView: {
        flex: 1,
        width: '100%',
        height: '100%',
        paddingTop: 20,
        backgroundColor: '#000',
    },
    camera: {
        width: SCREEN_W,
        height: SCREEN_W * (4 / 3),
        // overflow: 'hidden',
    },
    noCameraView: {
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    zoomOptionsView: {
        alignSelf: 'center',
        display: 'flex',
        flexDirection: 'row',
        columnGap: 20,
        marginBottom: 20,
    },
    zoomOption: {
        backgroundColor: '#fff',
        borderRadius: 20,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 12,
    },
})
export default CameraScreen