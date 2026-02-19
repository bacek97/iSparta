if(NOT TARGET shopify_react-native-skia::rnskia)
add_library(shopify_react-native-skia::rnskia INTERFACE IMPORTED)
set_target_properties(shopify_react-native-skia::rnskia PROPERTIES
    INTERFACE_INCLUDE_DIRECTORIES "C:/tmp/isparta1/iSparta/node_modules/@shopify/react-native-skia/android/build/headers/rnskia"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

