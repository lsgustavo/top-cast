#pragma once

#include <windows.h>
#include <audioclient.h>
#include <audioclientactivationparams.h>
#include <mmdeviceapi.h>
#include <wrl/client.h>
#include <wrl/implements.h>
#include <avrt.h>

#include <atomic>
#include <functional>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
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

    bool Start(DWORD processId, AudioDataCallback callback, std::string& outError);
    void Stop();
    bool IsRunning() const;

private:
    void CaptureThreadFunc(DWORD processId, AudioDataCallback callback);

    std::atomic<bool> m_running{ false };
    std::thread m_thread;
    HANDLE m_hStopEvent{ nullptr };
    mutable std::mutex m_mutex;
};

