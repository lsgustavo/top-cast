#include <napi.h>
#include "audio_capture.h"

static ProcessAudioCapture g_capture;
static Napi::ThreadSafeFunction g_tsfn;

Napi::Boolean IsProcessLoopbackSupported(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Boolean::New(env, ProcessAudioCapture::IsSupported());
}

Napi::Number GetProcessIdFromWindowHandle(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1) {
        Napi::TypeError::New(env, "Handle da janela (HWND) e obrigatorio").ThrowAsJavaScriptException();
        return Napi::Number::New(env, 0);
    }

    HWND hwnd = nullptr;
    if (info[0].IsNumber()) {
        int64_t val = info[0].As<Napi::Number>().Int64Value();
        hwnd = reinterpret_cast<HWND>(static_cast<uintptr_t>(val));
    } else if (info[0].IsString()) {
        std::string str = info[0].As<Napi::String>().Utf8Value();
        try {
            uint64_t val = std::stoull(str);
            hwnd = reinterpret_cast<HWND>(static_cast<uintptr_t>(val));
        } catch (...) {
            try {
                int64_t val = std::stoll(str);
                hwnd = reinterpret_cast<HWND>(static_cast<intptr_t>(val));
            } catch (...) {
                hwnd = nullptr;
            }
        }
    }

    DWORD pid = ProcessAudioCapture::GetProcessIdFromWindowHandle(hwnd);
    return Napi::Number::New(env, pid);
}

Napi::Boolean StartProcessLoopback(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsFunction()) {
        Napi::TypeError::New(env, "Parametros esperados: (processId: number, callback: function)").ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }

    DWORD pid = static_cast<DWORD>(info[0].As<Napi::Number>().Uint32Value());
    Napi::Function jsCallback = info[1].As<Napi::Function>();

    if (g_tsfn) {
        g_tsfn.Release();
    }

    g_tsfn = Napi::ThreadSafeFunction::New(
        env,
        jsCallback,
        "TopCastProcessAudioCapture",
        0, // unlimited queue
        1  // 1 thread
    );

    std::string error;
    bool started = g_capture.Start(pid, [](const AudioChunk& chunk) {
        if (!g_tsfn) return;

        // Copiar dados para enviar a thread principal do Node.js
        auto pChunk = new AudioChunk(chunk);
        napi_status status = g_tsfn.NonBlockingCall(pChunk, [](Napi::Env env, Napi::Function jsCb, AudioChunk* pData) {
            if (env != nullptr && jsCb != nullptr && pData != nullptr) {
                Napi::HandleScope scope(env);
                size_t numSamples = pData->samples.size();
                Napi::Float32Array floatArray = Napi::Float32Array::New(env, numSamples);
                for (size_t i = 0; i < numSamples; ++i) {
                    floatArray[i] = pData->samples[i];
                }

                jsCb.Call({
                    floatArray,
                    Napi::Number::New(env, pData->sampleRate),
                    Napi::Number::New(env, pData->channels)
                });
            }
            delete pData;
        });

        if (status != napi_ok) {
            delete pChunk;
        }
    }, error);

    if (!started) {
        if (g_tsfn) {
            g_tsfn.Release();
        }
        if (!error.empty()) {
            Napi::Error::New(env, error).ThrowAsJavaScriptException();
        }
        return Napi::Boolean::New(env, false);
    }

    return Napi::Boolean::New(env, true);
}

Napi::Boolean StopProcessLoopback(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    g_capture.Stop();
    if (g_tsfn) {
        g_tsfn.Release();
    }
    return Napi::Boolean::New(env, true);
}

Napi::Boolean IsProcessLoopbackRunning(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Boolean::New(env, g_capture.IsRunning());
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set(Napi::String::New(env, "isProcessLoopbackSupported"),
                Napi::Function::New(env, IsProcessLoopbackSupported));
    exports.Set(Napi::String::New(env, "getProcessIdFromWindowHandle"),
                Napi::Function::New(env, GetProcessIdFromWindowHandle));
    exports.Set(Napi::String::New(env, "startProcessLoopback"),
                Napi::Function::New(env, StartProcessLoopback));
    exports.Set(Napi::String::New(env, "stopProcessLoopback"),
                Napi::Function::New(env, StopProcessLoopback));
    exports.Set(Napi::String::New(env, "isProcessLoopbackRunning"),
                Napi::Function::New(env, IsProcessLoopbackRunning));
    return exports;
}

NODE_API_MODULE(audio_loopback, Init)

