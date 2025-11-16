export function stringToHexString(data: string): string {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(data);

    return Array.from(bytes)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}