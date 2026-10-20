#pragma once

#include <windows.h>
#include <audioclient.h>
#include <audioclientactivationparams.h>
#include <mmdeviceapi.h>
#include <wrl/client.h>
#include <wrl/implements.h>
#include <avrt.h>
#include <tlhelp32.h>

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cstdio>
#include <cwctype>
#include <functional>
#include <future>
#include <memory>
#include <mutex>
#include <set>
#include <string>
#include <thread>
#include <unordered_map>
#include <unordered_set>
#include <vector>

using Microsoft::WRL::ComPtr;

class AudioInterfaceCompletionHandler :
    public Microsoft::WRL::RuntimeClass<
        Microsoft::WRL::RuntimeClassFlags<Microsoft::WRL::ClassicCom>,
        IActivateAudioInterfaceCompletionHandler,
        Microsoft::WRL::FtmBase>
{
public:
    HANDLE m_hCompletedEvent;
    HRESULT m_activateResult;
    ComPtr<IUnknown> m_activatedInterface;

    AudioInterfaceCompletionHandler();
    virtual ~AudioInterfaceCompletionHandler();

    STDMETHOD(ActivateCompleted)(IActivateAudioInterfaceAsyncOperation* operation) override;
};

struct AudioChunk {
    std::vector<float> samples; // Interleaved Float32 samples
    uint32_t sampleRate;
    uint32_t channels;
};

using AudioDataCallback = std::function<void(const AudioChunk&)>;

class ProcessAudioCapture {
public:
    ProcessAudioCapture();
    ~ProcessAudioCapture();

    static bool IsSupported();
    static DWORD GetProcessIdFromWindowHandle(HWND hwnd);
    static std::vector<DWORD> FindFilteredCommunicationPids();

    bool Start(DWORD processId, AudioDataCallback callback, std::string& outError);
    bool StartScreenIsolated(AudioDataCallback callback, std::string& outError);
    void Stop();
    bool IsRunning() const;

private:
    void CaptureThreadFunc(
        DWORD processId,
        AudioDataCallback callback,
        std::shared_ptr<std::promise<std::string>> initPromise);
    void ScreenIsolatedCaptureThreadFunc(
        AudioDataCallback callback,
        std::shared_ptr<std::promise<std::string>> initPromise);
    void StopLocked();

    std::atomic<bool> m_running{ false };
    std::thread m_thread;
    HANDLE m_hStopEvent{ nullptr };
    mutable std::mutex m_mutex;
};

