if(NOT TARGET react-native-vision-camera::VisionCamera)
add_library(react-native-vision-camera::VisionCamera SHARED IMPORTED)
set_target_properties(react-native-vision-camera::VisionCamera PROPERTIES
    IMPORTED_LOCATION "C:/tmp/isparta1/iSparta/node_modules/react-native-vision-camera/android/build/intermediates/cxx/RelWithDebInfo/e20242e4/obj/x86_64/libVisionCamera.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/tmp/isparta1/iSparta/node_modules/react-native-vision-camera/android/build/headers/visioncamera"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

