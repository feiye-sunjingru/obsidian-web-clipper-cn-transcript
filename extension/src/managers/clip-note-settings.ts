import { deleteModel, downloadModel, getHealth, getModelStatus, getTranscribers } from '../clip-note/api';
import { parseManualCookies, readBrowserCookies } from '../clip-note/cookies';
import { loadClipNoteSettings, saveAsrSettings, saveCookieSettings, saveGeneralSettings } from '../clip-note/storage';
import { ClipNoteCookieSettings, ClipNotePlatform, PlatformCookieConfig, WhisperModelSize } from '../clip-note/types';
import { getHelperStatus, restartHelper, startHelper, stopHelper } from '../clip-note/native-client';

const formatDate = (value: number | null) => value ? new Date(value).toLocaleString() : '从未';

function renderCookieSummary(platform: ClipNotePlatform, config: PlatformCookieConfig): void {
	const summary = document.getElementById(`clip-note-${platform}-summary`);
	if (summary) summary.textContent = `${config.cookies.length} 条 · ${config.status} · 更新于 ${formatDate(config.updatedAt)}`;
}

async function savePlatformCookies(platform: ClipNotePlatform, cookies: ClipNoteCookieSettings, config: PlatformCookieConfig): Promise<void> {
	cookies[platform] = config;
	await saveCookieSettings(cookies);
	renderCookieSummary(platform, config);
}

export async function initializeClipNoteSettings(): Promise<void> {
	const settings = await loadClipNoteSettings();
	const enabled = document.getElementById('clip-note-enabled') as HTMLInputElement;
	const provider = document.getElementById('clip-note-provider') as HTMLSelectElement;
	const model = document.getElementById('clip-note-whisper-model') as HTMLSelectElement;
	const localControls = document.getElementById('clip-note-model-controls') as HTMLElement;
	const remoteNotice = document.getElementById('clip-note-bcut-notice') as HTMLElement;
	enabled.checked = settings.general.enabled;
	provider.value = settings.asr.provider;
	model.value = settings.asr.whisperModel;

	const refreshProviderVisibility = () => {
		const local = provider.value === 'faster-whisper';
		localControls.hidden = !local;
		remoteNotice.hidden = local;
	};
	refreshProviderVisibility();

	enabled.onchange = () => saveGeneralSettings({ enabled: enabled.checked });
	provider.onchange = async () => {
		await saveAsrSettings({ provider: provider.value as 'bcut' | 'faster-whisper', whisperModel: model.value as WhisperModelSize });
		refreshProviderVisibility();
	};
	model.onchange = () => saveAsrSettings({ provider: provider.value as 'bcut' | 'faster-whisper', whisperModel: model.value as WhisperModelSize });

	const connection = document.getElementById('clip-note-connection-status')!;
	const renderRuntime = async () => {
		const runtime = await getHelperStatus();
		connection.textContent = runtime.status === 'ready'
			? `已就绪 · v${runtime.health?.version || 'unknown'} · 空闲 ${runtime.health?.idleTimeoutSeconds || 900} 秒后退出`
			: runtime.status === 'not-installed' ? '尚未安装 Clip Note Helper' : 'Helper 未运行';
	};
	document.getElementById('clip-note-start')!.addEventListener('click', async () => {
		connection.textContent = '正在连接…';
		try {
			const runtime = await startHelper();
			const health = await getHealth();
			const transcribers = await getTranscribers();
			const bcut = transcribers.transcribers.find(item => item.id === 'bcut');
			const bcutStatus = document.getElementById('clip-note-bcut-status');
			if (bcutStatus) bcutStatus.textContent = bcut?.available ? 'BCut API：可用' : 'BCut API：不可用';
			connection.textContent = `已就绪 · v${health.version} · PID ${runtime.pid} · ${Object.entries(health.capabilities).filter(([, value]) => value).map(([key]) => key).join(', ')}`;
		} catch (error) {
			connection.textContent = `未连接 · ${(error as Error).message}`;
		}
	});
	document.getElementById('clip-note-stop')!.addEventListener('click', async () => { await stopHelper(); await renderRuntime(); });
	document.getElementById('clip-note-restart')!.addEventListener('click', async () => { await restartHelper(); await renderRuntime(); });
	await renderRuntime();

	const modelStatus = document.getElementById('clip-note-model-status')!;
	const refreshModel = async () => {
		try {
			const result = await getModelStatus(model.value as WhisperModelSize);
			const labels = { 'not-installed': '未安装', downloading: '正在下载', failed: '下载失败，可重试' } as const;
			modelStatus.textContent = result.status === 'installed' ? `已安装 · ${(result.sizeBytes / 1024 / 1024).toFixed(0)} MB` : labels[result.status];
		} catch (error) {
			modelStatus.textContent = `无法读取状态 · ${(error as Error).message}`;
		}
	};
	document.getElementById('clip-note-model-download')!.addEventListener('click', async () => {
		modelStatus.textContent = '正在下载；可稍后刷新状态';
		try { await downloadModel(model.value as WhisperModelSize); } catch (error) { modelStatus.textContent = `下载失败 · ${(error as Error).message}`; }
	});
	document.getElementById('clip-note-model-refresh')!.addEventListener('click', refreshModel);
	document.getElementById('clip-note-model-delete')!.addEventListener('click', async () => {
		if (!confirm(`删除本机模型 ${model.value}？`)) return;
		await deleteModel(model.value as WhisperModelSize);
		await refreshModel();
	});

	for (const platform of ['bilibili', 'youtube'] as ClipNotePlatform[]) {
		const mode = document.getElementById(`clip-note-${platform}-mode`) as HTMLSelectElement;
		const input = document.getElementById(`clip-note-${platform}-manual`) as HTMLTextAreaElement;
		mode.value = settings.cookies[platform].mode;
		renderCookieSummary(platform, settings.cookies[platform]);
		mode.onchange = async () => {
			const nextMode = mode.value as PlatformCookieConfig['mode'];
			let next = { ...settings.cookies[platform], mode: nextMode };
			if (nextMode === 'off') next = { ...next, cookies: [], status: 'empty', updatedAt: Date.now(), lastValidatedAt: null };
			if (nextMode === 'browser') {
				try {
					const cookies = await readBrowserCookies(platform);
					next = { ...next, cookies, status: cookies.length ? 'ready' : 'invalid', updatedAt: Date.now(), lastValidatedAt: Date.now() };
				} catch { next = { ...next, status: next.cookies.length ? 'stale' : 'invalid' }; }
			}
			await savePlatformCookies(platform, settings.cookies, next);
		};
		document.getElementById(`clip-note-${platform}-import`)!.addEventListener('click', async () => {
			try {
				const parsed = parseManualCookies(input.value, platform);
				input.value = '';
				mode.value = 'manual';
				await savePlatformCookies(platform, settings.cookies, {
					mode: 'manual', cookies: parsed, updatedAt: Date.now(), lastValidatedAt: Date.now(), status: 'ready',
				});
			} catch (error) { renderCookieSummary(platform, { ...settings.cookies[platform], status: 'invalid' }); alert((error as Error).message); }
		});
		document.getElementById(`clip-note-${platform}-clear`)!.addEventListener('click', async () => {
			mode.value = 'off';
			await savePlatformCookies(platform, settings.cookies, { mode: 'off', cookies: [], updatedAt: Date.now(), lastValidatedAt: null, status: 'empty' });
		});
	}
}
