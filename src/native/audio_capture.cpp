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

static std::wstring ToLowerWide(const std::wstring& str)
{
    std::wstring res = str;
    for (wchar_t& ch : res) {
        ch = static_cast<wchar_t>(std::towlower(ch));
    }
    return res;
}

static bool IsCommunicationProcessName(const std::wstring& exeName)
{
    static const std::vector<std::wstring> kCommApps = {
        L"discord.exe",
        L"discordptb.exe",
        L"discordcanary.exe",
        L"discorddevelopment.exe",
        L"teams.exe",
        L"ms-teams.exe",
        L"skype.exe",
        L"zoom.exe",
        L"ts3client_win64.exe",
        L"ts3client_win32.exe",
        L"teamspeak.exe",
        L"mumble.exe",
        L"whatsapp.exe",
        L"telegram.exe",
        L"slack.exe",
        L"vencord.exe",
        L"vesktop.exe",
        L"element.exe",
        L"guilded.exe",
        L"signal.exe",
        L"viber.exe"
    };

    const std::wstring lower = ToLowerWide(exeName);
    for (const auto& target : kCommApps) {
        if (lower == target) {
            return true;
        }
    }
    return false;
}

std::vector<DWORD> ProcessAudioCapture::FindFilteredCommunicationPids()
{
    DWORD selfPid = GetCurrentProcessId();
    std::unordered_map<DWORD, DWORD> parentMap;
    std::unordered_map<DWORD, std::wstring> nameMap;

    HANDLE hSnap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (hSnap != INVALID_HANDLE_VALUE) {
        PROCESSENTRY32W pe = {};
        pe.dwSize = sizeof(pe);
        if (Process32FirstW(hSnap, &pe)) {
            do {
                parentMap[pe.th32ProcessID] = pe.th32ParentProcessID;
                nameMap[pe.th32ProcessID] = pe.szExeFile;
            } while (Process32NextW(hSnap, &pe));
        }
        CloseHandle(hSnap);
    }

    // Encontrar a raiz da árvore do próprio TopCast (ex.: processo principal do Electron)
    DWORD selfRoot = selfPid;
    std::unordered_set<DWORD> visited;
    visited.insert(selfRoot);
    while (parentMap.count(selfRoot)) {
        DWORD parentPid = parentMap[selfRoot];
        if (parentPid == 0 || visited.count(parentPid) || !nameMap.count(parentPid)) {
            break;
        }
        std::wstring parentName = ToLowerWide(nameMap[parentPid]);
        if (parentName == L"explorer.exe" || parentName == L"cmd.exe" || parentName == L"powershell.exe" || parentName == L"pwsh.exe" || parentName == L"services.exe" || parentName == L"svchost.exe" || parentName == L"wininit.exe") {
            break;
        }
        visited.insert(parentPid);
        selfRoot = parentPid;
    }

    std::unordered_set<DWORD> rootPids;
    rootPids.insert(selfRoot);

    for (const auto& kv : nameMap) {
        DWORD pid = kv.first;
        const std::wstring& exeName = kv.second;
        if (IsCommunicationProcessName(exeName)) {
            // Sobe até o processo pai raiz do mesmo aplicativo de comunicação
            DWORD rootPid = pid;
            std::unordered_set<DWORD> chainVisited;
            chainVisited.insert(rootPid);
            while (parentMap.count(rootPid)) {
                DWORD parentPid = parentMap[rootPid];
                if (parentPid == 0 || chainVisited.count(parentPid) || !nameMap.count(parentPid)) {
                    break;
                }
                if (!IsCommunicationProcessName(nameMap[parentPid])) {
                    break;
                }
                chainVisited.insert(parentPid);
                rootPid = parentPid;
            }
            rootPids.insert(rootPid);
        }
    }

    // Remover quaisquer PIDs que sejam filhos de outros já presentes em rootPids
    std::vector<DWORD> finalRoots;
    for (DWORD candidate : rootPids) {
        bool hasAncestorInSet = false;
        DWORD curr = parentMap.count(candidate) ? parentMap[candidate] : 0;
        std::unordered_set<DWORD> stepVisited;
        while (curr != 0 && !stepVisited.count(curr)) {
            if (rootPids.count(curr)) {
                hasAncestorInSet = true;
                break;
            }
            stepVisited.insert(curr);
            curr = parentMap.count(curr) ? parentMap[curr] : 0;
        }
        if (!hasAncestorInSet && candidate != 0) {
            finalRoots.push_back(candidate);
        }
    }

    return finalRoots;
}

bool ProcessAudioCapture::StartScreenIsolated(AudioDataCallback callback, std::string& outError)
{
    std::lock_guard<std::mutex> lock(m_mutex);
    StopLocked();

    if (!IsSupported()) {
        outError = "Process Loopback Audio Capture requer Windows 10 build 20348+ ou Windows 11.";
        return false;
    }

    ResetEvent(m_hStopEvent);
    m_running.store(true);

    auto initPromise = std::make_shared<std::promise<std::string>>();
    std::future<std::string> initFuture = initPromise->get_future();
    m_thread = std::thread(&ProcessAudioCapture::ScreenIsolatedCaptureThreadFunc, this, callback, initPromise);

    if (initFuture.wait_for(std::chrono::seconds(5)) != std::future_status::ready) {
        outError = "Tempo esgotado ao inicializar a captura isolada de tela inteira.";
        StopLocked();
        return false;
    }

    std::string initError = initFuture.get();
    if (!initError.empty()) {
        outError = initError;
        StopLocked();
        return false;
    }
    return true;
}

bool ProcessAudioCapture::Start(DWORD processId, AudioDataCallback callback, std::string& outError)
{
    std::lock_guard<std::mutex> lock(m_mutex);
    StopLocked();

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

    // A thread informa se a ativacao/inicializacao WASAPI deu certo antes de retornar.
    auto initPromise = std::make_shared<std::promise<std::string>>();
    std::future<std::string> initFuture = initPromise->get_future();
    m_thread = std::thread(&ProcessAudioCapture::CaptureThreadFunc, this, processId, callback, initPromise);

    if (initFuture.wait_for(std::chrono::seconds(5)) != std::future_status::ready) {
        outError = "Tempo esgotado ao inicializar a captura de audio do processo.";
        StopLocked();
        return false;
    }

    std::string initError = initFuture.get();
    if (!initError.empty()) {
        outError = initError;
        StopLocked();
        return false;
    }
    return true;
}

void ProcessAudioCapture::Stop()
{
    std::lock_guard<std::mutex> lock(m_mutex);
    StopLocked();
}

void ProcessAudioCapture::StopLocked()
{
    m_running.store(false);
    if (m_hStopEvent) {
        SetEvent(m_hStopEvent);
    }

    // Tambem junta threads que ja terminaram sozinhas (falha), evitando std::terminate.
    if (m_thread.joinable()) {
        m_thread.join();
    }
}

bool ProcessAudioCapture::IsRunning() const
{
    return m_running.load();
}

static std::string FormatHr(const char* step, HRESULT hr)
{
    char buffer[160];
    snprintf(buffer, sizeof(buffer), "%s falhou (HRESULT 0x%08lX).", step, static_cast<unsigned long>(hr));
    return buffer;
}

void ProcessAudioCapture::CaptureThreadFunc(
    DWORD processId,
    AudioDataCallback callback,
    std::shared_ptr<std::promise<std::string>> initPromise)
{
    HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    bool coInitialized = SUCCEEDED(hr);

    DWORD taskIndex = 0;
    HANDLE hTask = AvSetMmThreadCharacteristicsW(L"Audio", &taskIndex);

    ComPtr<IAudioClient> audioClient;
    ComPtr<IAudioCaptureClient> captureClient;
    ComPtr<AudioInterfaceCompletionHandler> completionHandler;
    ComPtr<IActivateAudioInterfaceAsyncOperation> asyncOp;
    bool initReported = false;

    auto cleanup = [&]() {
        captureClient.Reset();
        audioClient.Reset();
        asyncOp.Reset();
        completionHandler.Reset();
        if (hTask) {
            AvRevertMmThreadCharacteristics(hTask);
            hTask = nullptr;
        }
        if (coInitialized) {
            CoUninitialize();
            coInitialized = false;
        }
        m_running.store(false);
    };

    auto fail = [&](const std::string& message) {
        cleanup();
        if (!initReported) {
            initReported = true;
            initPromise->set_value(message.empty() ? std::string("Falha desconhecida na captura.") : message);
        }
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

    completionHandler = Microsoft::WRL::Make<AudioInterfaceCompletionHandler>();
    if (!completionHandler) {
        fail("Falha ao alocar o handler de ativacao.");
        return;
    }

    hr = ActivateAudioInterfaceAsync(
        VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
        __uuidof(IAudioClient),
        &propVar,
        completionHandler.Get(),
        &asyncOp
    );

    if (FAILED(hr)) {
        fail(FormatHr("ActivateAudioInterfaceAsync", hr));
        return;
    }

    // Aguardar conclusao da ativacao (max 3 segundos)
    HANDLE waitHandles[2] = { completionHandler->m_hCompletedEvent, m_hStopEvent };
    DWORD waitResult = WaitForMultipleObjects(2, waitHandles, FALSE, 3000);
    if (waitResult != WAIT_OBJECT_0) {
        fail("A ativacao do loopback de processo nao respondeu.");
        return;
    }
    if (FAILED(completionHandler->m_activateResult)) {
        fail(FormatHr("Ativacao do loopback de processo", completionHandler->m_activateResult));
        return;
    }

    hr = completionHandler->m_activatedInterface.As(&audioClient);
    if (FAILED(hr) || !audioClient) {
        fail(FormatHr("Obter IAudioClient", hr));
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
        AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM | AUDCLNT_STREAMFLAGS_SRC_DEFAULT_QUALITY,
        bufferDuration,
        0,
        reinterpret_cast<WAVEFORMATEX*>(&wfx),
        nullptr
    );

    if (FAILED(hr)) {
        fail(FormatHr("IAudioClient::Initialize", hr));
        return;
    }

    hr = audioClient->GetService(__uuidof(IAudioCaptureClient), (void**)&captureClient);
    if (FAILED(hr) || !captureClient) {
        fail(FormatHr("IAudioClient::GetService", hr));
        return;
    }

    hr = audioClient->Start();
    if (FAILED(hr)) {
        fail(FormatHr("IAudioClient::Start", hr));
        return;
    }

    initReported = true;
    initPromise->set_value(std::string());

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

void ProcessAudioCapture::ScreenIsolatedCaptureThreadFunc(
    AudioDataCallback callback,
    std::shared_ptr<std::promise<std::string>> initPromise)
{
    HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    bool coInitialized = SUCCEEDED(hr);

    DWORD taskIndex = 0;
    HANDLE hTask = AvSetMmThreadCharacteristicsW(L"Audio", &taskIndex);

    struct ClientEntry {
        DWORD pid;
        bool isPrimaryExclude;
        ComPtr<IAudioClient> audioClient;
        ComPtr<IAudioCaptureClient> captureClient;
        std::vector<float> accumSamples;
    };

    std::vector<ClientEntry> entries;
    bool initReported = false;

    auto cleanup = [&]() {
        for (auto& e : entries) {
            if (e.audioClient) {
                e.audioClient->Stop();
            }
            e.captureClient.Reset();
            e.audioClient.Reset();
        }
        entries.clear();
        if (hTask) {
            AvRevertMmThreadCharacteristics(hTask);
            hTask = nullptr;
        }
        if (coInitialized) {
            CoUninitialize();
            coInitialized = false;
        }
        m_running.store(false);
    };

    auto fail = [&](const std::string& message) {
        cleanup();
        if (!initReported) {
            initReported = true;
            initPromise->set_value(message.empty() ? std::string("Falha na captura isolada.") : message);
        }
    };

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

    auto openLoopbackClient = [&](DWORD pid, PROCESS_LOOPBACK_MODE mode, ComPtr<IAudioClient>& outAudio, ComPtr<IAudioCaptureClient>& outCapture, std::string& outErr) -> bool {
        AUDIOCLIENT_ACTIVATION_PARAMS activationParams = {};
        activationParams.ActivationType = AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK;
        activationParams.ProcessLoopbackParams.TargetProcessId = pid;
        activationParams.ProcessLoopbackParams.ProcessLoopbackMode = mode;

        PROPVARIANT propVar;
        PropVariantInit(&propVar);
        propVar.vt = VT_BLOB;
        propVar.blob.cbSize = sizeof(activationParams);
        propVar.blob.pBlobData = reinterpret_cast<BYTE*>(&activationParams);

        ComPtr<AudioInterfaceCompletionHandler> handler = Microsoft::WRL::Make<AudioInterfaceCompletionHandler>();
        if (!handler) {
            outErr = "Falha ao alocar handler de ativacao.";
            return false;
        }

        ComPtr<IActivateAudioInterfaceAsyncOperation> op;
        HRESULT localHr = ActivateAudioInterfaceAsync(
            VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
            __uuidof(IAudioClient),
            &propVar,
            handler.Get(),
            &op
        );
        if (FAILED(localHr)) {
            outErr = FormatHr("ActivateAudioInterfaceAsync", localHr);
            return false;
        }

        HANDLE waitHandles[2] = { handler->m_hCompletedEvent, m_hStopEvent };
        DWORD waitResult = WaitForMultipleObjects(2, waitHandles, FALSE, 3000);
        if (waitResult != WAIT_OBJECT_0) {
            outErr = "Ativacao do loopback nao respondeu.";
            return false;
        }
        if (FAILED(handler->m_activateResult)) {
            outErr = FormatHr("ActivateResult", handler->m_activateResult);
            return false;
        }

        localHr = handler->m_activatedInterface.As(&outAudio);
        if (FAILED(localHr) || !outAudio) {
            outErr = FormatHr("Obter IAudioClient", localHr);
            return false;
        }

        const REFERENCE_TIME bufferDuration = 10000000;
        localHr = outAudio->Initialize(
            AUDCLNT_SHAREMODE_SHARED,
            AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM | AUDCLNT_STREAMFLAGS_SRC_DEFAULT_QUALITY,
            bufferDuration,
            0,
            reinterpret_cast<WAVEFORMATEX*>(&wfx),
            nullptr
        );
        if (FAILED(localHr)) {
            outErr = FormatHr("IAudioClient::Initialize", localHr);
            return false;
        }

        localHr = outAudio->GetService(__uuidof(IAudioCaptureClient), (void**)&outCapture);
        if (FAILED(localHr) || !outCapture) {
            outErr = FormatHr("IAudioClient::GetService", localHr);
            return false;
        }

        return true;
    };

    std::vector<DWORD> filteredPids = FindFilteredCommunicationPids();
    if (filteredPids.empty()) {
        filteredPids.push_back(GetCurrentProcessId());
    }

    // O primeiro PID (ou o processo de comunicacao prioritario se houver, caso contrario TopCast) usa EXCLUDE_TARGET_PROCESS_TREE,
    // capturando todo o sistema exceto aquela arvore de processos.
    // Quaisquer processos adicionais de comunicacao encontrados sao capturados com INCLUDE_TARGET_PROCESS_TREE para cancelamento diferencial.
    DWORD primaryExcludePid = filteredPids[0];
    // Se houver outro processo alem do proprio TopCast (ex.: Discord), priorizamos ele como o EXCLUDE primario nativo do kernel!
    DWORD selfPid = GetCurrentProcessId();
    for (DWORD pid : filteredPids) {
        if (pid != selfPid) {
            primaryExcludePid = pid;
            break;
        }
    }

    std::string errStr;
    ComPtr<IAudioClient> mainAudio;
    ComPtr<IAudioCaptureClient> mainCapture;
    if (!openLoopbackClient(primaryExcludePid, PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE, mainAudio, mainCapture, errStr)) {
        fail(errStr);
        return;
    }

    ClientEntry primaryEntry;
    primaryEntry.pid = primaryExcludePid;
    primaryEntry.isPrimaryExclude = true;
    primaryEntry.audioClient = mainAudio;
    primaryEntry.captureClient = mainCapture;
    entries.push_back(std::move(primaryEntry));

    // Para os demais processos na lista filtrada (ex.: outros apps VoIP ou o proprio app), abrimos INCLUDE para subtracao em fase
    for (DWORD pid : filteredPids) {
        if (pid == primaryExcludePid) continue;
        ComPtr<IAudioClient> subAudio;
        ComPtr<IAudioCaptureClient> subCapture;
        std::string subErr;
        if (openLoopbackClient(pid, PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE, subAudio, subCapture, subErr)) {
            ClientEntry subEntry;
            subEntry.pid = pid;
            subEntry.isPrimaryExclude = false;
            subEntry.audioClient = subAudio;
            subEntry.captureClient = subCapture;
            entries.push_back(std::move(subEntry));
        }
    }

    for (auto& e : entries) {
        HRESULT startHr = e.audioClient->Start();
        if (FAILED(startHr) && e.isPrimaryExclude) {
            fail(FormatHr("IAudioClient::Start", startHr));
            return;
        }
    }

    initReported = true;
    initPromise->set_value(std::string());

    const uint32_t sampleRate = 48000;
    const uint32_t channels = 2;

    while (m_running.load()) {
        DWORD waitRes = WaitForSingleObject(m_hStopEvent, 10);
        if (waitRes == WAIT_OBJECT_0 || !m_running.load()) {
            break;
        }

        // Ler pacotes de cada cliente
        for (auto& e : entries) {
            e.accumSamples.clear();
            UINT32 packetLength = 0;
            HRESULT pktHr = e.captureClient->GetNextPacketSize(&packetLength);
            while (SUCCEEDED(pktHr) && packetLength > 0 && m_running.load()) {
                BYTE* pData = nullptr;
                UINT32 numFramesRead = 0;
                DWORD flags = 0;
                pktHr = e.captureClient->GetBuffer(&pData, &numFramesRead, &flags, nullptr, nullptr);
                if (SUCCEEDED(pktHr)) {
                    if (numFramesRead > 0 && pData != nullptr) {
                        const size_t count = numFramesRead * channels;
                        const size_t oldSize = e.accumSamples.size();
                        e.accumSamples.resize(oldSize + count, 0.0f);
                        if (!(flags & AUDCLNT_BUFFERFLAGS_SILENT)) {
                            const float* floatData = reinterpret_cast<const float*>(pData);
                            std::copy(floatData, floatData + count, e.accumSamples.begin() + oldSize);
                        }
                    }
                    e.captureClient->ReleaseBuffer(numFramesRead);
                }
                pktHr = e.captureClient->GetNextPacketSize(&packetLength);
            }
        }

        if (!entries.empty() && !entries[0].accumSamples.empty()) {
            AudioChunk chunk;
            chunk.sampleRate = sampleRate;
            chunk.channels = channels;
            chunk.samples = std::move(entries[0].accumSamples);

            // Subtrair amostras de quaisquer outros processos filtrados
            for (size_t idx = 1; idx < entries.size(); ++idx) {
                const auto& subSamples = entries[idx].accumSamples;
                const size_t limit = (std::min)(chunk.samples.size(), subSamples.size());
                for (size_t i = 0; i < limit; ++i) {
                    float diff = chunk.samples[i] - subSamples[i];
                    if (diff > 1.0f) diff = 1.0f;
                    else if (diff < -1.0f) diff = -1.0f;
                    chunk.samples[i] = diff;
                }
            }

            if (callback) {
                callback(chunk);
            }
        }
    }

    cleanup();
}

