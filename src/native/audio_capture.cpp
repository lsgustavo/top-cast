#include "audio_capture.h"

#include <iostream>

#pragma comment(lib, "Mmdevapi.lib")
#pragma comment(lib, "Avrt.lib")
#pragma comment(lib, "Ole32.lib")

AudioInterfaceCompletionHandler::AudioInterfaceCompletionHandler()
    : m_activateResult(E_FAIL)
{
    m_hCompletedEvent = CreateEvent(nullptr, FALSE, FALSE, nullptr);
}

AudioInterfaceCompletionHandler::~AudioInterfaceCompletionHandler()
{
    if (m_hCompletedEvent) {
        CloseHandle(m_hCompletedEvent);
        m_hCompletedEvent = nullptr;
    }
}

HRESULT AudioInterfaceCompletionHandler::ActivateCompleted(IActivateAudioInterfaceAsyncOperation* operation)
{
    if (!operation) {
        return E_POINTER;
    }

    ComPtr<IUnknown> unk;
    HRESULT hr = operation->GetActivateResult(&m_activateResult, &unk);
    if (SUCCEEDED(hr)) {
        m_activatedInterface = unk;
    }
    if (m_hCompletedEvent) {
        SetEvent(m_hCompletedEvent);
    }
    return S_OK;
}

ProcessAudioCapture::ProcessAudioCapture()
{
    m_hStopEvent = CreateEvent(nullptr, TRUE, FALSE, nullptr);
}

ProcessAudioCapture::~ProcessAudioCapture()
{
    Stop();
    if (m_hStopEvent) {
        CloseHandle(m_hStopEvent);
        m_hStopEvent = nullptr;
    }
}

bool ProcessAudioCapture::IsSupported()
{
    OSVERSIONINFOEXW osvi = { sizeof(osvi) };
    typedef LONG(WINAPI* RtlGetVersionPtr)(PRTL_OSVERSIONINFOW);
    HMODULE hNtdll = GetModuleHandleW(L"ntdll.dll");
    if (hNtdll) {
        RtlGetVersionPtr pRtlGetVersion = (RtlGetVersionPtr)GetProcAddress(hNtdll, "RtlGetVersion");
        if (pRtlGetVersion) {
            RTL_OSVERSIONINFOW rovi = { sizeof(rovi) };
            if (pRtlGetVersion(&rovi) == 0) {
                return (rovi.dwMajorVersion > 10) || 
                       (rovi.dwMajorVersion == 10 && rovi.dwBuildNumber >= 20348);
            }
        }
    }
    return false;
}

DWORD ProcessAudioCapture::GetProcessIdFromWindowHandle(HWND hwnd)
{
    if (!hwnd || !IsWindow(hwnd)) {
        return 0;
    }
    DWORD pid = 0;
    GetWindowThreadProcessId(hwnd, &pid);
    return pid;
}

bool ProcessAudioCapture::Start(DWORD processId, AudioDataCallback callback, std::string& outError)
{
    std::lock_guard<std::mutex> lock(m_mutex);
    if (m_running.load()) {
        Stop();
    }

    if (!IsSupported()) {
        outError = "Process Loopback Audio Capture requer Windows 10 build 20348+ ou Windows 11.";
        return false;
    }

    if (processId == 0) {
        outError = "PID de processo invalido.";
        return false;
    }

    ResetEvent(m_hStopEvent);
    m_running.store(true);

    m_thread = std::thread(&ProcessAudioCapture::CaptureThreadFunc, this, processId, callback);
    return true;
}

void ProcessAudioCapture::Stop()
{
    std::lock_guard<std::mutex> lock(m_mutex);
    if (!m_running.load()) {
        return;
    }

    m_running.store(false);
    if (m_hStopEvent) {
        SetEvent(m_hStopEvent);
    }

    if (m_thread.joinable()) {
        m_thread.join();
    }
}

bool ProcessAudioCapture::IsRunning() const
{
    return m_running.load();
}

void ProcessAudioCapture::CaptureThreadFunc(DWORD processId, AudioDataCallback callback)
{
    HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    bool coInitialized = SUCCEEDED(hr);

    DWORD taskIndex = 0;
    HANDLE hTask = AvSetMmThreadCharacteristicsW(L"Audio", &taskIndex);

    ComPtr<IAudioClient> audioClient;
    ComPtr<IAudioCaptureClient> captureClient;
    HANDLE hSamplesReady = CreateEvent(nullptr, FALSE, FALSE, nullptr);
    WAVEFORMATEX* pMixFormat = nullptr;

    auto cleanup = [&]() {
        if (pMixFormat) {
            CoTaskMemFree(pMixFormat);
            pMixFormat = nullptr;
        }
        if (hSamplesReady) {
            CloseHandle(hSamplesReady);
            hSamplesReady = nullptr;
        }
        if (hTask) {
            AvRevertMmThreadCharacteristics(hTask);
            hTask = nullptr;
        }
        if (coInitialized) {
            CoUninitialize();
        }
        m_running.store(false);
    };

    // 1. Configurar parametros de ativacao do loopback de processo
    AUDIOCLIENT_ACTIVATION_PARAMS activationParams = {};
    activationParams.ActivationType = AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK;
    activationParams.ProcessLoopbackParams.TargetProcessId = processId;
    activationParams.ProcessLoopbackParams.ProcessLoopbackMode = PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE;

    PROPVARIANT propVar;
    PropVariantInit(&propVar);
    propVar.vt = VT_BLOB;
    propVar.blob.cbSize = sizeof(activationParams);
    propVar.blob.pBlobData = reinterpret_cast<BYTE*>(&activationParams);

    auto completionHandler = Microsoft::WRL::Make<AudioInterfaceCompletionHandler>();
    ComPtr<IActivateAudioInterfaceAsyncOperation> asyncOp;

    hr = ActivateAudioInterfaceAsync(
        VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
        __uuidof(IAudioClient),
        &propVar,
        completionHandler.Get(),
        &asyncOp
    );

    if (FAILED(hr)) {
        cleanup();
        return;
    }

    // Aguardar conclusao da ativacao (max 3 segundos)
    HANDLE waitHandles[2] = { completionHandler->m_hCompletedEvent, m_hStopEvent };
    DWORD waitResult = WaitForMultipleObjects(2, waitHandles, FALSE, 3000);
    if (waitResult != WAIT_OBJECT_0 || FAILED(completionHandler->m_activateResult)) {
        cleanup();
        return;
    }

    hr = completionHandler->m_activatedInterface.As(&audioClient);
    if (FAILED(hr) || !audioClient) {
        cleanup();
        return;
    }

    // 2. Obter formato de mixagem
    hr = audioClient->GetMixFormat(&pMixFormat);
    if (FAILED(hr) || !pMixFormat) {
        cleanup();
        return;
    }

    // 3. Inicializar IAudioClient em modo compartilhado com loopback
    const REFERENCE_TIME bufferDuration = 10000000; // 1 segundo (em unidades de 100ns)
    hr = audioClient->Initialize(
        AUDCLNT_SHAREMODE_SHARED,
        AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
        bufferDuration,
        0,
        pMixFormat,
        nullptr
    );

    if (FAILED(hr)) {
        cleanup();
        return;
    }

    hr = audioClient->SetEventHandle(hSamplesReady);
    if (FAILED(hr)) {
        cleanup();
        return;
    }

    hr = audioClient->GetService(__uuidof(IAudioCaptureClient), (void**)&captureClient);
    if (FAILED(hr) || !captureClient) {
        cleanup();
        return;
    }

    hr = audioClient->Start();
    if (FAILED(hr)) {
        cleanup();
        return;
    }

    const uint32_t sampleRate = pMixFormat->nSamplesPerSec;
    const uint32_t channels = pMixFormat->nChannels;
    const WORD bitsPerSample = pMixFormat->wBitsPerSample;
    const bool isFloat = (pMixFormat->wFormatTag == WAVE_FORMAT_IEEE_FLOAT) ||
        (pMixFormat->wFormatTag == WAVE_FORMAT_EXTENSIBLE &&
         reinterpret_cast<WAVEFORMATEXTENSIBLE*>(pMixFormat)->SubFormat == KSDATAFORMAT_SUBTYPE_IEEE_FLOAT);

    HANDLE loopWaitHandles[2] = { hSamplesReady, m_hStopEvent };

    // 4. Loop de captura dos pacotes de audio
    while (m_running.load()) {
        DWORD loopWait = WaitForMultipleObjects(2, loopWaitHandles, FALSE, 200);
        if (loopWait == (WAIT_OBJECT_0 + 1) || !m_running.load()) {
            break;
        }

        if (loopWait == WAIT_OBJECT_0) {
            UINT32 packetLength = 0;
            hr = captureClient->GetNextPacketSize(&packetLength);

            while (SUCCEEDED(hr) && packetLength > 0 && m_running.load()) {
                BYTE* pData = nullptr;
                UINT32 numFramesRead = 0;
                DWORD flags = 0;

                hr = captureClient->GetBuffer(&pData, &numFramesRead, &flags, nullptr, nullptr);
                if (SUCCEEDED(hr)) {
                    if (numFramesRead > 0 && pData != nullptr) {
                        const size_t totalSamples = numFramesRead * channels;
                        AudioChunk chunk;
                        chunk.sampleRate = sampleRate;
                        chunk.channels = channels;
                        chunk.samples.resize(totalSamples);

                        if (flags & AUDCLNT_BUFFERFLAGS_SILENT) {
                            std::fill(chunk.samples.begin(), chunk.samples.end(), 0.0f);
                        } else if (isFloat && bitsPerSample == 32) {
                            const float* floatData = reinterpret_cast<const float*>(pData);
                            std::copy(floatData, floatData + totalSamples, chunk.samples.begin());
                        } else if (bitsPerSample == 16) {
                            const int16_t* intData = reinterpret_cast<const int16_t*>(pData);
                            for (size_t i = 0; i < totalSamples; ++i) {
                                chunk.samples[i] = static_cast<float>(intData[i]) / 32768.0f;
                            }
                        }

                        if (callback) {
                            callback(chunk);
                        }
                    }

                    captureClient->ReleaseBuffer(numFramesRead);
                }

                hr = captureClient->GetNextPacketSize(&packetLength);
            }
        }
    }

    audioClient->Stop();
    cleanup();
}

