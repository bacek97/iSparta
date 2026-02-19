if(NOT TARGET shopify_react-native-skia::rnskia)
add_library(shopify_react-native-skia::rnskia SHARED IMPORTED)
set_target_properties(shopify_react-native-skia::rnskia PROPERTIES
    IMPORTED_LOCATION "C:/tmp/isparta1/iSparta/node_modules/@shopify/react-native-skia/android/build/intermediates/cxx/RelWithDebInfo/2p1i6g37/obj/armeabi-v7a/librnskia.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/tmp/isparta1/iSparta/node_modules/@shopify/react-native-skia/android/build/headers/rnskia"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

