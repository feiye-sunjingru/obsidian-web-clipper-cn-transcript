import browser from '../utils/browser-polyfill';
import { ClipNotePlatform, StoredCookie } from './types';

const PLATFORM_DOMAINS: Record<ClipNotePlatform, string[]> = {
	bilibili: ['bilibili.com'],
	youtube: ['youtube.com', 'google.com'],
};

export function isCookieForPlatform(cookie: StoredCookie, platform: ClipNotePlatform): boolean {
	const domain = cookie.domain.replace(/^\./, '').toLowerCase();
	return PLATFORM_DOMAINS[platform].some(allowed => domain === allowed || domain.endsWith(`.${allowed}`));
}

export function parseCookieHeader(input: string, platform: ClipNotePlatform): StoredCookie[] {
	const domain = platform === 'bilibili' ? '.bilibili.com' : '.youtube.com';
	return input.split(';').map(part => part.trim()).filter(Boolean).map(part => {
		const separator = part.indexOf('=');
		if (separator <= 0) throw new Error('Cookie Header 格式无效');
		return {
			domain,
			name: part.slice(0, separator).trim(),
			value: part.slice(separator + 1).trim(),
			path: '/',
			secure: true,
		};
	});
}

export function parseNetscapeCookies(input: string, platform: ClipNotePlatform): StoredCookie[] {
	const cookies = input.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#')).map(line => {
		const parts = line.split('\t');
		if (parts.length < 7) throw new Error('cookies.txt 格式无效');
		return {
			domain: parts[0],
			path: parts[2] || '/',
			secure: parts[3].toUpperCase() === 'TRUE',
			expirationDate: Number(parts[4]) || undefined,
			name: parts[5],
			value: parts.slice(6).join('\t'),
		};
	});
	if (cookies.some(cookie => !isCookieForPlatform(cookie, platform))) {
		throw new Error('Cookie 域名与所选平台不匹配');
	}
	return cookies;
}

export function parseManualCookies(input: string, platform: ClipNotePlatform): StoredCookie[] {
	const trimmed = input.trim();
	if (!trimmed) throw new Error('请输入 Cookie');
	const cookies = trimmed.includes('\t') ? parseNetscapeCookies(trimmed, platform) : parseCookieHeader(trimmed, platform);
	if (!cookies.length) throw new Error('没有找到可用 Cookie');
	return cookies;
}

export async function readBrowserCookies(platform: ClipNotePlatform): Promise<StoredCookie[]> {
	const granted = await browser.permissions.request({ permissions: ['cookies'] });
	if (!granted) throw new Error('未授予 Chrome Cookies 权限');
	const urls = platform === 'bilibili'
		? ['https://www.bilibili.com/']
		: ['https://www.youtube.com/', 'https://accounts.google.com/'];
	const results = await Promise.all(urls.map(url => browser.cookies.getAll({ url })));
	const unique = new Map<string, StoredCookie>();
	for (const cookie of results.flat()) {
		const stored: StoredCookie = {
			domain: cookie.domain,
			name: cookie.name,
			value: cookie.value,
			path: cookie.path,
			secure: cookie.secure,
			expirationDate: cookie.expirationDate,
			httpOnly: cookie.httpOnly,
		};
		if (isCookieForPlatform(stored, platform)) unique.set(`${stored.domain}|${stored.path}|${stored.name}`, stored);
	}
	return [...unique.values()];
}
