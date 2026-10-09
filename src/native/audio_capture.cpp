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
    if (!hwnd) {
        return 0;
    }
    if (IsWindow(hwnd)) {
        DWORD pid = 0;
        GetWindowThreadProcessId(hwnd, &pid);
        if (pid != 0) return pid;
    }
    HWND hwnd32 = reinterpret_cast<HWND>(static_cast<uintptr_t>(static_cast<uint32_t>(reinterpret_cast<uintptr_t>(hwnd))));
    if (IsWindow(hwnd32)) {
        DWORD pid = 0;
        GetWindowThreadProcessId(hwnd32, &pid);
        if (pid != 0) return pid;
    }
    return 0;
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

    // 2. Definir formato de captura padrao (48kHz, 2 canais, Float32)
    // Nota: IAudioClient::GetMixFormat retorna E_NOTIMPL em VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK
    WAVEFORMATEXTENSIBLE wfx = {};
    wfx.Format.wFormatTag = WAVE_FORMAT_EXTENSIBLE;
    wfx.Format.nChannels = 2;
    wfx.Format.nSamplesPerSec = 48000;
    wfx.Format.wBitsPerSample = 32;
    wfx.Format.nBlockAlign = wfx.Format.nChannels * (wfx.Format.wBitsPerSample / 8);
    wfx.Format.nAvgBytesPerSec = wfx.Format.nSamplesPerSec * wfx.Format.nBlockAlign;
    wfx.Format.cbSize = sizeof(WAVEFORMATEXTENSIBLE) - sizeof(WAVEFORMATEX);
    wfx.Samples.wValidBitsPerSample = 32;
    wfx.dwChannelMask = SPEAKER_FRONT_LEFT | SPEAKER_FRONT_RIGHT;
    wfx.SubFormat = KSDATAFORMAT_SUBTYPE_IEEE_FLOAT;

    // 3. Inicializar IAudioClient em modo compartilhado com loopback (timer-driven)
    const REFERENCE_TIME bufferDuration = 10000000; // 1 segundo (em unidades de 100ns)
    hr = audioClient->Initialize(
        AUDCLNT_SHAREMODE_SHARED,
        AUDCLNT_STREAMFLAGS_LOOPBACK,
        bufferDuration,
        0,
        reinterpret_cast<WAVEFORMATEX*>(&wfx),
        nullptr
    );

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

    const uint32_t sampleRate = 48000;
    const uint32_t channels = 2;

    // 4. Loop de captura com polling a cada 10ms (imune a ausência de eventos quando o app está em silêncio)
    while (m_running.load()) {
        DWORD waitRes = WaitForSingleObject(m_hStopEvent, 10);
        if (waitRes == WAIT_OBJECT_0 || !m_running.load()) {
            break;
        }

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
                    } else {
                        const float* floatData = reinterpret_cast<const float*>(pData);
                        std::copy(floatData, floatData + totalSamples, chunk.samples.begin());
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

    audioClient->Stop();
    cleanup();
}

