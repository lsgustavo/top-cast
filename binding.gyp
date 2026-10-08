{
  "targets": [
    {
      "target_name": "audio_loopback",
      "sources": [
        "src/native/main.cpp",
        "src/native/audio_capture.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "defines": [ "NAPI_CPP_EXCEPTIONS" ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1,
          "AdditionalOptions": [ "/std:c++17" ]
        }
      },
      "libraries": [
        "Mmdevapi.lib",
        "Ole32.lib",
        "Avrt.lib",
        "User32.lib"
      ]
    }
  ]
}

